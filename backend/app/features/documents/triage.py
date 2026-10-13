"""Consola de Triaje: marcar un caso como atendido (sale de la consola) o deshacerlo.

No cambia el `estado` del documento: un caso atendido sigue siendo PROCESADO o AUDITADO y se
sigue viendo en Expedientes; solo deja de figurar entre los casos activos del triaje.
"""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.features.documents.models import ClinicalDocument

logger = logging.getLogger(__name__)

ESTADOS_ATENDIBLES = ("PROCESADO", "AUDITADO")


async def _get_document_or_404(documento_id: str, db: AsyncSession) -> ClinicalDocument:
    result = await db.execute(select(ClinicalDocument).where(ClinicalDocument.documento_id == documento_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el documento {documento_id}",
        )
    return document


async def mark_attended(documento_id: str, user: User, db: AsyncSession) -> ClinicalDocument:
    """Marca el caso como atendido. Si ya lo estaba, lo deja como está (conserva quién y cuándo)."""
    document = await _get_document_or_404(documento_id, db)
    if document.estado not in ESTADOS_ATENDIBLES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Solo se puede marcar como atendido un documento procesado o auditado",
        )
    if document.atendido_at is not None:
        return document

    document.atendido_por_id = user.id
    document.atendido_por_username = user.username
    document.atendido_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(document)
    logger.info("Caso %s marcado como atendido por %s", documento_id, user.username)
    return document


async def unmark_attended(documento_id: str, user: User, db: AsyncSession) -> ClinicalDocument:
    """Deshace la marca de atendido: el caso vuelve a la Consola de Triaje."""
    document = await _get_document_or_404(documento_id, db)
    if document.atendido_at is None:
        return document

    document.atendido_por_id = None
    document.atendido_por_username = None
    document.atendido_at = None
    await db.commit()
    await db.refresh(document)
    logger.info("Caso %s vuelve a la consola de triaje (desmarcado por %s)", documento_id, user.username)
    return document
