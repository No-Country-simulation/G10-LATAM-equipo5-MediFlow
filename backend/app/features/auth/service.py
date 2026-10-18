"""Lógica de negocio de autenticación y gestión de usuarios."""

import logging
import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password
from app.features.auth.enums import UserRole
from app.features.auth.models import RevokedToken, User
from app.features.catalogs.models import Area, CatalogHistory, RoutingQueue
from app.features.catalogs.schemas import DeletionType
from app.features.catalogs.service import get_active_area_or_none
from app.features.documents.models import ClinicalDocument
from app.features.auth.schemas import (
    PasswordChangeRequest,
    PasswordResetRequest,
    ProfileUpdateRequest,
    UserAdminUpdateRequest,
    UserCreateRequest,
)

logger = logging.getLogger(__name__)


async def revoke_token(db: AsyncSession, jti: str, expires_at: datetime) -> None:
    """Registra el token como revocado y purga los ya expirados (ya no son válidos por `exp`)."""
    await db.execute(delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc)))
    if await db.get(RevokedToken, jti) is None:
        db.add(RevokedToken(jti=jti, expires_at=expires_at))
    await db.commit()


async def consume_refresh_token(db: AsyncSession, jti: str, expires_at: datetime) -> bool:
    """Revoca el refresh token de forma atómica. Retorna `False` si ya estaba revocado.

    Con `ON CONFLICT DO NOTHING`, si dos peticiones usan el mismo token a la vez solo una lo consume.
    """
    await db.execute(delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc)))
    result = await db.execute(
        pg_insert(RevokedToken)
        .values(jti=jti, expires_at=expires_at)
        .on_conflict_do_nothing(index_elements=[RevokedToken.jti])
        .returning(RevokedToken.jti)
    )
    consumed = result.scalar_one_or_none() is not None
    await db.commit()
    return consumed


async def is_token_revoked(db: AsyncSession, jti: str) -> bool:
    """Indica si el token con ese `jti` fue invalidado mediante logout."""
    return await db.get(RevokedToken, jti) is not None


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    """Busca un usuario activo o inactivo por su nombre de usuario."""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    """Valida usuario, estado activo y contraseña. Retorna `None` si la autenticación falla."""
    user = await get_user_by_username(db, username)
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


async def _ensure_email_not_taken(db: AsyncSession, email: str, exclude_user_id: UUID) -> None:
    """Lanza HTTPException 409 si `email` ya pertenece a otro usuario distinto de `exclude_user_id`."""
    result = await db.execute(
        select(User).where(User.email == email, User.id != exclude_user_id)
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo electrónico ya está en uso por otro usuario",
        )


async def update_profile(user: User, payload: ProfileUpdateRequest, db: AsyncSession) -> User:
    """Actualiza los campos editables del propio perfil (solo los presentes en el payload)."""
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)

    if "email" in updates and updates["email"] != user.email:
        await _ensure_email_not_taken(db, updates["email"], user.id)

    for field, value in updates.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    logger.info("Usuario %s actualizó su perfil (campos: %s)", user.username, ", ".join(sorted(updates)) or "ninguno")
    return user


async def change_password(user: User, payload: PasswordChangeRequest, db: AsyncSession) -> None:
    """Verifica la contraseña actual y, si es correcta, la reemplaza por la nueva."""
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta",
        )

    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    logger.info("Usuario %s cambió su contraseña", user.username)


def _ensure_can_grant_role(requesting_user: User, role: UserRole) -> None:
    """Lanza HTTPException 403 si un usuario no-ADMIN intenta otorgar el rol ADMIN."""
    if role == UserRole.ADMIN and requesting_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un usuario con rol ADMIN puede otorgar el rol ADMIN",
        )


async def _get_assignable_area(db: AsyncSession, area_id: UUID) -> Area:
    """Retorna el área a asignar a un usuario o lanza HTTPException 422 si no existe o está inactiva."""
    area = await get_active_area_or_none(db, area_id)
    if area is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El área indicada no existe o está inactiva",
        )
    return area


async def _get_assignable_queues(db: AsyncSession, cola_ids: list[UUID]) -> list[RoutingQueue]:
    """Colas activas a asignar a un usuario o HTTPException 422 si alguna no existe o está inactiva."""
    ids = set(cola_ids)
    if not ids:
        return []
    result = await db.execute(
        select(RoutingQueue).where(RoutingQueue.id.in_(ids), RoutingQueue.is_active.is_(True))
    )
    colas = list(result.scalars().all())
    if len(colas) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Alguna de las colas indicadas no existe o está inactiva",
        )
    return colas


async def create_user(payload: UserCreateRequest, db: AsyncSession, requesting_user: User) -> User:
    """Crea un nuevo usuario, validando que `username` y `email` no estén ya en uso y que el área esté activa."""
    _ensure_can_grant_role(requesting_user, payload.role)
    area = await _get_assignable_area(db, payload.area_id)
    colas = await _get_assignable_queues(db, payload.cola_ids)

    result = await db.execute(
        select(User).where(
            (User.username == payload.username) | (User.email == payload.email)
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese username o email",
        )

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        area=area,
        colas=colas,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("Usuario %s creado con rol %s en el área %s", user.username, user.role.value, area.codigo)
    return user


async def _get_user_or_404(db: AsyncSession, user_id: UUID) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


async def _count_user_activity(db: AsyncSession, user_id: UUID) -> int:
    """Registros que identifican al usuario como autor: documentos que subió, auditó, tomó o marcó
    como atendidos, y cambios de catálogos. Borrarlo físicamente dejaría esa trazabilidad en `NULL`."""
    documents = await db.execute(
        select(func.count(ClinicalDocument.id)).where(
            or_(
                ClinicalDocument.uploaded_by_id == user_id,
                ClinicalDocument.audited_by_id == user_id,
                ClinicalDocument.asignado_a_id == user_id,
                ClinicalDocument.atendido_por_id == user_id,
            )
        )
    )
    catalog_changes = await db.execute(
        select(func.count(CatalogHistory.id)).where(CatalogHistory.changed_by_id == user_id)
    )
    return documents.scalar_one() + catalog_changes.scalar_one()


def _ensure_can_manage_admin(requesting_user: User, target: User, action: str) -> None:
    """Lanza HTTPException 403 si un usuario no-ADMIN intenta `action` sobre un ADMIN."""
    if target.role == UserRole.ADMIN and requesting_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Solo un usuario con rol ADMIN puede {action} a otro ADMIN",
        )


async def reset_password(
    user_id: UUID, payload: PasswordResetRequest, db: AsyncSession, requesting_user: User
) -> None:
    """Asigna una nueva contraseña a otro usuario sin exigir la actual.

    La propia se cambia con `change_password` (que valida la actual) y solo un ADMIN puede
    restablecer la de otro ADMIN.
    """
    user = await _get_user_or_404(db, user_id)
    if user.id == requesting_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tu propia contraseña se cambia desde Mi Perfil, indicando la actual",
        )
    _ensure_can_manage_admin(requesting_user, user, "restablecer la contraseña de")

    user.hashed_password = get_password_hash(payload.new_password)
    await db.commit()
    logger.info("Contraseña de %s restablecida por %s", user.username, requesting_user.username)


async def delete_user(
    user_id: UUID, db: AsyncSession, requesting_user: User
) -> tuple[DeletionType, str]:
    """Smart Delete de un usuario: físico si no tiene actividad registrada; si la tiene, se desactiva.

    Nadie puede eliminarse a sí mismo y solo un ADMIN puede eliminar a otro ADMIN.
    """
    user = await _get_user_or_404(db, user_id)
    if user.id == requesting_user.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="No puedes eliminar tu propia cuenta"
        )
    _ensure_can_manage_admin(requesting_user, user, "eliminar")

    activity = await _count_user_activity(db, user.id)
    if activity == 0:
        await db.delete(user)
        result: tuple[DeletionType, str] = (
            "HARD_DELETE",
            f"Usuario {user.username} eliminado físicamente de la base de datos",
        )
    else:
        user.is_active = False
        result = (
            "SOFT_DELETE",
            f"Usuario {user.username} desactivado: tiene {activity} registro(s) de actividad "
            "(documentos o cambios de catálogos) que deben conservar su autoría",
        )
    await db.commit()
    logger.info("Usuario %s eliminado (%s): %d registro(s) de actividad", user.username, result[0], activity)
    return result


async def admin_update_user(
    user_id: UUID, payload: UserAdminUpdateRequest, db: AsyncSession, requesting_user: User
) -> User:
    """Busca un usuario por `user_id` y actualiza los campos administrativos presentes en el payload."""
    user = await _get_user_or_404(db, user_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)

    if "role" in updates:
        _ensure_can_grant_role(requesting_user, updates["role"])

    if "email" in updates and updates["email"] != user.email:
        await _ensure_email_not_taken(db, updates["email"], user.id)

    changed_fields = sorted(updates)
    # Se asigna la relación (no solo el FK) para que la respuesta traiga el área nueva.
    if "area_id" in updates:
        user.area = await _get_assignable_area(db, updates.pop("area_id"))
    if "cola_ids" in updates:
        user.colas = await _get_assignable_queues(db, updates.pop("cola_ids"))

    for field, value in updates.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    logger.info("Usuario %s actualizado (campos: %s)", user.username, ", ".join(changed_fields) or "ninguno")
    return user


async def get_users_paginated(db: AsyncSession, page: int = 1, page_size: int = 20) -> dict:
    """Lista los usuarios del sistema, paginados y ordenados por fecha de creación descendente."""
    total_result = await db.execute(select(func.count(User.id)))
    total = total_result.scalar_one()

    items_result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = items_result.scalars().all()

    total_pages = math.ceil(total / page_size) if total > 0 else 0

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
