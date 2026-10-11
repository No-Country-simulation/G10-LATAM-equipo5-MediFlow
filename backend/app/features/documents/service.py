"""Lógica de negocio de ingesta y consulta de documentos clínicos."""

import base64
import binascii
import json
import logging
import math
import operator
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from jsonschema import Draft202012Validator
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.core.config import settings
from app.features.auth.models import User
from app.features.catalogs.models import DocumentType, RoutingQueue
from app.features.documents.forms import BLOQUE_CAMPOS_ADICIONALES, BLOQUE_POR_TIPO
from app.features.documents.models import (
    ClinicalDocument,
    ClinicalDocumentAttachment,
    ClinicalDocumentDiagnosis,
    ClinicalDocumentMedication,
    ClinicalDocumentProcedure,
    ClinicalDocumentProfessional,
    ClinicalDocumentRequestedExam,
    LabPanel,
    LabParameter,
)
from app.features.documents.normalization import (
    normalizar_cie10,
    normalizar_identificacion,
    normalizar_pais,
)
from app.features.documents.schemas import (
    LISTAS_COMUNES,
    ArchivoAdjunto,
    DatosGeneralesExtract,
    DetalleClinicoExtract,
    DiagnosticoExtract,
    ExamenSolicitadoItem,
    IngestPayload,
    MedicamentoItem,
    PanelLaboratorio,
    ProfesionalExtract,
)
from app.features.documents.scoring import HallazgosCalidad, ResultadoScore, calcular_score
from app.shared.oci_client import oci_storage_client

logger = logging.getLogger(__name__)

SCORE_CONFIANZA_THRESHOLD = 0.85

TIPO_NO_CLASIFICABLE = "OTRO"

# (extensión, content-type) con que se guarda cada `tipo_archivo` en OCI.
_FORMATO_POR_TIPO_ARCHIVO = {
    "PDF": ("pdf", "application/pdf"),
    "PNG": ("png", "image/png"),
    "JPG": ("jpg", "image/jpeg"),
    "TIFF": ("tiff", "image/tiff"),
    "DCM": ("dcm", "application/dicom"),
}


class InvalidBase64Error(ValueError):
    """El contenido base64 del archivo enviado en el payload es inválido."""


class DocumentIngestionError(RuntimeError):
    """Fallo irrecuperable durante la ingesta del documento (OCI Storage o base de datos)."""


class DocumentAlreadyExistsError(RuntimeError):
    """El `documento_id` ya fue ingresado: n8n debe generar uno nuevo por cada subida."""


@dataclass
class ExtraccionPreparada:
    """Payload normalizado más el resultado de las validaciones y del cálculo del score."""

    payload: IngestPayload
    score: ResultadoScore
    nivel_prioridad: str
    ajustes: list[str] = field(default_factory=list)


def _normalizar_identificacion(datos: DatosGeneralesExtract) -> str | None:
    """Normaliza la identificación del paciente; retorna el problema de validación, si lo hay."""
    identificacion = datos.paciente.identificacion
    if identificacion is None:
        return None
    normalizada = normalizar_identificacion(identificacion.tipo, identificacion.numero)
    identificacion.pais = normalizar_pais(identificacion.pais)
    if normalizada is None:
        datos.paciente.identificacion = None
        return None
    identificacion.tipo, identificacion.numero = normalizada.tipo, normalizada.numero
    if normalizada.valida is False:
        return f"Identificación {normalizada.tipo} con formato o dígito verificador inválido"
    return None


def _normalizar_diagnosticos(datos: DatosGeneralesExtract) -> int:
    """CIE-10 en formato canónico (descarta los inválidos) y un único diagnóstico PRINCIPAL.

    Retorna cuántos códigos se descartaron por formato inválido.
    """
    diagnosticos = [d for d in datos.diagnosticos if d.descripcion or d.cie10]
    descartados = 0
    for diagnostico in diagnosticos:
        codigo = normalizar_cie10(diagnostico.cie10)
        if diagnostico.cie10 and codigo is None:
            descartados += 1
        diagnostico.cie10 = codigo
        if codigo is None:
            diagnostico.origen_cie10 = None
        elif diagnostico.origen_cie10 is None:
            diagnostico.origen_cie10 = "INFERIDO"

    datos.diagnosticos = diagnosticos
    principal = datos.diagnostico_principal
    for diagnostico in diagnosticos:
        diagnostico.tipo = "PRINCIPAL" if diagnostico is principal else "SECUNDARIO"
    return descartados


def normalizar_datos_generales(datos: DatosGeneralesExtract) -> tuple[str | None, int]:
    """Normaliza en el lugar identificación, país, CIE-10 y diagnóstico principal.

    Retorna (problema de la identificación o `None`, cantidad de CIE-10 inválidos descartados).
    Lo usan la ingesta (baja el score) y la auditoría (responde 422).
    """
    return _normalizar_identificacion(datos), _normalizar_diagnosticos(datos)


def _parametros_criticos(detalle: DetalleClinicoExtract) -> list[str]:
    lab = detalle.examenes_y_laboratorio
    if lab is None:
        return []
    return [p.nombre or "(sin nombre)" for panel in lab.paneles for p in panel.parametros if p.critico]


def preparar_extraccion(payload: IngestPayload) -> ExtraccionPreparada:
    """Normaliza el payload del LLM, valida su contenido y calcula el puntaje de confianza.

    El payload original no se modifica: se trabaja sobre una copia, que es la que se persiste.
    Un valor crítico de laboratorio eleva la prioridad a Urgente aunque el LLM no lo haya hecho.
    """
    normalizado = payload.model_copy(deep=True)
    problema_identificacion, cie10_descartados = normalizar_datos_generales(normalizado.datos_generales)

    paciente = normalizado.datos_generales.paciente
    hallazgos = HallazgosCalidad(
        tiene_nombre=bool(paciente.nombre),
        tiene_identificacion=bool(
            (paciente.identificacion and paciente.identificacion.numero) or paciente.numero_ficha
        ),
        identificacion_invalida=problema_identificacion,
        cie10_descartados=cie10_descartados,
    )
    resultado = calcular_score(
        normalizado.clasificacion.tipo_documento,
        normalizado.evaluacion,
        normalizado.clasificacion.score_confianza_clasificacion,
        normalizado.detalle_clinico,
        hallazgos,
    )

    nivel = normalizado.clasificacion.nivel_prioridad
    ajustes: list[str] = []
    criticos = _parametros_criticos(normalizado.detalle_clinico)
    if criticos and nivel != "Urgente":
        nivel = "Urgente"
        ajustes.append(f"Prioridad elevada a Urgente por valor crítico en: {', '.join(criticos[:5])}")
    normalizado.clasificacion.nivel_prioridad = nivel
    return ExtraccionPreparada(normalizado, resultado, nivel, ajustes)


def _audit_reasons(
    preparada: ExtraccionPreparada,
    tipos_activos: dict[str, dict[str, Any] | None],
    colas_activas: set[str],
) -> list[str]:
    """Reúne los motivos por los que el documento debe pasar por auditoría humana (vacío si ninguno).

    `tipos_activos` mapea cada `codigo` activo a su `campos_extraccion` (JSON Schema o `None`).
    Si el score no alcanza el umbral, se agregan también los motivos de cada descuento.
    """
    payload = preparada.payload
    tipo = payload.clasificacion.tipo_documento
    destino = payload.decision_enrutamiento.destino_principal
    motivos: list[str] = []

    if preparada.score.score < SCORE_CONFIANZA_THRESHOLD:
        motivos.append(
            f"Score de confianza {preparada.score.score} menor al umbral {SCORE_CONFIANZA_THRESHOLD}"
        )
        motivos.extend(preparada.score.motivos)
    if payload.decision_enrutamiento.requiere_auditoria_humana:
        motivos.append("El workflow solicitó auditoría humana")
    if tipo == TIPO_NO_CLASIFICABLE:
        motivos.append("Documento no clasificable (tipo OTRO)")
    if tipo not in tipos_activos:
        motivos.append(f"El tipo de documento '{tipo}' no existe o está inactivo en el catálogo")
    if destino not in colas_activas:
        motivos.append(f"La cola '{destino}' no existe o está inactiva en el catálogo")

    motivos.extend(detalle_reasons(tipo, payload.detalle_clinico, tipos_activos.get(tipo)))
    return motivos


def detalle_reasons(
    tipo: str, detalle: DetalleClinicoExtract, esquema: dict[str, Any] | None
) -> list[str]:
    """Problemas de coherencia entre `detalle_clinico` y el tipo (vacío si es coherente).

    Lo usan la ingesta (manda a auditoría) y la resolución de auditoría (responde 422).
    """
    problemas: list[str] = []
    propios = [b for b in (BLOQUE_POR_TIPO.get(tipo),) if b]
    if esquema is not None:
        propios.append(BLOQUE_CAMPOS_ADICIONALES)
    permitidos = [*LISTAS_COMUNES, *propios]
    bloques = [
        nombre for nombre in type(detalle).model_fields if getattr(detalle, nombre) is not None
    ]
    inesperados = [b for b in bloques if b not in permitidos]
    if inesperados:
        problemas.append(
            f"detalle_clinico trae {inesperados} pero el tipo '{tipo}' espera "
            f"{propios or 'ningún bloque propio'}"
        )

    if esquema is not None and detalle.campos_adicionales is not None:
        errores = sorted(
            Draft202012Validator(esquema).iter_errors(detalle.campos_adicionales),
            key=lambda e: e.path,
        )
        if errores:
            resumen = "; ".join(
                f"{'.'.join(map(str, e.path)) or '(raíz)'}: {e.message}" for e in errores[:3]
            )
            problemas.append(
                f"campos_adicionales no cumple el esquema del tipo '{tipo}': {resumen}"
            )
    return problemas


def _resolve_routing(
    preparada: ExtraccionPreparada, motivos_auditoria: list[str]
) -> tuple[str, str, bool]:
    """Aplica la regla de triaje y retorna (estado, ruta_json_oci, requiere_auditoria)."""
    documento_id = preparada.payload.documento_id
    if motivos_auditoria:
        return "PENDIENTE_AUDITORIA", f"auditoria_humana/{documento_id}.json", True
    return "PROCESADO", f"procesados/{preparada.nivel_prioridad.lower()}/{documento_id}.json", False


async def active_document_types(db: AsyncSession) -> dict[str, dict[str, Any] | None]:
    """Tipos activos (`codigo` -> `campos_extraccion`), para validar lo que devolvió el LLM."""
    result = await db.execute(
        select(DocumentType.codigo, DocumentType.campos_extraccion).where(
            DocumentType.is_active.is_(True)
        )
    )
    return {codigo: esquema for codigo, esquema in result.all()}


async def active_queue_codes(db: AsyncSession) -> set[str]:
    """Códigos de las colas activas, para validar lo que devolvió el LLM."""
    result = await db.execute(select(RoutingQueue.codigo).where(RoutingQueue.is_active.is_(True)))
    return set(result.scalars().all())


async def _compensate_uploads(object_names: list[str]) -> None:
    """Elimina de OCI los objetos ya subidos cuando un paso posterior del pipeline falla."""
    for object_name in object_names:
        try:
            await oci_storage_client.delete_object(object_name)
            logger.warning("Compensación aplicada: objeto eliminado de OCI -> %s", object_name)
        except Exception:
            logger.exception("Fallo al ejecutar la compensación de OCI para %s", object_name)


def _build_attachments(
    archivos: list[ArchivoAdjunto], binary_paths: list[str]
) -> list[ClinicalDocumentAttachment]:
    """Construye una fila de adjunto por cada archivo del payload, en el orden recibido."""
    return [
        ClinicalDocumentAttachment(
            tipo_archivo=archivo.tipo_archivo,
            oci_path=oci_path,
            rol=archivo.rol,
            orden=orden,
        )
        for orden, (archivo, oci_path) in enumerate(zip(archivos, binary_paths, strict=True))
    ]


def _build_medications(items: list[MedicamentoItem]) -> list[ClinicalDocumentMedication]:
    """Filas de medicamentos (de cualquier tipo de documento); se omiten los que no traen nombre."""
    return [
        ClinicalDocumentMedication(
            nombre=item.nombre,
            dosis=item.dosis,
            frecuencia=item.frecuencia,
            via=item.via,
            duracion_tratamiento=item.duracion_tratamiento,
            cantidad=item.cantidad,
            tipo=item.tipo,
            orden=orden,
        )
        for orden, item in enumerate(i for i in items if i.nombre)
    ]


def _build_lab_panels(paneles: list[PanelLaboratorio]) -> list[LabPanel]:
    """Paneles (y sus parámetros) de un informe de laboratorio; se omiten filas sin nombre."""
    return [
        LabPanel(
            nombre_panel=panel.nombre_panel or "Resultados",
            muestra=panel.muestra,
            orden=panel_orden,
            parametros=[
                LabParameter(
                    nombre=parametro.nombre,
                    valor=parametro.valor,
                    unidad=parametro.unidad,
                    rango_referencia=parametro.rango_referencia,
                    alterado=parametro.alterado,
                    critico=parametro.critico,
                    orden=parametro_orden,
                )
                for parametro_orden, parametro in enumerate(p for p in panel.parametros if p.nombre)
            ],
        )
        for panel_orden, panel in enumerate(paneles)
    ]


def _build_requested_exams(items: list[ExamenSolicitadoItem]) -> list[ClinicalDocumentRequestedExam]:
    return [
        ClinicalDocumentRequestedExam(codigo=item.codigo, nombre=item.nombre, categoria=item.categoria, orden=orden)
        for orden, item in enumerate(i for i in items if i.nombre)
    ]


def _build_diagnoses(items: list[DiagnosticoExtract]) -> list[ClinicalDocumentDiagnosis]:
    return [
        ClinicalDocumentDiagnosis(
            descripcion=item.descripcion,
            cie10=item.cie10,
            tipo=item.tipo,
            certeza=item.certeza,
            origen_cie10=item.origen_cie10,
            orden=orden,
        )
        for orden, item in enumerate(items)
    ]


def _build_professionals(items: list[ProfesionalExtract]) -> list[ClinicalDocumentProfessional]:
    return [
        ClinicalDocumentProfessional(
            nombre=item.nombre,
            identificacion=item.identificacion,
            registro_profesional=item.registro_profesional,
            especialidad=item.especialidad,
            rol=item.rol,
            orden=orden,
        )
        for orden, item in enumerate(i for i in items if i.nombre)
    ]


# Quién es "el médico" del documento para la bandeja: quien lo informa o firma antes que quien
# lo pidió; el destinatario de una derivación, solo si no hay otro.
_PRIORIDAD_ROL = {"INFORMANTE": 0, "TRATANTE": 1, "SOLICITANTE": 2, "OTRO": 3, "DESTINATARIO": 4}


def profesional_responsable(profesionales: list[ProfesionalExtract]) -> ProfesionalExtract | None:
    """Profesional que se muestra como responsable del documento."""
    con_nombre = [p for p in profesionales if p.nombre]
    return min(con_nombre, key=lambda p: _PRIORIDAD_ROL.get(p.rol, 3), default=None)


def apply_general_data(document: ClinicalDocument, datos: DatosGeneralesExtract) -> None:
    """Copia los datos generales a las columnas y (re)genera diagnósticos y profesionales."""
    paciente = datos.paciente
    identificacion = paciente.identificacion
    principal = datos.diagnostico_principal
    responsable = profesional_responsable(datos.profesionales)

    document.identificacion_paciente = identificacion.numero if identificacion else None
    document.tipo_identificacion = identificacion.tipo if identificacion and identificacion.numero else None
    document.pais_identificacion = identificacion.pais if identificacion else None
    document.nombre_paciente = paciente.nombre
    document.edad_paciente = paciente.edad
    document.fecha_nacimiento = paciente.fecha_nacimiento
    document.sexo = paciente.sexo
    document.numero_ficha = paciente.numero_ficha
    document.medico_nombre = responsable.nombre if responsable else None
    document.medico_identificacion = responsable.identificacion if responsable else None
    document.institucion_emisora = datos.institucion_emisora
    document.fecha_documento = datos.fecha_documento
    document.diagnostico_principal = principal.descripcion if principal else None
    document.cie10_sugerido = principal.cie10 if principal else None
    document.cie10_origen = principal.origen_cie10 if principal else None
    document.diagnoses = _build_diagnoses(datos.diagnosticos)
    document.professionals = _build_professionals(datos.profesionales)


def _build_procedures(descripciones: list[str]) -> list[ClinicalDocumentProcedure]:
    """Construye las filas de procedimientos realizados de una Epicrisis."""
    return [
        ClinicalDocumentProcedure(descripcion=descripcion, orden=orden)
        for orden, descripcion in enumerate(descripciones)
    ]


def apply_clinical_detail(document: ClinicalDocument, detalle: DetalleClinicoExtract) -> None:
    """(Re)genera las tablas hijas normalizadas a partir de `detalle_clinico`.

    Se reasignan las colecciones completas: el cascade `delete-orphan` borra las filas
    anteriores cuando un auditor corrige el detalle clínico.
    """
    examenes = detalle.examenes_y_laboratorio
    internacion = detalle.procedimientos_e_internacion
    document.medications = _build_medications(detalle.medicamentos or [])
    document.requested_exams = _build_requested_exams(detalle.examenes_solicitados or [])
    document.lab_panels = _build_lab_panels(examenes.paneles if examenes else [])
    document.procedures = _build_procedures(
        internacion.procedimientos_realizados if internacion else []
    )


async def ingest_document(
    payload: IngestPayload, db: AsyncSession, uploaded_by: User | None = None
) -> ClinicalDocument:
    """Procesa un documento clínico: lo respalda en OCI, lo clasifica y lo persiste en PostgreSQL.

    El resultado del triaje (`estado` y `motivos_auditoria`) y quién subió el documento quedan
    en `raw_extracted_json["triaje"]`, que es también el JSON que se guarda en OCI.
    """
    logger.info("Iniciando ingesta del documento %s", payload.documento_id)

    try:
        decoded_archivos = [
            (archivo, base64.b64decode(archivo.archivo_base64, validate=True))
            for archivo in payload.archivos
        ]
    except (binascii.Error, ValueError) as exc:
        logger.error("archivo_base64 inválido para el documento %s", payload.documento_id)
        raise InvalidBase64Error("El campo archivo_base64 no contiene un base64 válido") from exc

    try:
        result = await db.execute(
            select(ClinicalDocument.estado).where(
                ClinicalDocument.documento_id == payload.documento_id
            )
        )
        estado_existente = result.scalar_one_or_none()
        tipos_activos = await active_document_types(db)
        colas_activas = await active_queue_codes(db)
    except SQLAlchemyError as exc:
        logger.exception("Fallo al consultar la base de datos para %s", payload.documento_id)
        raise DocumentIngestionError("No fue posible consultar la base de datos") from exc

    # Un reingreso dejaría objetos huérfanos en OCI (otra ruta de JSON, menos archivos) y
    # podría pisar una corrección humana: cada subida debe traer un `documento_id` nuevo.
    if estado_existente is not None:
        raise DocumentAlreadyExistsError(
            f"El documento {payload.documento_id} ya fue ingresado (estado {estado_existente})"
        )

    preparada = preparar_extraccion(payload)
    normalizado = preparada.payload
    motivos_auditoria = _audit_reasons(preparada, tipos_activos, colas_activas)
    estado, json_path, requiere_auditoria = _resolve_routing(preparada, motivos_auditoria)
    logger.info(
        "Documento %s clasificado como %s (score %s, prioridad %s)",
        payload.documento_id,
        normalizado.clasificacion.tipo_documento,
        preparada.score.score,
        preparada.nivel_prioridad,
    )
    for ajuste in preparada.ajustes:
        logger.info("Documento %s: %s", payload.documento_id, ajuste)
    if motivos_auditoria:
        logger.info("Documento %s a auditoría: %s", payload.documento_id, motivos_auditoria)

    uploaded_objects: list[str] = []
    binary_paths: list[str] = []
    try:
        for orden, (archivo, binary_content) in enumerate(decoded_archivos):
            extension, content_type = _FORMATO_POR_TIPO_ARCHIVO[archivo.tipo_archivo]
            binary_path = f"recibidos/{payload.documento_id}/{orden}.{extension}"
            await oci_storage_client.upload_object(
                binary_path, binary_content, content_type=content_type
            )
            uploaded_objects.append(binary_path)
            binary_paths.append(binary_path)
        logger.info(
            "%d archivo(s) original(es) subidos a OCI para %s", len(binary_paths), payload.documento_id
        )

        # Los binarios ya están en OCI: el JSON solo los referencia por ruta, sin el base64
        # (si no, cada archivo quedaría triplicado en OCI y en `raw_extracted_json`).
        extraction_payload = normalizado.model_dump(mode="json", exclude={"archivos"})
        extraction_payload["archivos"] = [
            {"tipo_archivo": archivo.tipo_archivo, "rol": archivo.rol, "ruta_oci": path}
            for archivo, path in zip(payload.archivos, binary_paths, strict=True)
        ]
        extraction_payload["triaje"] = {
            "estado": estado,
            "score_confianza": preparada.score.score,
            "score_ia": payload.clasificacion.score_confianza_clasificacion,
            "score_detalle": preparada.score.motivos,
            "ajustes": preparada.ajustes,
            "motivos_auditoria": motivos_auditoria,
            "uploaded_by_id": str(uploaded_by.id) if uploaded_by else None,
            "uploaded_by_username": uploaded_by.username if uploaded_by else None,
            "area_origen_codigo": uploaded_by.area.codigo if uploaded_by and uploaded_by.area else None,
        }
        extraction_json = json.dumps(extraction_payload, ensure_ascii=False).encode("utf-8")
        await oci_storage_client.upload_object(
            json_path, extraction_json, content_type="application/json"
        )
        uploaded_objects.append(json_path)
        logger.info("JSON de extracción subido a OCI: %s", json_path)
    except Exception as exc:
        logger.exception("Fallo al subir archivos a OCI para el documento %s", payload.documento_id)
        await _compensate_uploads(uploaded_objects)
        raise DocumentIngestionError(
            "No fue posible almacenar los archivos del documento en OCI Object Storage"
        ) from exc

    document_fields = {
        "estado": estado,
        "tipo_documento": normalizado.clasificacion.tipo_documento,
        "especialidad": normalizado.clasificacion.especialidad,
        "nivel_prioridad": preparada.nivel_prioridad,
        "score_confianza": Decimal(str(preparada.score.score)),
        "requiere_auditoria": requiere_auditoria,
        "destino_enrutamiento": normalizado.decision_enrutamiento.destino_principal,
        "justificacion_enrutamiento": normalizado.decision_enrutamiento.justificacion_enrutamiento,
        "oci_bucket_name": settings.OCI_BUCKET_NAME,
        "oci_json_path": json_path,
        "uploaded_by_id": uploaded_by.id if uploaded_by else None,
        "area_origen_id": uploaded_by.area_id if uploaded_by else None,
        # Persistimos el payload íntegro (incluye el texto libre de `detalle_clinico`, ej.
        # hallazgos de imagenología o evolución de una epicrisis) para no perder información
        # clínica que no tiene columna ni tabla relacional propia.
        "raw_extracted_json": extraction_payload,
    }

    try:
        document = ClinicalDocument(documento_id=payload.documento_id, **document_fields)
        db.add(document)
        document.attachments = _build_attachments(payload.archivos, binary_paths)
        apply_general_data(document, normalizado.datos_generales)
        apply_clinical_detail(document, normalizado.detalle_clinico)

        await db.commit()
        await db.refresh(document)
    except SQLAlchemyError as exc:
        logger.exception(
            "Fallo al persistir el documento %s en PostgreSQL", payload.documento_id
        )
        await db.rollback()
        await _compensate_uploads(uploaded_objects)
        raise DocumentIngestionError(
            "No fue posible registrar el documento en la base de datos"
        ) from exc

    logger.info(
        "Documento %s ingresado correctamente con estado %s", payload.documento_id, estado
    )
    return document


def _identificacion_buscada(valor: str | None) -> str | None:
    """La identificación tal como se guarda (sin puntos, con guion en el RUT), para que el filtro
    funcione aunque el usuario la escriba con formato (`12.345.678-5`)."""
    normalizada = normalizar_identificacion(None, valor)
    return normalizada.numero if normalizada else None


async def get_paginated_documents(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    estado: str | None = None,
    destino: str | None = None,
    identificacion: str | None = None,
    numero_ficha: str | None = None,
    prioridad: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    uploaded_by_id: UUID | None = None,
    area_origen_id: UUID | None = None,
) -> dict:
    """Lista la bandeja documental con filtros dinámicos y paginación (se omite cada filtro en `None`)."""
    filters = (
        (ClinicalDocument.uploaded_by_id, operator.eq, uploaded_by_id),
        (ClinicalDocument.area_origen_id, operator.eq, area_origen_id),
        (ClinicalDocument.estado, operator.eq, estado),
        (ClinicalDocument.destino_enrutamiento, operator.eq, destino),
        (ClinicalDocument.identificacion_paciente, operator.eq, _identificacion_buscada(identificacion)),
        (ClinicalDocument.numero_ficha, operator.eq, numero_ficha),
        (ClinicalDocument.nivel_prioridad, operator.eq, prioridad),
        (ClinicalDocument.created_at, operator.ge, fecha_desde),
        (ClinicalDocument.created_at, operator.le, fecha_hasta),
    )
    conditions = [compare(column, value) for column, compare, value in filters if value is not None]

    total_result = await db.execute(
        select(func.count(ClinicalDocument.id)).where(*conditions)
    )
    total = total_result.scalar_one()

    # La bandeja solo muestra columnas del documento (y su área, por JOIN): no se cargan las
    # tablas hijas (selectin).
    items_result = await db.execute(
        select(ClinicalDocument)
        .options(
            noload(ClinicalDocument.attachments),
            noload(ClinicalDocument.medications),
            noload(ClinicalDocument.lab_panels),
            noload(ClinicalDocument.procedures),
        )
        .where(*conditions)
        .order_by(ClinicalDocument.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = items_result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
