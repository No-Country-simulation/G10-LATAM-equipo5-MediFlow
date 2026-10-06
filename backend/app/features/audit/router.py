"""Router de la feature de auditoría humana (Human-in-the-Loop)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.audit.schemas import (
    AuditClaimResponse,
    AuditDetailResponse,
    AuditDiscardRequest,
    AuditResolveRequest,
)
from app.features.audit.service import (
    claim_audit_case,
    discard_audit_case,
    get_audit_case,
    release_audit_case,
    resolve_audit_case,
)
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
    """Obtiene el detalle de un caso, con una URL pre-firmada por cada archivo original.

    Requiere rol ADMIN o AUDITOR_CLINICO.
    """
    return await get_audit_case(documento_id, db)


@router.post("/{documento_id}/claim", response_model=AuditClaimResponse)
async def claim_case(
    documento_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_AUDIT_ACCESS_ROLES)),
) -> AuditClaimResponse:
    """Toma el caso (o renueva la asignación) para que otro auditor no lo resuelva en paralelo.

    `409` si ya no está pendiente o si otro auditor lo tiene tomado. Requiere rol ADMIN o
    AUDITOR_CLINICO.
    """
    return await claim_audit_case(documento_id, current_user, db)


@router.delete("/{documento_id}/claim", status_code=status.HTTP_204_NO_CONTENT)
async def release_case(
    documento_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_AUDIT_ACCESS_ROLES)),
) -> None:
    """Libera el caso tomado. Solo quien lo tomó o un ADMIN."""
    await release_audit_case(documento_id, current_user, db)


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


@router.put("/{documento_id}/discard", response_model=DocumentListItemResponse)
async def discard_case(
    documento_id: str,
    payload: AuditDiscardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_AUDIT_ACCESS_ROLES)),
) -> DocumentListItemResponse:
    """Descarta un caso (no clínico, duplicado o ilegible) con un motivo obligatorio.

    Requiere rol ADMIN o AUDITOR_CLINICO.
    """
    document = await discard_audit_case(documento_id, payload, current_user, db)
    return DocumentListItemResponse.model_validate(document)
