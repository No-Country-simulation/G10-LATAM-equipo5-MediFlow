"""Eliminación lógica de documentos (solo ADMIN) y su restauración.

El documento no se borra de la base ni de OCI: pasa a estado ELIMINADO con quién, cuándo y por qué,
y sale de todos los listados (Expedientes, Triaje, Auditoría, inicio, detección de duplicados). Se
puede restaurar al estado que tenía. Ambas acciones quedan en el historial del documento.
"""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.audit.service import _registrar_correccion
from app.features.auth.models import User
from app.features.documents.models import ESTADO_ELIMINADO, ClinicalDocument

logger = logging.getLogger(__name__)

ORIGEN_ELIMINACION = "ELIMINACION"
ORIGEN_RESTAURACION = "RESTAURACION"


async def _get_document_or_404(documento_id: str, db: AsyncSession) -> ClinicalDocument:
    result = await db.execute(select(ClinicalDocument).where(ClinicalDocument.documento_id == documento_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el documento {documento_id}",
        )
    return document


def _cambio_estado(antes: str | None, despues: str | None) -> list[dict]:
    return [{"campo": "estado", "etiqueta": "Estado", "antes": antes, "despues": despues}]


async def delete_document(documento_id: str, motivo: str, user: User, db: AsyncSession) -> ClinicalDocument:
    """Elimina lógicamente el documento. `409` si ya estaba eliminado."""
    document = await _get_document_or_404(documento_id, db)
    if document.estado == ESTADO_ELIMINADO:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El documento ya está eliminado")

    ahora = datetime.now(timezone.utc)
    anterior = document.estado
    document.estado_previo = anterior
    document.estado = ESTADO_ELIMINADO
    document.eliminado_por_id = user.id
    document.eliminado_por_username = user.username
    document.eliminado_at = ahora
    document.motivo_eliminacion = motivo
    # Si estaba tomado en la auditoría, se libera.
    document.asignado_a_id = None
    document.asignado_a_username = None
    document.asignado_at = None
    _registrar_correccion(
        document,
        origen=ORIGEN_ELIMINACION,
        justificacion=motivo,
        cambios=_cambio_estado(anterior, ESTADO_ELIMINADO),
        user=user,
        corrected_at=ahora,
    )
    await db.commit()
    await db.refresh(document)
    logger.warning("Documento %s eliminado por %s (estado previo %s)", documento_id, user.username, anterior)
    return document


async def restore_document(documento_id: str, motivo: str, user: User, db: AsyncSession) -> ClinicalDocument:
    """Restaura el documento al estado que tenía antes de eliminarlo. `409` si no está eliminado."""
    document = await _get_document_or_404(documento_id, db)
    if document.estado != ESTADO_ELIMINADO:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El documento no está eliminado")

    restaurado = document.estado_previo or "PROCESADO"
    document.estado = restaurado
    document.estado_previo = None
    document.eliminado_por_id = None
    document.eliminado_por_username = None
    document.eliminado_at = None
    document.motivo_eliminacion = None
    _registrar_correccion(
        document,
        origen=ORIGEN_RESTAURACION,
        justificacion=motivo,
        cambios=_cambio_estado(ESTADO_ELIMINADO, restaurado),
        user=user,
        corrected_at=datetime.now(timezone.utc),
    )
    await db.commit()
    await db.refresh(document)
    logger.warning("Documento %s restaurado a %s por %s", documento_id, restaurado, user.username)
    return document
