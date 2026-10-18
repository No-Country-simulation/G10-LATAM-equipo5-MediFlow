"""Detalle de un documento clínico: archivos originales con URL pre-firmada y detalle clínico.

El detalle clínico se arma desde dos fuentes:

- `tablas`: las tablas hijas normalizadas (diagnósticos, profesionales, medicamentos, exámenes
  solicitados, paneles de laboratorio, procedimientos).
- `campos_relevantes`: los campos de texto del bloque del tipo en `raw_extracted_json`, que no
  tienen tabla propia (hallazgos de imagenología, evolución de una epicrisis, etc.). Para los
  tipos creados desde el mantenedor se usan sus `campos_adicionales`, con la etiqueta tomada del
  `title` de cada propiedad en el JSON Schema del catálogo.

Tanto las tablas como `raw_extracted_json["detalle_clinico"]` se actualizan al resolver una
auditoría o corregir el documento, así que el detalle refleja siempre la versión vigente. El
historial de esas correcciones viaja en `historial_correcciones`.
"""

import asyncio
import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.features.catalogs.models import DocumentType
from app.features.documents.models import ESTADO_ELIMINADO, ClinicalDocument, ClinicalDocumentAttachment
from app.features.documents.schemas import (
    TIPOS_ARCHIVO_PRINCIPAL,
    ArchivoDocumento,
    CampoRelevante,
    CorreccionResponse,
    DetalleDocumento,
    DiagnosticoExtract,
    DocumentDetailResponse,
    ExamenSolicitadoItem,
    MedicamentoItem,
    PanelLaboratorio,
    ProfesionalExtract,
    TablasClinicas,
)
from app.features.documents.duplicates import duplicados_visibles
from app.features.documents.forms import BLOQUE_CAMPOS_ADICIONALES, campos_escalares
from app.shared.oci_client import STORAGE_ERRORS, oci_storage_client

logger = logging.getLogger(__name__)

AVISO_ARCHIVOS_NO_DISPONIBLES = (
    "No fue posible generar el enlace de {cantidad} archivo(s) en OCI. "
    "Los datos clínicos están disponibles; intenta abrir los archivos más tarde."
)

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


def _campos_de_bloque(valores: dict[str, Any], definicion: list[tuple[str, str]]) -> list[CampoRelevante]:
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
    """Campos de texto no vacíos del detalle clínico, con su etiqueta (el `title` del esquema).

    Las etiquetas salen del mismo esquema que usan el formulario de auditoría y el prompt de n8n.
    """
    campos: list[CampoRelevante] = []
    for bloque, valores in detalle_clinico.items():
        if isinstance(valores, dict) and bloque != BLOQUE_CAMPOS_ADICIONALES:
            campos.extend(_campos_de_bloque(valores, campos_escalares(bloque)))

    adicionales = detalle_clinico.get(BLOQUE_CAMPOS_ADICIONALES)
    if isinstance(adicionales, dict):
        campos.extend(_campos_adicionales(adicionales, schema_adicionales))
    return campos


def build_tablas(document: ClinicalDocument) -> TablasClinicas:
    """Tablas clínicas del documento, desde las tablas hijas (cargadas con `selectin`)."""
    return TablasClinicas(
        diagnosticos=[DiagnosticoExtract.model_validate(d, from_attributes=True) for d in document.diagnoses],
        profesionales=[
            ProfesionalExtract.model_validate(p, from_attributes=True) for p in document.professionals
        ],
        examenes_solicitados=[
            ExamenSolicitadoItem.model_validate(e, from_attributes=True) for e in document.requested_exams
        ],
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
    db: AsyncSession,
    documento_id: str,
    alcance: ColumnElement[bool] | None,
    incluir_eliminados: bool = False,
) -> ClinicalDocument:
    """Busca el documento dentro del `alcance` del usuario (ver `visibility`; `None` = todos).

    Un documento fuera del alcance responde 404 (no 403) para no revelar qué identificadores existen.
    """
    stmt = select(ClinicalDocument).where(ClinicalDocument.documento_id == documento_id)
    if not incluir_eliminados:
        stmt = stmt.where(ClinicalDocument.estado != ESTADO_ELIMINADO)
    if alcance is not None:
        stmt = stmt.where(alcance)
    document = (await db.execute(stmt)).scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el documento {documento_id}",
        )
    return document


async def get_document_detail(
    documento_id: str,
    db: AsyncSession,
    alcance: ColumnElement[bool] | None = None,
    uploaded_by_id: UUID | None = None,
    incluir_eliminados: bool = False,
) -> DocumentDetailResponse:
    """Detalle completo de un documento.

    `uploaded_by_id` (OPERADOR) limita los duplicados informados a los que subió ese usuario.

    Si OCI no puede generar alguna URL, el detalle se entrega igual: ese archivo queda con
    `url = None` y `aviso_archivos` lo explica, para que el caso siga siendo revisable.
    """
    document = await _get_visible_document(db, documento_id, alcance, incluir_eliminados)

    raw: dict[str, Any] = document.raw_extracted_json or {}
    detalle_clinico: dict[str, Any] = raw.get("detalle_clinico") or {}
    schema_adicionales = (
        await _schema_campos_adicionales(db, document.tipo_documento)
        if detalle_clinico.get(BLOQUE_CAMPOS_ADICIONALES)
        else None
    )
    archivos, aviso = await _build_archivos(document.attachments)
    duplicados = await duplicados_visibles(db, raw, uploaded_by_id)

    return DocumentDetailResponse.model_validate(document).model_copy(
        update={
            "archivos": archivos,
            "aviso_archivos": aviso,
            "detalle": DetalleDocumento(
                tablas=build_tablas(document),
                campos_relevantes=build_campos_relevantes(detalle_clinico, schema_adicionales),
            ),
            "datos_generales": raw.get("datos_generales") or {},
            "detalle_clinico": detalle_clinico,
            "duplicados": duplicados,
            "historial_correcciones": [
                CorreccionResponse.model_validate(correccion) for correccion in document.corrections
            ],
        }
    )
