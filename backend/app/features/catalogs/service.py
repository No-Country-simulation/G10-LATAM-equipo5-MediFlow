"""Lógica de negocio de los catálogos: CRUD de colas y tipos de documento con Smart Delete.

Cada alta, cambio o borrado registra quién lo hizo (`updated_by_id`) y deja una entrada en
`catalog_history`: un cambio de descripción altera el comportamiento de la IA y debe poder
rastrearse. Los registros `es_sistema` no se pueden eliminar ni desactivar.
"""

import logging
from typing import Any, TypeVar
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.features.catalogs.models import CatalogHistory, DocumentType, RoutingQueue
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

_CATALOGO_POR_MODELO = {RoutingQueue: "QUEUE", DocumentType: "DOCUMENT_TYPE"}

# Campos que se registran en el historial (los demás son técnicos: id, timestamps, autor).
_CAMPOS_AUDITABLES = {
    RoutingQueue: ("codigo", "nombre", "descripcion_semantica", "notificar_inmediato", "is_active"),
    DocumentType: ("codigo", "nombre", "descripcion", "campos_extraccion", "is_active"),
}


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


def _snapshot(entity: CatalogEntity) -> dict[str, Any]:
    return {campo: getattr(entity, campo) for campo in _CAMPOS_AUDITABLES[type(entity)]}


def _record_history(
    db: AsyncSession,
    entity: CatalogEntity,
    accion: str,
    antes: dict[str, Any],
    despues: dict[str, Any],
    user: User,
) -> None:
    """Agrega a la sesión una entrada de historial con solo los campos que cambiaron."""
    cambios = {
        campo: {"antes": antes.get(campo), "despues": despues.get(campo)}
        for campo in {**antes, **despues}
        if antes.get(campo) != despues.get(campo)
    }
    if not cambios:
        return
    db.add(
        CatalogHistory(
            catalogo=_CATALOGO_POR_MODELO[type(entity)],
            registro_id=entity.id,
            codigo=entity.codigo,
            accion=accion,
            cambios=cambios,
            changed_by_id=user.id,
        )
    )


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


async def _create(
    db: AsyncSession, model: type[CatalogEntity], payload: BaseModel, user: User, label: str
) -> CatalogEntity:
    # El id se asigna aquí (y no en el flush) porque el historial lo necesita antes del commit.
    entity = model(
        id=uuid4(), **payload.model_dump(), is_active=True, es_sistema=False, updated_by_id=user.id
    )
    db.add(entity)
    _record_history(db, entity, "CREATE", {}, _snapshot(entity), user)
    return await _persist(db, entity, label)


def _ensure_not_system(entity: CatalogEntity, label: str, accion: str) -> None:
    if entity.es_sistema:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{label} '{entity.codigo}' es un registro de sistema del que depende el pipeline "
                f"y no se puede {accion}"
            ),
        )


async def _update(
    db: AsyncSession,
    model: type[CatalogEntity],
    entity_id: UUID,
    payload: BaseModel,
    user: User,
    label: str,
) -> CatalogEntity:
    entity = await _get_or_404(db, model, entity_id, label)
    updates = payload.model_dump(exclude_unset=True)
    if updates.get("is_active") is False:
        _ensure_not_system(entity, label, "desactivar")

    antes = _snapshot(entity)
    for field, value in updates.items():
        setattr(entity, field, value)
    entity.updated_by_id = user.id
    _record_history(db, entity, "UPDATE", antes, _snapshot(entity), user)
    return await _persist(db, entity, label)


async def _smart_delete(
    db: AsyncSession,
    model: type[CatalogEntity],
    entity_id: UUID,
    usage_column: ColumnElement[str],
    user: User,
    label: str,
) -> tuple[DeletionType, str]:
    """Borra físicamente si ningún documento clínico usa la entidad; si no, la desactiva."""
    entity = await _get_or_404(db, model, entity_id, label)
    _ensure_not_system(entity, label, "eliminar")

    usage = await db.execute(
        select(func.count(ClinicalDocument.id)).where(usage_column == entity.codigo)
    )
    count: int = usage.scalar_one()
    antes = _snapshot(entity)

    if count == 0:
        await db.delete(entity)
        _record_history(db, entity, "HARD_DELETE", antes, {}, user)
        result: tuple[DeletionType, str] = (
            "HARD_DELETE",
            f"{label} eliminado(a) físicamente de la base de datos",
        )
    else:
        entity.is_active = False
        entity.updated_by_id = user.id
        _record_history(db, entity, "SOFT_DELETE", antes, _snapshot(entity), user)
        result = (
            "SOFT_DELETE",
            f"{label} desactivado(a) lógicamente debido a que tiene {count} "
            "documento(s) clínico(s) asociado(s)",
        )

    await db.commit()
    logger.info("Smart delete de %s '%s': %s", label, entity.codigo, result[0])
    return result


async def _history(
    db: AsyncSession, model: type[CatalogEntity], entity_id: UUID
) -> list[CatalogHistory]:
    """Historial de un registro (más reciente primero). Funciona aunque el registro ya no exista."""
    result = await db.execute(
        select(CatalogHistory)
        .where(
            CatalogHistory.catalogo == _CATALOGO_POR_MODELO[model],
            CatalogHistory.registro_id == entity_id,
        )
        .order_by(CatalogHistory.changed_at.desc())
    )
    return list(result.scalars().all())


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


async def create_queue(payload: QueueCreate, db: AsyncSession, user: User) -> RoutingQueue:
    return await _create(db, RoutingQueue, payload, user, _QUEUE)


async def update_queue(
    queue_id: UUID, payload: QueueUpdate, db: AsyncSession, user: User
) -> RoutingQueue:
    return await _update(db, RoutingQueue, queue_id, payload, user, _QUEUE)


async def smart_delete_queue(
    queue_id: UUID, db: AsyncSession, user: User
) -> tuple[DeletionType, str]:
    return await _smart_delete(
        db, RoutingQueue, queue_id, ClinicalDocument.destino_enrutamiento, user, _QUEUE
    )


async def queue_history(queue_id: UUID, db: AsyncSession) -> list[CatalogHistory]:
    return await _history(db, RoutingQueue, queue_id)


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


async def create_document_type(
    payload: DocumentTypeCreate, db: AsyncSession, user: User
) -> DocumentType:
    return await _create(db, DocumentType, payload, user, _DOC_TYPE)


async def update_document_type(
    type_id: UUID, payload: DocumentTypeUpdate, db: AsyncSession, user: User
) -> DocumentType:
    return await _update(db, DocumentType, type_id, payload, user, _DOC_TYPE)


async def smart_delete_document_type(
    type_id: UUID, db: AsyncSession, user: User
) -> tuple[DeletionType, str]:
    return await _smart_delete(
        db, DocumentType, type_id, ClinicalDocument.tipo_documento, user, _DOC_TYPE
    )


async def document_type_history(type_id: UUID, db: AsyncSession) -> list[CatalogHistory]:
    return await _history(db, DocumentType, type_id)
