"""Lógica de negocio de autenticación y gestión de usuarios."""

import math
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash, verify_password
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.auth.schemas import (
    PasswordChangeRequest,
    ProfileUpdateRequest,
    UserAdminUpdateRequest,
    UserCreateRequest,
)


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


def _ensure_can_grant_role(requesting_user: User, role: UserRole) -> None:
    """Lanza HTTPException 403 si un usuario no-ADMIN intenta otorgar el rol ADMIN."""
    if role == UserRole.ADMIN and requesting_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un usuario con rol ADMIN puede otorgar el rol ADMIN",
        )


async def create_user(payload: UserCreateRequest, db: AsyncSession, requesting_user: User) -> User:
    """Crea un nuevo usuario, validando que `username` y `email` no estén ya en uso."""
    _ensure_can_grant_role(requesting_user, payload.role)

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
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def admin_update_user(
    user_id: UUID, payload: UserAdminUpdateRequest, db: AsyncSession, requesting_user: User
) -> User:
    """Busca un usuario por `user_id` y actualiza los campos administrativos presentes en el payload."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado"
        )

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)

    if "role" in updates:
        _ensure_can_grant_role(requesting_user, updates["role"])

    if "email" in updates and updates["email"] != user.email:
        await _ensure_email_not_taken(db, updates["email"], user.id)

    for field, value in updates.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
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
