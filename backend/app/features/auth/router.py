"""Router de la feature de autenticación: login, perfil propio y gestión administrativa de usuarios."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.features.auth.dependencies import get_current_user, oauth2_scheme, require_roles
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.auth.schemas import (
    LoginRequest,
    PaginatedUsersResponse,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    TokenResponse,
    UserAdminUpdateRequest,
    UserCreateRequest,
    UserOut,
    UserResponse,
)
from app.features.auth.service import (
    admin_update_user,
    authenticate_user,
    change_password,
    create_user,
    get_users_paginated,
    revoke_token,
    update_profile,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
users_router = APIRouter(prefix="/users", tags=["Users"])

_USER_MANAGEMENT_ROLES = [UserRole.ADMIN, UserRole.GESTOR_USUARIOS]


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Autentica al usuario por username/password y retorna un token de acceso JWT."""
    user = await authenticate_user(db, credentials.username, credentials.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return TokenResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    token: str = Depends(oauth2_scheme),
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Cierra la sesión: invalida el token actual para que no pueda volver a usarse."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    jti = payload.get("jti")
    if jti is not None:
        expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await revoke_token(db, jti, expires_at)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Retorna el perfil del usuario actualmente autenticado."""
    return UserOut.model_validate(current_user)


# --- Autogestión de perfil (cualquier usuario activo) ---


@users_router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Retorna el perfil completo del usuario autenticado."""
    return UserResponse.model_validate(current_user)


@users_router.patch("/me", response_model=UserResponse)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Actualiza los campos editables del propio perfil (`full_name`, `email`).

    `id`, `username`, `role` y `created_at` son inmutables por el propio usuario.
    """
    user = await update_profile(current_user, payload, db)
    return UserResponse.model_validate(user)


@users_router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    payload: PasswordChangeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Cambia la contraseña del usuario autenticado, validando la contraseña actual."""
    await change_password(current_user, payload, db)


# --- Gestión administrativa de usuarios (ADMIN y GESTOR_USUARIOS) ---


@users_router.get("", response_model=PaginatedUsersResponse)
async def list_users(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_roles(_USER_MANAGEMENT_ROLES)),
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Elementos por página"),
) -> PaginatedUsersResponse:
    """Lista los usuarios del sistema, paginados. Requiere rol ADMIN o GESTOR_USUARIOS."""
    result = await get_users_paginated(db, page=page, page_size=page_size)
    return PaginatedUsersResponse(
        items=[UserResponse.model_validate(item) for item in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
    )


@users_router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_new_user(
    payload: UserCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_USER_MANAGEMENT_ROLES)),
) -> UserResponse:
    """Crea un nuevo usuario. Requiere rol ADMIN o GESTOR_USUARIOS.

    Solo un ADMIN puede otorgar el rol ADMIN al usuario creado.
    """
    user = await create_user(payload, db, current_user)
    return UserResponse.model_validate(user)


@users_router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    payload: UserAdminUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_USER_MANAGEMENT_ROLES)),
) -> UserResponse:
    """Actualiza el estado o rol de un usuario existente. Requiere rol ADMIN o GESTOR_USUARIOS.

    Solo un ADMIN puede otorgar el rol ADMIN a otro usuario.
    """
    user = await admin_update_user(user_id, payload, db, current_user)
    return UserResponse.model_validate(user)
