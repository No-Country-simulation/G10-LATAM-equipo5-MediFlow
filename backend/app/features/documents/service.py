"""Lógica de negocio de ingesta y consulta de documentos clínicos."""

import base64
import binascii
import json
import logging
import math
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
from app.features.documents.models import (
    ClinicalDocument,
    ClinicalDocumentAttachment,
    ClinicalDocumentMedication,
    ClinicalDocumentProcedure,
    LabPanel,
    LabParameter,
)
from app.features.documents.schemas import (
    ArchivoAdjunto,
    DetalleClinicoExtract,
    IngestPayload,
    MedicamentoItem,
    PanelLaboratorio,
)
from app.shared.oci_client import oci_storage_client

logger = logging.getLogger(__name__)

SCORE_CONFIANZA_THRESHOLD = 0.85

TIPO_NO_CLASIFICABLE = "OTRO"
BLOQUE_CAMPOS_ADICIONALES = "campos_adicionales"

# (extensión, content-type) con que se guarda cada `tipo_archivo` en OCI.
_FORMATO_POR_TIPO_ARCHIVO = {
    "PDF": ("pdf", "application/pdf"),
    "PNG": ("png", "image/png"),
    "JPG": ("jpg", "image/jpeg"),
    "TIFF": ("tiff", "image/tiff"),
    "DCM": ("dcm", "application/dicom"),
}

# Bloque de `detalle_clinico` que corresponde a cada `codigo` de tipo semilla. Un tipo que no
# está aquí (OTRO o uno creado desde el mantenedor) no lleva bloque fijo. Además, cualquier tipo
# con `campos_extraccion` en el catálogo admite el bloque genérico `campos_adicionales`.
BLOQUE_POR_TIPO = {
    "RECETA": "medicamentos",
    "LABORATORIO": "examenes_y_laboratorio",
    "IMAGENES": "informe_imagenologico",
    "SOLICITUD_PROCEDIMIENTO": "solicitud_procedimiento",
    "EPICRISIS": "procedimientos_e_internacion",
    "INTERCONSULTA": "interconsulta",
    "ANATOMIA_PATOLOGICA": "anatomia_patologica",
    "PROTOCOLO_OPERATORIO": "protocolo_operatorio",
    "NOTA_ATENCION": "nota_atencion_ambulatoria",
}


class InvalidBase64Error(ValueError):
    """El contenido base64 del archivo enviado en el payload es inválido."""


class DocumentIngestionError(RuntimeError):
    """Fallo irrecuperable durante la ingesta del documento (OCI Storage o base de datos)."""


class DocumentAlreadyExistsError(RuntimeError):
    """El `documento_id` ya fue ingresado: n8n debe generar uno nuevo por cada subida."""


def _audit_reasons(
    payload: IngestPayload,
    tipos_activos: dict[str, dict[str, Any] | None],
    colas_activas: set[str],
) -> list[str]:
    """Reúne los motivos por los que el documento debe pasar por auditoría humana (vacío si ninguno).

    `tipos_activos` mapea cada `codigo` activo a su `campos_extraccion` (JSON Schema o `None`).
    """
    clasificacion = payload.clasificacion
    tipo = clasificacion.tipo_documento
    destino = payload.decision_enrutamiento.destino_principal
    motivos: list[str] = []

    if clasificacion.score_confianza_clasificacion < SCORE_CONFIANZA_THRESHOLD:
        motivos.append(
            f"Score de confianza {clasificacion.score_confianza_clasificacion} menor al umbral "
            f"{SCORE_CONFIANZA_THRESHOLD}"
        )
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
    permitidos = [b for b in (BLOQUE_POR_TIPO.get(tipo),) if b]
    if esquema is not None:
        permitidos.append(BLOQUE_CAMPOS_ADICIONALES)
    bloques = [
        nombre for nombre in type(detalle).model_fields if getattr(detalle, nombre) is not None
    ]
    inesperados = [b for b in bloques if b not in permitidos]
    if inesperados:
        problemas.append(
            f"detalle_clinico trae {inesperados} pero el tipo '{tipo}' espera "
            f"{permitidos or 'ningún bloque'}"
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
    payload: IngestPayload, motivos_auditoria: list[str]
) -> tuple[str, str, bool]:
    """Aplica la regla de triaje y retorna (estado, ruta_json_oci, requiere_auditoria)."""
    documento_id = payload.documento_id
    if motivos_auditoria:
        return "PENDIENTE_AUDITORIA", f"auditoria_humana/{documento_id}.json", True

    nivel = payload.clasificacion.nivel_prioridad.lower()
    return "PROCESADO", f"procesados/{nivel}/{documento_id}.json", False


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
    """Construye las filas de medicamentos de una Receta (lista vacía si no aplica)."""
    return [
        ClinicalDocumentMedication(
            nombre=item.nombre,
            dosis=item.dosis,
            duracion_tratamiento=item.duracion_tratamiento,
            orden=orden,
        )
        for orden, item in enumerate(items)
    ]


def _build_lab_panels(paneles: list[PanelLaboratorio]) -> list[LabPanel]:
    """Construye los paneles (y sus parámetros anidados) de un Informe de Laboratorio."""
    return [
        LabPanel(
            nombre_panel=panel.nombre_panel,
            orden=panel_orden,
            parametros=[
                LabParameter(
                    nombre=parametro.nombre,
                    valor=parametro.valor,
                    unidad=parametro.unidad,
                    rango_referencia=parametro.rango_referencia,
                    alterado=parametro.alterado,
                    orden=parametro_orden,
                )
                for parametro_orden, parametro in enumerate(panel.parametros)
            ],
        )
        for panel_orden, panel in enumerate(paneles)
    ]


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

    motivos_auditoria = _audit_reasons(payload, tipos_activos, colas_activas)
    estado, json_path, requiere_auditoria = _resolve_routing(payload, motivos_auditoria)
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
        extraction_payload = payload.model_dump(mode="json", exclude={"archivos"})
        extraction_payload["archivos"] = [
            {"tipo_archivo": archivo.tipo_archivo, "rol": archivo.rol, "ruta_oci": path}
            for archivo, path in zip(payload.archivos, binary_paths, strict=True)
        ]
        extraction_payload["triaje"] = {
            "estado": estado,
            "motivos_auditoria": motivos_auditoria,
            "uploaded_by_id": str(uploaded_by.id) if uploaded_by else None,
            "uploaded_by_username": uploaded_by.username if uploaded_by else None,
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
        "rut_paciente": payload.datos_generales.paciente.rut,
        "nombre_paciente": payload.datos_generales.paciente.nombre,
        "edad_paciente": payload.datos_generales.paciente.edad,
        "medico_nombre": payload.datos_generales.medico_solicitante.nombre,
        "medico_rut": payload.datos_generales.medico_solicitante.rut,
        "tipo_documento": payload.clasificacion.tipo_documento,
        "especialidad": payload.clasificacion.especialidad,
        "nivel_prioridad": payload.clasificacion.nivel_prioridad,
        "score_confianza": Decimal(str(payload.clasificacion.score_confianza_clasificacion)),
        "requiere_auditoria": requiere_auditoria,
        "diagnostico_principal": payload.datos_generales.diagnostico_principal,
        "cie10_sugerido": payload.datos_generales.cie10_sugerido,
        "destino_enrutamiento": payload.decision_enrutamiento.destino_principal,
        "justificacion_enrutamiento": payload.decision_enrutamiento.justificacion_enrutamiento,
        "oci_bucket_name": settings.OCI_BUCKET_NAME,
        "oci_json_path": json_path,
        "uploaded_by_id": uploaded_by.id if uploaded_by else None,
        # Persistimos el payload íntegro (incluye el texto libre de `detalle_clinico`, ej.
        # hallazgos de imagenología o evolución de una epicrisis) para no perder información
        # clínica que no tiene columna ni tabla relacional propia.
        "raw_extracted_json": extraction_payload,
    }

    try:
        document = ClinicalDocument(documento_id=payload.documento_id, **document_fields)
        db.add(document)
        document.attachments = _build_attachments(payload.archivos, binary_paths)
        apply_clinical_detail(document, payload.detalle_clinico)

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


async def get_paginated_documents(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    estado: str | None = None,
    destino: str | None = None,
    rut: str | None = None,
    prioridad: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    uploaded_by_id: UUID | None = None,
) -> dict:
    """Lista la bandeja documental con filtros dinámicos y paginación."""
    conditions = []
    if uploaded_by_id is not None:
        conditions.append(ClinicalDocument.uploaded_by_id == uploaded_by_id)
    if estado is not None:
        conditions.append(ClinicalDocument.estado == estado)
    if destino is not None:
        conditions.append(ClinicalDocument.destino_enrutamiento == destino)
    if rut is not None:
        conditions.append(ClinicalDocument.rut_paciente == rut)
    if prioridad is not None:
        conditions.append(ClinicalDocument.nivel_prioridad == prioridad)
    if fecha_desde is not None:
        conditions.append(ClinicalDocument.created_at >= fecha_desde)
    if fecha_hasta is not None:
        conditions.append(ClinicalDocument.created_at <= fecha_hasta)

    total_result = await db.execute(
        select(func.count(ClinicalDocument.id)).where(*conditions)
    )
    total = total_result.scalar_one()

    # La bandeja solo muestra columnas del documento: no se cargan las tablas hijas (selectin).
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
