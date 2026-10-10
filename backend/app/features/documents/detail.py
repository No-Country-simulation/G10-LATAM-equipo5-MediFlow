"""Detalle de un documento clínico: archivos originales con URL pre-firmada y detalle clínico.

El detalle clínico se arma desde dos fuentes:

- `tablas`: las tablas hijas normalizadas (medicamentos, paneles de laboratorio, procedimientos).
- `campos_relevantes`: los campos de texto del bloque del tipo en `raw_extracted_json`, que no
  tienen tabla propia (hallazgos de imagenología, evolución de una epicrisis, etc.). Para los
  tipos creados desde el mantenedor se usan sus `campos_adicionales`, con la etiqueta tomada del
  `title` de cada propiedad en el JSON Schema del catálogo.

Tanto las tablas como `raw_extracted_json["detalle_clinico"]` se actualizan al resolver una
auditoría, así que el detalle refleja siempre la versión vigente (corregida si la hubo).
"""

import asyncio
import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.features.catalogs.models import DocumentType
from app.features.documents.models import ClinicalDocument, ClinicalDocumentAttachment
from app.features.documents.schemas import (
    TIPOS_ARCHIVO_PRINCIPAL,
    ArchivoDocumento,
    CampoRelevante,
    DetalleDocumento,
    DocumentDetailResponse,
    MedicamentoItem,
    PanelLaboratorio,
    TablasClinicas,
)
from app.features.documents.service import BLOQUE_CAMPOS_ADICIONALES
from app.shared.oci_client import STORAGE_ERRORS, oci_storage_client

logger = logging.getLogger(__name__)

AVISO_ARCHIVOS_NO_DISPONIBLES = (
    "No fue posible generar el enlace de {cantidad} archivo(s) en OCI. "
    "Los datos clínicos están disponibles; intenta abrir los archivos más tarde."
)

# Campos de texto de cada bloque de `detalle_clinico` que se muestran, en orden, con su
# etiqueta. Las listas (medicamentos, paneles, procedimientos) no van aquí: salen de las tablas.
_CAMPOS_RELEVANTES: dict[str, tuple[tuple[str, str], ...]] = {
    "examenes_y_laboratorio": (
        ("estudio_solicitado", "Estudio solicitado"),
        ("conclusiones_o_hallazgos", "Conclusiones o hallazgos"),
    ),
    "procedimientos_e_internacion": (
        ("fecha_ingreso", "Fecha de ingreso"),
        ("fecha_alta", "Fecha de alta"),
        ("resumen_evolucion", "Resumen de la evolución"),
        ("antecedentes_relevantes", "Antecedentes relevantes"),
    ),
    "informe_imagenologico": (
        ("tecnica", "Técnica"),
        ("antecedentes", "Antecedentes"),
        ("hallazgos", "Hallazgos"),
        ("impresion_diagnostica", "Impresión diagnóstica"),
    ),
    "nota_atencion_ambulatoria": (
        ("motivo_consulta", "Motivo de consulta"),
        ("antecedentes", "Antecedentes"),
        ("anamnesis", "Anamnesis"),
        ("examen_fisico", "Examen físico"),
        ("diagnostico_referencia", "Diagnóstico de referencia"),
        ("diagnostico_atencion", "Diagnóstico de la atención"),
        ("indicaciones", "Indicaciones"),
    ),
    "solicitud_procedimiento": (
        ("procedimiento_solicitado", "Procedimiento solicitado"),
        ("indicacion_clinica", "Indicación clínica"),
        ("antecedentes", "Antecedentes"),
        ("fecha_solicitud", "Fecha de solicitud"),
    ),
    "interconsulta": (
        ("especialidad_destino", "Especialidad de destino"),
        ("establecimiento_destino", "Establecimiento de destino"),
        ("motivo_interconsulta", "Motivo de la interconsulta"),
        ("antecedentes_clinicos", "Antecedentes clínicos"),
    ),
    "anatomia_patologica": (
        ("tipo_muestra", "Tipo de muestra"),
        ("descripcion_macroscopica", "Descripción macroscópica"),
        ("descripcion_microscopica", "Descripción microscópica"),
        ("diagnostico_histopatologico", "Diagnóstico histopatológico"),
        ("malignidad", "Malignidad"),
    ),
    "protocolo_operatorio": (
        ("fecha_cirugia", "Fecha de la cirugía"),
        ("cirugia_realizada", "Cirugía realizada"),
        ("diagnostico_preoperatorio", "Diagnóstico preoperatorio"),
        ("tecnica", "Técnica"),
        ("hallazgos_intraoperatorios", "Hallazgos intraoperatorios"),
        ("complicaciones", "Complicaciones"),
        ("muestras_enviadas", "Muestras enviadas"),
    ),
}


# --- Archivos originales -----------------------------------------------------


async def create_preview_url(oci_path: str) -> str:
    """URL pre-firmada (PAR) de solo lectura para un objeto de OCI. Lanza el error de OCI si falla."""
    return await oci_storage_client.create_preauthenticated_request(
        oci_path, expire_minutes=settings.DOCUMENT_PREVIEW_URL_EXPIRE_MINUTES
    )


def attachment_fields(attachment: ClinicalDocumentAttachment) -> dict[str, Any]:
    """Campos comunes de un archivo en las respuestas (todo menos la URL)."""
    return {
        "orden": attachment.orden,
        "tipo_archivo": attachment.tipo_archivo,
        "rol": attachment.rol,
        "visualizable": attachment.tipo_archivo in TIPOS_ARCHIVO_PRINCIPAL,
    }


async def _preview_url_or_none(oci_path: str) -> str | None:
    try:
        return await create_preview_url(oci_path)
    except STORAGE_ERRORS:
        logger.warning("No se pudo generar la URL pre-firmada de %s", oci_path, exc_info=True)
        return None


async def _build_archivos(
    attachments: list[ClinicalDocumentAttachment],
) -> tuple[list[ArchivoDocumento], str | None]:
    """Archivos con su URL (pedidas en paralelo) y un aviso si alguna no se pudo generar."""
    urls = await asyncio.gather(*(_preview_url_or_none(a.oci_path) for a in attachments))
    archivos = [
        ArchivoDocumento(**attachment_fields(attachment), url=url)
        for attachment, url in zip(attachments, urls, strict=True)
    ]
    sin_url = sum(url is None for url in urls)
    aviso = AVISO_ARCHIVOS_NO_DISPONIBLES.format(cantidad=sin_url) if sin_url else None
    return archivos, aviso


# --- Detalle clínico ---------------------------------------------------------


def _is_empty(valor: Any) -> bool:
    return valor is None or valor in ("", [], {})


def _humanize(campo: str) -> str:
    """`fecha_control` -> `Fecha control`: etiqueta por defecto si el esquema no define `title`."""
    return campo.replace("_", " ").strip().capitalize()


def _campos_de_bloque(
    valores: dict[str, Any], definicion: tuple[tuple[str, str], ...]
) -> list[CampoRelevante]:
    return [
        CampoRelevante(campo=campo, etiqueta=etiqueta, valor=valores[campo])
        for campo, etiqueta in definicion
        if not _is_empty(valores.get(campo))
    ]


def _campos_adicionales(
    valores: dict[str, Any], schema: dict[str, Any] | None
) -> list[CampoRelevante]:
    propiedades: dict[str, Any] = (schema or {}).get("properties") or {}
    return [
        CampoRelevante(
            campo=campo,
            etiqueta=(propiedades.get(campo) or {}).get("title") or _humanize(campo),
            valor=valor,
        )
        for campo, valor in valores.items()
        if not _is_empty(valor)
    ]


def build_campos_relevantes(
    detalle_clinico: dict[str, Any], schema_adicionales: dict[str, Any] | None = None
) -> list[CampoRelevante]:
    """Campos de texto no vacíos del detalle clínico, con etiqueta, en el orden de `_CAMPOS_RELEVANTES`."""
    campos: list[CampoRelevante] = []
    for bloque, definicion in _CAMPOS_RELEVANTES.items():
        valores = detalle_clinico.get(bloque)
        if isinstance(valores, dict):
            campos.extend(_campos_de_bloque(valores, definicion))

    adicionales = detalle_clinico.get(BLOQUE_CAMPOS_ADICIONALES)
    if isinstance(adicionales, dict):
        campos.extend(_campos_adicionales(adicionales, schema_adicionales))
    return campos


def build_tablas(document: ClinicalDocument) -> TablasClinicas:
    """Tablas clínicas del documento, desde las tablas hijas (cargadas con `selectin`)."""
    return TablasClinicas(
        medicamentos=[
            MedicamentoItem.model_validate(item, from_attributes=True)
            for item in document.medications
        ],
        paneles_laboratorio=[
            PanelLaboratorio.model_validate(panel, from_attributes=True)
            for panel in document.lab_panels
        ],
        procedimientos=[procedure.descripcion for procedure in document.procedures],
    )


async def _schema_campos_adicionales(db: AsyncSession, tipo_documento: str) -> dict[str, Any] | None:
    result = await db.execute(
        select(DocumentType.campos_extraccion).where(DocumentType.codigo == tipo_documento)
    )
    return result.scalar_one_or_none()


# --- Caso de uso -------------------------------------------------------------


async def _get_visible_document(
    db: AsyncSession, documento_id: str, uploaded_by_id: UUID | None
) -> ClinicalDocument:
    """Busca el documento; con `uploaded_by_id` (OPERADOR) solo entre los que subió ese usuario.

    Un documento ajeno responde 404 (no 403) para no revelar qué identificadores existen.
    """
    stmt = select(ClinicalDocument).where(ClinicalDocument.documento_id == documento_id)
    if uploaded_by_id is not None:
        stmt = stmt.where(ClinicalDocument.uploaded_by_id == uploaded_by_id)
    document = (await db.execute(stmt)).scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el documento {documento_id}",
        )
    return document


async def get_document_detail(
    documento_id: str, db: AsyncSession, uploaded_by_id: UUID | None = None
) -> DocumentDetailResponse:
    """Detalle completo de un documento.

    Si OCI no puede generar alguna URL, el detalle se entrega igual: ese archivo queda con
    `url = None` y `aviso_archivos` lo explica, para que el caso siga siendo revisable.
    """
    document = await _get_visible_document(db, documento_id, uploaded_by_id)

    detalle_clinico: dict[str, Any] = (document.raw_extracted_json or {}).get("detalle_clinico") or {}
    schema_adicionales = (
        await _schema_campos_adicionales(db, document.tipo_documento)
        if detalle_clinico.get(BLOQUE_CAMPOS_ADICIONALES)
        else None
    )
    archivos, aviso = await _build_archivos(document.attachments)

    return DocumentDetailResponse.model_validate(document).model_copy(
        update={
            "archivos": archivos,
            "aviso_archivos": aviso,
            "detalle": DetalleDocumento(
                tablas=build_tablas(document),
                campos_relevantes=build_campos_relevantes(detalle_clinico, schema_adicionales),
            ),
        }
    )
