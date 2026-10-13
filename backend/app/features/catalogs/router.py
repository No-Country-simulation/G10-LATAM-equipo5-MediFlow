"""Router de catálogos y tablas maestras (colas de enrutamiento, tipos de documento y áreas)."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.auth.dependencies import get_current_user, require_roles
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.catalogs import service
from app.features.catalogs.schemas import (
    AreaCreate,
    AreaResponse,
    AreaSummary,
    AreaUpdate,
    CatalogHistoryResponse,
    DeleteResponse,
    DocumentFormsResponse,
    DocumentTypeActiveForLLM,
    DocumentTypeCreate,
    DocumentTypeResponse,
    DocumentTypeUpdate,
    QueueActiveForLLM,
    QueueCreate,
    QueueResponse,
    QueueSummary,
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


@router.get("/queues/summary", response_model=list[QueueSummary])
async def list_active_queues_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QueueSummary]:
    """Colas activas con su `id` y si son asistenciales: para asignar colas a un usuario y para
    elegir el destino al derivar un caso. Requiere autenticación."""
    queues = await service.get_active_queues_for_llm(db)
    return [QueueSummary.model_validate(q) for q in queues]


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
    return QueueResponse.model_validate(await service.create_queue(payload, db, current_user))


@router.put("/queues/{queue_id}", response_model=QueueResponse)
async def update_queue(
    queue_id: UUID,
    payload: QueueUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> QueueResponse:
    """Actualiza parcialmente una cola de enrutamiento. Requiere rol ADMIN."""
    return QueueResponse.model_validate(await service.update_queue(queue_id, payload, db, current_user))


@router.delete("/queues/{queue_id}", response_model=DeleteResponse)
async def delete_queue(
    queue_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> DeleteResponse:
    """Smart Delete: borrado físico si ningún documento usa la cola; si no, la desactiva. Requiere rol ADMIN."""
    deletion_type, message = await service.smart_delete_queue(queue_id, db, current_user)
    return DeleteResponse(message=message, deletion_type=deletion_type)


@router.get("/queues/{queue_id}/history", response_model=list[CatalogHistoryResponse])
async def get_queue_history(
    queue_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> list[CatalogHistoryResponse]:
    """Historial de cambios de una cola (más reciente primero), aunque ya haya sido eliminada.

    Requiere rol ADMIN.
    """
    return [
        CatalogHistoryResponse.model_validate(h) for h in await service.queue_history(queue_id, db)
    ]


# --- Tipos de documento ------------------------------------------------------


@router.get("/document-types/active", response_model=list[DocumentTypeActiveForLLM])
async def list_active_document_types_for_llm(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentTypeActiveForLLM]:
    """Tipos de documento activos en formato compacto para el prompt de n8n. Requiere autenticación."""
    doc_types = await service.get_active_document_types_for_llm(db)
    return [DocumentTypeActiveForLLM.model_validate(t) for t in doc_types]


@router.get("/document-types/forms", response_model=DocumentFormsResponse)
async def get_document_forms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentFormsResponse:
    """Campos de cada tipo activo (bloque de `detalle_clinico` y su JSON Schema) y las listas
    comunes a todos los tipos.

    Lo usan el formulario de auditoría (muestra los campos del tipo elegido) y n8n (arma el
    prompt con los mismos campos). Requiere autenticación.
    """
    return await service.get_document_forms(db)


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
    return DocumentTypeResponse.model_validate(await service.create_document_type(payload, db, current_user))


@router.put("/document-types/{type_id}", response_model=DocumentTypeResponse)
async def update_document_type(
    type_id: UUID,
    payload: DocumentTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> DocumentTypeResponse:
    """Actualiza parcialmente un tipo de documento clínico. Requiere rol ADMIN."""
    return DocumentTypeResponse.model_validate(
        await service.update_document_type(type_id, payload, db, current_user)
    )


@router.delete("/document-types/{type_id}", response_model=DeleteResponse)
async def delete_document_type(
    type_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> DeleteResponse:
    """Smart Delete: borrado físico si ningún documento usa el tipo; si no, lo desactiva. Requiere rol ADMIN."""
    deletion_type, message = await service.smart_delete_document_type(type_id, db, current_user)
    return DeleteResponse(message=message, deletion_type=deletion_type)


@router.get("/document-types/{type_id}/history", response_model=list[CatalogHistoryResponse])
async def get_document_type_history(
    type_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_admin),
) -> list[CatalogHistoryResponse]:
    """Historial de cambios de un tipo de documento (más reciente primero). Requiere rol ADMIN."""
    return [
        CatalogHistoryResponse.model_validate(h)
        for h in await service.document_type_history(type_id, db)
    ]


# --- Áreas -------------------------------------------------------------------
# Las gestionan ADMIN y GESTOR_USUARIOS: son quienes registran usuarios y les asignan un área.

_require_area_manager = require_roles([UserRole.ADMIN, UserRole.GESTOR_USUARIOS])


@router.get("/areas/active", response_model=list[AreaSummary])
async def list_active_areas(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AreaSummary]:
    """Áreas activas en formato compacto, para el selector del registro de usuarios. Requiere autenticación."""
    return [AreaSummary.model_validate(a) for a in await service.get_active_areas(db)]


@router.get("/areas", response_model=list[AreaResponse])
async def list_areas(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: bool | None = _IS_ACTIVE_FILTER,
) -> list[AreaResponse]:
    """Lista las áreas del hospital. Requiere autenticación."""
    return [AreaResponse.model_validate(a) for a in await service.list_areas(db, is_active=is_active)]


@router.get("/areas/{area_id}", response_model=AreaResponse)
async def get_area(
    area_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AreaResponse:
    """Obtiene un área por id. Requiere autenticación."""
    return AreaResponse.model_validate(await service.get_area(area_id, db))


@router.post("/areas", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
async def create_area(
    payload: AreaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_area_manager),
) -> AreaResponse:
    """Crea un área. Requiere rol ADMIN o GESTOR_USUARIOS."""
    return AreaResponse.model_validate(await service.create_area(payload, db, current_user))


@router.put("/areas/{area_id}", response_model=AreaResponse)
async def update_area(
    area_id: UUID,
    payload: AreaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_area_manager),
) -> AreaResponse:
    """Actualiza parcialmente un área. Requiere rol ADMIN o GESTOR_USUARIOS."""
    return AreaResponse.model_validate(await service.update_area(area_id, payload, db, current_user))


@router.delete("/areas/{area_id}", response_model=DeleteResponse)
async def delete_area(
    area_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_area_manager),
) -> DeleteResponse:
    """Smart Delete: borrado físico si ningún usuario ni documento usa el área; si no, la desactiva.

    Requiere rol ADMIN o GESTOR_USUARIOS.
    """
    deletion_type, message = await service.smart_delete_area(area_id, db, current_user)
    return DeleteResponse(message=message, deletion_type=deletion_type)


@router.get("/areas/{area_id}/history", response_model=list[CatalogHistoryResponse])
async def get_area_history(
    area_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(_require_area_manager),
) -> list[CatalogHistoryResponse]:
    """Historial de cambios de un área (más reciente primero). Requiere rol ADMIN o GESTOR_USUARIOS."""
    return [CatalogHistoryResponse.model_validate(h) for h in await service.area_history(area_id, db)]
