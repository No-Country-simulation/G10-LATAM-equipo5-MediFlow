"""Router de catálogos y tablas maestras (colas de enrutamiento y tipos de documento)."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.auth.dependencies import get_current_user, require_roles
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.catalogs import service
from app.features.catalogs.schemas import (
    DeleteResponse,
    DocumentTypeActiveForLLM,
    DocumentTypeCreate,
    DocumentTypeResponse,
    DocumentTypeUpdate,
    QueueActiveForLLM,
    QueueCreate,
    QueueResponse,
    QueueUpdate,
)

router = APIRouter()

_require_admin = require_roles([UserRole.ADMIN])

_IS_ACTIVE_FILTER = Query(None, description="Filtrar por estado activo/inactivo; omitir para traer todos")


# Las rutas `/active` se declaran antes que `/{id}` para que "active" no se interprete como UUID.

# --- Colas de enrutamiento ---------------------------------------------------


@router.get("/queues/active", response_model=list[QueueActiveForLLM])
async def list_active_queues_for_llm(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QueueActiveForLLM]:
    """Colas activas en formato compacto para inyectar en el prompt de n8n. Requiere autenticación."""
    queues = await service.get_active_queues_for_llm(db)
    return [QueueActiveForLLM.model_validate(q) for q in queues]


@router.get("/queues", response_model=list[QueueResponse])
async def list_queues(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: bool | None = _IS_ACTIVE_FILTER,
) -> list[QueueResponse]:
    """Lista las colas de enrutamiento. Requiere autenticación."""
    queues = await service.list_queues(db, is_active=is_active)
    return [QueueResponse.model_validate(q) for q in queues]


@router.get("/queues/{queue_id}", response_model=QueueResponse)
async def get_queue(
    queue_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> QueueResponse:
    """Obtiene una cola de enrutamiento por id. Requiere autenticación."""
    return QueueResponse.model_validate(await service.get_queue(queue_id, db))


@router.post("/queues", response_model=QueueResponse, status_code=status.HTTP_201_CREATED)
async def create_queue(
    payload: QueueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> QueueResponse:
    """Crea una cola de enrutamiento. Requiere rol ADMIN."""
    return QueueResponse.model_validate(await service.create_queue(payload, db))


@router.put("/queues/{queue_id}", response_model=QueueResponse)
async def update_queue(
    queue_id: UUID,
    payload: QueueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> QueueResponse:
    """Actualiza parcialmente una cola de enrutamiento. Requiere rol ADMIN."""
    return QueueResponse.model_validate(await service.update_queue(queue_id, payload, db))


@router.delete("/queues/{queue_id}", response_model=DeleteResponse)
async def delete_queue(
    queue_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> DeleteResponse:
    """Smart Delete: borrado físico si ningún documento usa la cola; si no, la desactiva. Requiere rol ADMIN."""
    deletion_type, message = await service.smart_delete_queue(queue_id, db)
    return DeleteResponse(message=message, deletion_type=deletion_type)


# --- Tipos de documento ------------------------------------------------------


@router.get("/document-types/active", response_model=list[DocumentTypeActiveForLLM])
async def list_active_document_types_for_llm(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentTypeActiveForLLM]:
    """Tipos de documento activos en formato compacto para el prompt de n8n. Requiere autenticación."""
    doc_types = await service.get_active_document_types_for_llm(db)
    return [DocumentTypeActiveForLLM.model_validate(t) for t in doc_types]


@router.get("/document-types", response_model=list[DocumentTypeResponse])
async def list_document_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: bool | None = _IS_ACTIVE_FILTER,
) -> list[DocumentTypeResponse]:
    """Lista los tipos de documento clínico. Requiere autenticación."""
    doc_types = await service.list_document_types(db, is_active=is_active)
    return [DocumentTypeResponse.model_validate(t) for t in doc_types]


@router.get("/document-types/{type_id}", response_model=DocumentTypeResponse)
async def get_document_type(
    type_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentTypeResponse:
    """Obtiene un tipo de documento clínico por id. Requiere autenticación."""
    return DocumentTypeResponse.model_validate(await service.get_document_type(type_id, db))


@router.post(
    "/document-types", response_model=DocumentTypeResponse, status_code=status.HTTP_201_CREATED
)
async def create_document_type(
    payload: DocumentTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> DocumentTypeResponse:
    """Crea un tipo de documento clínico. Requiere rol ADMIN."""
    return DocumentTypeResponse.model_validate(await service.create_document_type(payload, db))


@router.put("/document-types/{type_id}", response_model=DocumentTypeResponse)
async def update_document_type(
    type_id: UUID,
    payload: DocumentTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> DocumentTypeResponse:
    """Actualiza parcialmente un tipo de documento clínico. Requiere rol ADMIN."""
    return DocumentTypeResponse.model_validate(
        await service.update_document_type(type_id, payload, db)
    )


@router.delete("/document-types/{type_id}", response_model=DeleteResponse)
async def delete_document_type(
    type_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> DeleteResponse:
    """Smart Delete: borrado físico si ningún documento usa el tipo; si no, lo desactiva. Requiere rol ADMIN."""
    deletion_type, message = await service.smart_delete_document_type(type_id, db)
    return DeleteResponse(message=message, deletion_type=deletion_type)
