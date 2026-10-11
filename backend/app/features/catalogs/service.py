"""Lógica de negocio de los catálogos: CRUD de colas y tipos de documento con Smart Delete.

Cada alta, cambio o borrado registra quién lo hizo (`updated_by_id`) y deja una entrada en
`catalog_history`: un cambio de descripción altera el comportamiento de la IA y debe poder
rastrearse. Los registros `es_sistema` no se pueden eliminar ni desactivar.
"""

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Any, TypeVar
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import User
from app.features.catalogs.models import Area, CatalogHistory, DocumentType, RoutingQueue
from app.features.catalogs.schemas import (
    AreaCreate,
    AreaUpdate,
    DeletionType,
    DocumentFormsResponse,
    DocumentTypeForm,
    DocumentTypeCreate,
    DocumentTypeUpdate,
    QueueCreate,
    QueueUpdate,
)
from app.features.documents.forms import (
    esquema_datos_generales,
    esquemas_listas_comunes,
    formulario_de_tipo,
)
from app.features.documents.models import ClinicalDocument

logger = logging.getLogger(__name__)

CatalogEntity = TypeVar("CatalogEntity", RoutingQueue, DocumentType, Area)

_CATALOGO_POR_MODELO = {RoutingQueue: "QUEUE", DocumentType: "DOCUMENT_TYPE", Area: "AREA"}

# Campos que se registran en el historial (los demás son técnicos: id, timestamps, autor).
_CAMPOS_AUDITABLES = {
    RoutingQueue: ("codigo", "nombre", "descripcion_semantica", "notificar_inmediato", "is_active"),
    DocumentType: ("codigo", "nombre", "descripcion", "campos_extraccion", "is_active"),
    Area: ("codigo", "nombre", "descripcion", "is_active"),
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
    created = await _persist(db, entity, label)
    logger.info("%s %s creado(a)", label, created.codigo)
    return created


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
    updated = await _persist(db, entity, label)
    logger.info("%s %s actualizado(a) (campos: %s)", label, updated.codigo, ", ".join(sorted(updates)) or "ninguno")
    return updated


@dataclass(frozen=True)
class _Usage:
    """Dónde se usa un registro de catálogo: `count_query` cuenta las filas que lo referencian."""

    label: str
    count_query: Callable[[Any], Select[tuple[int]]]


def _documents_by_codigo(column: ColumnElement[str]) -> _Usage:
    """Uso por valor: documentos cuyo `column` es igual al `codigo` del registro."""
    return _Usage(
        "documento(s) clínico(s)",
        lambda entity: select(func.count(ClinicalDocument.id)).where(column == entity.codigo),
    )


async def _count_usages(
    db: AsyncSession, entity: CatalogEntity, usages: Sequence[_Usage]
) -> list[str]:
    """Retorna la descripción de cada uso con filas asociadas, ej. `["3 usuario(s)"]`."""
    descriptions = []
    for usage in usages:
        count: int = (await db.execute(usage.count_query(entity))).scalar_one()
        if count:
            descriptions.append(f"{count} {usage.label}")
    return descriptions


async def _smart_delete(
    db: AsyncSession,
    model: type[CatalogEntity],
    entity_id: UUID,
    usages: Sequence[_Usage],
    user: User,
    label: str,
) -> tuple[DeletionType, str]:
    """Borra físicamente si nada usa la entidad; si no, la desactiva."""
    entity = await _get_or_404(db, model, entity_id, label)
    _ensure_not_system(entity, label, "eliminar")

    in_use = await _count_usages(db, entity, usages)
    antes = _snapshot(entity)

    if not in_use:
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
            f"{label} desactivado(a) lógicamente debido a que tiene "
            f"{' y '.join(in_use)} asociado(s)",
        )

    await db.commit()
    logger.info("%s %s eliminado(a) (%s)", label, entity.codigo, result[0])
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
_QUEUE_USAGES = (_documents_by_codigo(ClinicalDocument.destino_enrutamiento),)


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
    return await _smart_delete(db, RoutingQueue, queue_id, _QUEUE_USAGES, user, _QUEUE)


async def queue_history(queue_id: UUID, db: AsyncSession) -> list[CatalogHistory]:
    return await _history(db, RoutingQueue, queue_id)


# --- Tipos de documento ------------------------------------------------------

_DOC_TYPE = "Tipo de documento"
_DOC_TYPE_USAGES = (_documents_by_codigo(ClinicalDocument.tipo_documento),)


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
    return await _smart_delete(db, DocumentType, type_id, _DOC_TYPE_USAGES, user, _DOC_TYPE)


async def document_type_history(type_id: UUID, db: AsyncSession) -> list[CatalogHistory]:
    return await _history(db, DocumentType, type_id)


# --- Áreas -------------------------------------------------------------------

_AREA = "Área"
_AREA_USAGES = (
    _Usage("usuario(s)", lambda area: select(func.count(User.id)).where(User.area_id == area.id)),
    _Usage(
        "documento(s) clínico(s)",
        lambda area: select(func.count(ClinicalDocument.id)).where(
            ClinicalDocument.area_origen_id == area.id
        ),
    ),
)


async def get_active_areas(db: AsyncSession) -> list[Area]:
    """Áreas activas, para los selectores del registro de usuarios."""
    return await _list(db, Area, is_active=True)


async def get_active_area_or_none(db: AsyncSession, area_id: UUID) -> Area | None:
    """Retorna el área si existe y está activa; `None` en otro caso."""
    area = await db.get(Area, area_id)
    return area if area is not None and area.is_active else None


async def list_areas(db: AsyncSession, is_active: bool | None = None) -> list[Area]:
    return await _list(db, Area, is_active)


async def get_area(area_id: UUID, db: AsyncSession) -> Area:
    return await _get_or_404(db, Area, area_id, _AREA)


async def create_area(payload: AreaCreate, db: AsyncSession, user: User) -> Area:
    return await _create(db, Area, payload, user, _AREA)


async def update_area(area_id: UUID, payload: AreaUpdate, db: AsyncSession, user: User) -> Area:
    return await _update(db, Area, area_id, payload, user, _AREA)


async def smart_delete_area(area_id: UUID, db: AsyncSession, user: User) -> tuple[DeletionType, str]:
    return await _smart_delete(db, Area, area_id, _AREA_USAGES, user, _AREA)


async def area_history(area_id: UUID, db: AsyncSession) -> list[CatalogHistory]:
    return await _history(db, Area, area_id)


async def get_document_forms(db: AsyncSession) -> DocumentFormsResponse:
    """Formulario (bloque + JSON Schema) de cada tipo activo, para auditoría y para n8n."""
    tipos = []
    for doc_type in await get_active_document_types_for_llm(db):
        bloque, esquema = formulario_de_tipo(doc_type.codigo, doc_type.campos_extraccion)
        tipos.append(
            DocumentTypeForm(
                codigo=doc_type.codigo,
                nombre=doc_type.nombre,
                descripcion=doc_type.descripcion,
                bloque=bloque,
                esquema=esquema,
            )
        )
    return DocumentFormsResponse(
        datos_generales=esquema_datos_generales(), comunes=esquemas_listas_comunes(), tipos=tipos
    )
