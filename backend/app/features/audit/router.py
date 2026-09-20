"""Router de la feature de auditoría humana (Human-in-the-Loop)."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.audit.schemas import AuditDetailResponse, AuditResolveRequest
from app.features.audit.service import get_audit_case, resolve_audit_case
from app.features.auth.dependencies import require_roles
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.documents.schemas import DocumentListItemResponse

router = APIRouter(tags=["Audit"])

_AUDIT_ACCESS_ROLES = [UserRole.ADMIN, UserRole.AUDITOR_CLINICO]


@router.get("/{documento_id}", response_model=AuditDetailResponse)
async def get_case(
    documento_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_AUDIT_ACCESS_ROLES)),
) -> AuditDetailResponse:
    """Obtiene el detalle de un caso de auditoría, incluyendo una URL pre-firmada para visualizar el binario.

    Requiere rol ADMIN o AUDITOR_CLINICO.
    """
    return await get_audit_case(documento_id, db)


@router.put("/{documento_id}/resolve", response_model=DocumentListItemResponse)
async def resolve_case(
    documento_id: str,
    payload: AuditResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_AUDIT_ACCESS_ROLES)),
) -> DocumentListItemResponse:
    """Resuelve un caso de auditoría, persistiendo la corrección humana (Human-in-the-Loop).

    Requiere rol ADMIN o AUDITOR_CLINICO.
    """
    document = await resolve_audit_case(documento_id, payload, current_user, db)
    return DocumentListItemResponse.model_validate(document)
