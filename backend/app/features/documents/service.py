"""Lógica de negocio de ingesta y consulta de documentos clínicos."""

import base64
import binascii
import json
import logging
import math
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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
    ClasificacionExtract,
    DecisionEnrutamientoExtract,
    IngestPayload,
    MedicamentoItem,
    PanelLaboratorio,
)
from app.shared.oci_client import oci_storage_client

logger = logging.getLogger(__name__)

SCORE_CONFIANZA_THRESHOLD = 0.85

_EXTENSION_BY_TIPO_ARCHIVO = {
    "PDF": "pdf",
    "IMAGEN": "png",
}


class InvalidBase64Error(ValueError):
    """El contenido base64 del archivo enviado en el payload es inválido."""


class DocumentIngestionError(RuntimeError):
    """Fallo irrecuperable durante la ingesta del documento (OCI Storage o base de datos)."""


def _resolve_extension(tipo_archivo: str) -> str:
    """Determina la extensión de archivo a partir del `tipo_archivo` declarado en el payload."""
    return _EXTENSION_BY_TIPO_ARCHIVO.get(tipo_archivo.upper(), tipo_archivo.lower())


def _resolve_routing(
    clasificacion: ClasificacionExtract,
    decision: DecisionEnrutamientoExtract,
    documento_id: str,
) -> tuple[str, str, bool]:
    """Aplica la regla de negocio de triaje y retorna (estado, ruta_json_oci, requiere_auditoria)."""
    if (
        clasificacion.score_confianza_clasificacion < SCORE_CONFIANZA_THRESHOLD
        or decision.requiere_auditoria_humana
    ):
        return "PENDIENTE_AUDITORIA", f"auditoria_humana/{documento_id}.json", True

    nivel = clasificacion.nivel_prioridad.lower()
    return "PROCESADO", f"procesados/{nivel}/{documento_id}.json", False


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


async def ingest_document(payload: IngestPayload, db: AsyncSession) -> ClinicalDocument:
    """Procesa un documento clínico: lo respalda en OCI, lo clasifica y lo persiste en PostgreSQL."""
    logger.info("Iniciando ingesta del documento %s", payload.documento_id)

    try:
        decoded_archivos = [
            (archivo, base64.b64decode(archivo.archivo_base64, validate=True))
            for archivo in payload.archivos
        ]
    except (binascii.Error, ValueError) as exc:
        logger.error("archivo_base64 inválido para el documento %s", payload.documento_id)
        raise InvalidBase64Error("El campo archivo_base64 no contiene un base64 válido") from exc

    estado, json_path, requiere_auditoria = _resolve_routing(
        payload.clasificacion, payload.decision_enrutamiento, payload.documento_id
    )

    uploaded_objects: list[str] = []
    binary_paths: list[str] = []
    try:
        for orden, (archivo, binary_content) in enumerate(decoded_archivos):
            extension = _resolve_extension(archivo.tipo_archivo)
            binary_path = f"recibidos/{payload.documento_id}/{orden}.{extension}"
            await oci_storage_client.upload_object(binary_path, binary_content)
            uploaded_objects.append(binary_path)
            binary_paths.append(binary_path)
        logger.info(
            "%d archivo(s) original(es) subidos a OCI para %s", len(binary_paths), payload.documento_id
        )

        extraction_payload = payload.model_dump(mode="json")
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
        # Persistimos el payload íntegro (incluye el texto libre de `detalle_clinico`, ej.
        # hallazgos de imagenología o evolución de una epicrisis) para no perder información
        # clínica que no tiene columna ni tabla relacional propia.
        "raw_extracted_json": extraction_payload,
    }

    detalle = payload.detalle_clinico
    examenes = detalle.examenes_y_laboratorio

    try:
        result = await db.execute(
            select(ClinicalDocument).where(ClinicalDocument.documento_id == payload.documento_id)
        )
        document = result.scalar_one_or_none()

        if document is None:
            document = ClinicalDocument(documento_id=payload.documento_id, **document_fields)
            db.add(document)
        else:
            for field, value in document_fields.items():
                setattr(document, field, value)

        # Reasignar las colecciones completas (en vez de solo agregar) para que un
        # re-ingreso del mismo `documento_id` reemplace el detalle clínico anterior en
        # lugar de acumularlo; el cascade `delete-orphan` se encarga de borrar lo viejo.
        document.attachments = _build_attachments(payload.archivos, binary_paths)
        document.medications = _build_medications(detalle.medicamentos or [])
        document.lab_panels = _build_lab_panels(examenes.paneles if examenes else [])
        document.procedures = _build_procedures(
            detalle.procedimientos_e_internacion.procedimientos_realizados
            if detalle.procedimientos_e_internacion
            else []
        )

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
) -> dict:
    """Lista la bandeja documental con filtros dinámicos y paginación."""
    conditions = []
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

    items_result = await db.execute(
        select(ClinicalDocument)
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
