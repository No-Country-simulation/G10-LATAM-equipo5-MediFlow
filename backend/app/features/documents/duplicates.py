"""Detección de documentos duplicados.

Dos niveles, que se complementan:

- **Archivo idéntico**: misma huella SHA-256 de alguno de los archivos. Es certero, pero un
  re-escaneo o una nueva foto del mismo papel produce otra huella.
- **Contenido similar**: mismo paciente (identificación normalizada), mismo tipo y misma fecha
  del documento, y además la misma institución, el mismo CIE-10 o el mismo diagnóstico
  principal. Atrapa los re-escaneos; como no es certero, el documento va a auditoría para que una
  persona decida (y lo descarte como duplicado si corresponde).

Lo usan la consulta previa del frontend (antes de gastar en la IA) y la ingesta.
"""

import hashlib
from collections.abc import Iterable
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalogs.models import Area
from app.features.documents.models import ClinicalDocument, ClinicalDocumentAttachment
from app.features.documents.schemas import (
    CoincidenciaArchivo,
    DatosGeneralesExtract,
    DuplicadoDocumento,
)

ARCHIVO_IDENTICO = "ARCHIVO_IDENTICO"
CONTENIDO_SIMILAR = "CONTENIDO_SIMILAR"

MOTIVO_ARCHIVO_IDENTICO = "Archivo idéntico a otro documento ya registrado (posible duplicado)"
MOTIVO_CONTENIDO_SIMILAR = (
    "Posible duplicado: mismo paciente, tipo y fecha que otro documento ya registrado"
)

# Un documento descartado (no clínico, ilegible, duplicado) no cuenta como original.
_ESTADO_DESCARTADO = "DESCARTADO"
_MAX_CANDIDATOS = 20


def huella(contenido: bytes) -> str:
    """SHA-256 en hexadecimal (minúsculas) del contenido de un archivo."""
    return hashlib.sha256(contenido).hexdigest()


def _texto(valor: str | None) -> str | None:
    """Texto comparable: sin mayúsculas ni espacios extra; `None` si está vacío."""
    limpio = " ".join((valor or "").split()).casefold()
    return limpio or None


# --- Archivo idéntico --------------------------------------------------------


async def coincidencias_de_archivo(
    db: AsyncSession, huellas: Iterable[str], solicitante_id: UUID | None, ver_todo: bool
) -> list[CoincidenciaArchivo]:
    """Documentos con algún archivo de la misma huella, del más reciente al más antiguo.

    Si `ver_todo` es falso (OPERADOR), de los documentos ajenos solo se informa el área y la fecha.
    """
    huellas = list(dict.fromkeys(huellas))
    if not huellas:
        return []
    filas = (
        await db.execute(
            select(
                ClinicalDocumentAttachment.sha256,
                ClinicalDocument.documento_id,
                ClinicalDocument.estado,
                ClinicalDocument.created_at,
                ClinicalDocument.uploaded_by_id,
                Area.nombre,
            )
            .join(ClinicalDocument, ClinicalDocumentAttachment.document_id == ClinicalDocument.id)
            .outerjoin(Area, ClinicalDocument.area_origen_id == Area.id)
            .where(ClinicalDocumentAttachment.sha256.in_(huellas))
            .order_by(ClinicalDocument.created_at.desc())
            .limit(_MAX_CANDIDATOS)
        )
    ).all()

    coincidencias: list[CoincidenciaArchivo] = []
    for fila in filas:
        if not fila:  # tolera resultados vacíos de sesiones de prueba
            continue
        sha256, documento_id, estado, created_at, uploaded_by_id, area = fila
        propio = solicitante_id is not None and uploaded_by_id == solicitante_id
        visible = ver_todo or propio
        coincidencias.append(
            CoincidenciaArchivo(
                sha256=sha256,
                documento_id=documento_id if visible else None,
                estado=estado if visible else None,
                created_at=created_at,
                area_origen=area,
                propio=propio,
            )
        )
    return coincidencias


async def _documentos_con_huella(db: AsyncSession, huellas: list[str], excluir: str) -> list[str]:
    filas = (
        await db.execute(
            select(ClinicalDocument.documento_id)
            .join(ClinicalDocumentAttachment, ClinicalDocumentAttachment.document_id == ClinicalDocument.id)
            .where(
                ClinicalDocumentAttachment.sha256.in_(huellas),
                ClinicalDocument.documento_id != excluir,
            )
            .distinct()
            .limit(_MAX_CANDIDATOS)
        )
    ).scalars().all()
    return [documento_id for documento_id in filas if documento_id]


# --- Contenido similar -------------------------------------------------------


def _coincide_contenido(candidato: Any, datos: DatosGeneralesExtract) -> bool:
    """Además de paciente, tipo y fecha, debe coincidir la institución o el diagnóstico."""
    principal = datos.diagnostico_principal
    pares = (
        (_texto(candidato.institucion_emisora), _texto(datos.institucion_emisora)),
        (_texto(candidato.cie10_sugerido), _texto(principal.cie10 if principal else None)),
        (_texto(candidato.diagnostico_principal), _texto(principal.descripcion if principal else None)),
    )
    return any(existente and nuevo and existente == nuevo for existente, nuevo in pares)


async def _documentos_similares(
    db: AsyncSession, datos: DatosGeneralesExtract, tipo_documento: str, excluir: str
) -> list[str]:
    identificacion = datos.paciente.identificacion
    numero = identificacion.numero if identificacion else None
    fecha: date | None = datos.fecha_documento
    # Sin identificación o sin fecha la coincidencia sería demasiado débil: no se marca nada.
    if not numero or fecha is None:
        return []
    candidatos = (
        await db.execute(
            select(
                ClinicalDocument.documento_id,
                ClinicalDocument.institucion_emisora,
                ClinicalDocument.cie10_sugerido,
                ClinicalDocument.diagnostico_principal,
            )
            .where(
                ClinicalDocument.identificacion_paciente == numero,
                ClinicalDocument.tipo_documento == tipo_documento,
                ClinicalDocument.fecha_documento == fecha,
                ClinicalDocument.estado != _ESTADO_DESCARTADO,
                ClinicalDocument.documento_id != excluir,
            )
            .limit(_MAX_CANDIDATOS)
        )
    ).all()
    return [c.documento_id for c in candidatos if c and _coincide_contenido(c, datos)]


# --- Ingesta -----------------------------------------------------------------


async def detectar_duplicados(
    db: AsyncSession,
    *,
    documento_id: str,
    huellas: list[str],
    datos: DatosGeneralesExtract,
    tipo_documento: str,
) -> list[DuplicadoDocumento]:
    """Duplicados de un documento que se está ingiriendo (los idénticos primero)."""
    identicos = await _documentos_con_huella(db, huellas, documento_id)
    similares = await _documentos_similares(db, datos, tipo_documento, documento_id)
    return [
        *(DuplicadoDocumento(documento_id=d, tipo=ARCHIVO_IDENTICO) for d in identicos),
        *(
            DuplicadoDocumento(documento_id=d, tipo=CONTENIDO_SIMILAR)
            for d in dict.fromkeys(similares)
            if d not in identicos
        ),
    ]


def motivos_de_duplicados(duplicados: list[DuplicadoDocumento]) -> list[str]:
    """Motivos de auditoría. No nombran el otro documento: el motivo lo ve también quien subió
    este, que puede no tener acceso al original (los ID van en `triaje.duplicados`)."""
    tipos = {d.tipo for d in duplicados}
    motivos: list[str] = []
    if ARCHIVO_IDENTICO in tipos:
        motivos.append(MOTIVO_ARCHIVO_IDENTICO)
    if CONTENIDO_SIMILAR in tipos:
        motivos.append(MOTIVO_CONTENIDO_SIMILAR)
    return motivos


# --- Detalle -----------------------------------------------------------------


async def duplicados_visibles(
    db: AsyncSession, raw: dict[str, Any], uploaded_by_id: UUID | None
) -> list[DuplicadoDocumento]:
    """Duplicados guardados al ingerir; con `uploaded_by_id` (OPERADOR), solo los que subió él."""
    guardados = [
        DuplicadoDocumento.model_validate(d)
        for d in ((raw.get("triaje") or {}).get("duplicados") or [])
        if isinstance(d, dict)
    ]
    if not guardados or uploaded_by_id is None:
        return guardados
    propios = set(
        (
            await db.execute(
                select(ClinicalDocument.documento_id).where(
                    ClinicalDocument.documento_id.in_([d.documento_id for d in guardados]),
                    ClinicalDocument.uploaded_by_id == uploaded_by_id,
                )
            )
        ).scalars().all()
    )
    return [d for d in guardados if d.documento_id in propios]
