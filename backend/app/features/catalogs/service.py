"""Lógica de negocio de los catálogos: CRUD de colas y tipos de documento con Smart Delete."""

import logging
from typing import TypeVar
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalogs.models import DocumentType, RoutingQueue
from app.features.catalogs.schemas import (
    DeletionType,
    DocumentTypeCreate,
    DocumentTypeUpdate,
    QueueCreate,
    QueueUpdate,
)
from app.features.documents.models import ClinicalDocument

logger = logging.getLogger(__name__)

CatalogEntity = TypeVar("CatalogEntity", RoutingQueue, DocumentType)


# --- Helpers genéricos -------------------------------------------------------


async def _get_or_404(
    db: AsyncSession, model: type[CatalogEntity], entity_id: UUID, label: str
) -> CatalogEntity:
    entity = await db.get(model, entity_id)
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} no encontrado(a)")
    return entity


async def _list(
    db: AsyncSession, model: type[CatalogEntity], is_active: bool | None
) -> list[CatalogEntity]:
    stmt = select(model).order_by(model.nombre)
    if is_active is not None:
        stmt = stmt.where(model.is_active == is_active)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _persist(db: AsyncSession, entity: CatalogEntity, label: str) -> CatalogEntity:
    """Hace commit y refresca la entidad, traduciendo un `codigo` duplicado a 409."""
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un(a) {label} con el código '{entity.codigo}'",
        ) from exc
    await db.refresh(entity)
    return entity


def _apply_update(entity: CatalogEntity, payload: BaseModel) -> None:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entity, field, value)


async def _smart_delete(
    db: AsyncSession, entity: CatalogEntity, usage_filter: ColumnElement[bool], label: str
) -> tuple[DeletionType, str]:
    """Borra físicamente si ningún documento clínico usa la entidad; si no, la desactiva."""
    usage = await db.execute(select(func.count(ClinicalDocument.id)).where(usage_filter))
    count: int = usage.scalar_one()

    if count == 0:
        await db.delete(entity)
        result: tuple[DeletionType, str] = (
            "HARD_DELETE",
            f"{label} eliminado(a) físicamente de la base de datos",
        )
    else:
        entity.is_active = False
        result = (
            "SOFT_DELETE",
            f"{label} desactivado(a) lógicamente debido a que tiene {count} "
            "documento(s) clínico(s) asociado(s)",
        )

    await db.commit()
    logger.info("Smart delete de %s '%s': %s", label, entity.codigo, result[0])
    return result


# --- Colas de enrutamiento ---------------------------------------------------

_QUEUE = "Cola"


async def get_active_queues_for_llm(db: AsyncSession) -> list[RoutingQueue]:
    """Colas activas, en el formato mínimo que necesita el prompt de n8n."""
    result = await db.execute(
        select(RoutingQueue).where(RoutingQueue.is_active.is_(True)).order_by(RoutingQueue.codigo)
    )
    return list(result.scalars().all())


async def list_queues(db: AsyncSession, is_active: bool | None = None) -> list[RoutingQueue]:
    return await _list(db, RoutingQueue, is_active)


async def get_queue(queue_id: UUID, db: AsyncSession) -> RoutingQueue:
    return await _get_or_404(db, RoutingQueue, queue_id, _QUEUE)


async def create_queue(payload: QueueCreate, db: AsyncSession) -> RoutingQueue:
    queue = RoutingQueue(**payload.model_dump())
    db.add(queue)
    return await _persist(db, queue, _QUEUE)


async def update_queue(queue_id: UUID, payload: QueueUpdate, db: AsyncSession) -> RoutingQueue:
    queue = await _get_or_404(db, RoutingQueue, queue_id, _QUEUE)
    _apply_update(queue, payload)
    return await _persist(db, queue, _QUEUE)


async def smart_delete_queue(queue_id: UUID, db: AsyncSession) -> tuple[DeletionType, str]:
    queue = await _get_or_404(db, RoutingQueue, queue_id, _QUEUE)
    return await _smart_delete(
        db, queue, ClinicalDocument.destino_enrutamiento == queue.codigo, _QUEUE
    )


# --- Tipos de documento ------------------------------------------------------

_DOC_TYPE = "Tipo de documento"


async def get_active_document_types_for_llm(db: AsyncSession) -> list[DocumentType]:
    """Tipos de documento activos, en el formato mínimo que necesita el prompt de n8n."""
    result = await db.execute(
        select(DocumentType).where(DocumentType.is_active.is_(True)).order_by(DocumentType.codigo)
    )
    return list(result.scalars().all())


async def list_document_types(
    db: AsyncSession, is_active: bool | None = None
) -> list[DocumentType]:
    return await _list(db, DocumentType, is_active)


async def get_document_type(type_id: UUID, db: AsyncSession) -> DocumentType:
    return await _get_or_404(db, DocumentType, type_id, _DOC_TYPE)


async def create_document_type(payload: DocumentTypeCreate, db: AsyncSession) -> DocumentType:
    doc_type = DocumentType(**payload.model_dump())
    db.add(doc_type)
    return await _persist(db, doc_type, _DOC_TYPE)


async def update_document_type(
    type_id: UUID, payload: DocumentTypeUpdate, db: AsyncSession
) -> DocumentType:
    doc_type = await _get_or_404(db, DocumentType, type_id, _DOC_TYPE)
    _apply_update(doc_type, payload)
    return await _persist(db, doc_type, _DOC_TYPE)


async def smart_delete_document_type(type_id: UUID, db: AsyncSession) -> tuple[DeletionType, str]:
    doc_type = await _get_or_404(db, DocumentType, type_id, _DOC_TYPE)
    return await _smart_delete(
        db, doc_type, ClinicalDocument.tipo_documento == doc_type.nombre, _DOC_TYPE
    )
