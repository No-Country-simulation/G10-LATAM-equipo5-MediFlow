"""Router de la feature de autenticación: login, perfil propio y gestión administrativa de usuarios."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import login_throttle
from app.core.security import (
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.features.auth.dependencies import get_current_user, oauth2_scheme, require_roles
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    PaginatedUsersResponse,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    TokenResponse,
    UserAdminUpdateRequest,
    UserCreateRequest,
    UserOut,
    UserResponse,
)
from app.features.catalogs.schemas import DeleteResponse
from app.features.auth.service import (
    admin_update_user,
    authenticate_user,
    change_password,
    consume_refresh_token,
    create_user,
    delete_user,
    get_user_by_username,
    get_users_paginated,
    revoke_token,
    update_profile,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
users_router = APIRouter(prefix="/users", tags=["Users"])

_USER_MANAGEMENT_ROLES = [UserRole.ADMIN, UserRole.GESTOR_USUARIOS]

_INVALID_REFRESH_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Refresh token inválido o expirado",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post("/login", response_model=TokenResponse)
async def login(
    credentials: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenResponse:
    """Autentica al usuario por username/password y retorna un token de acceso JWT.

    Tras `LOGIN_MAX_ATTEMPTS` fallos seguidos del mismo usuario desde la misma IP responde
    `429` durante `LOGIN_LOCKOUT_MINUTES`.
    """
    client_ip = request.client.host if request.client else "desconocida"
    throttle_key = f"{credentials.username.lower()}|{client_ip}"
    retry_after = login_throttle.retry_after(throttle_key)
    if retry_after:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos fallidos. Intenta nuevamente más tarde.",
            headers={"Retry-After": str(retry_after)},
        )

    user = await authenticate_user(db, credentials.username, credentials.password)
    if user is None:
        login_throttle.register_failure(throttle_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    login_throttle.reset(throttle_key)

    return _issue_tokens(user)


def _issue_tokens(user: User) -> TokenResponse:
    """Emite un par nuevo (access + refresh) para el usuario."""
    data = {"sub": user.username}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
        user=UserOut.model_validate(user),
    )


def _decode_refresh_token(token: str) -> dict[str, Any] | None:
    """Retorna el payload si `token` es un refresh token válido (firma, expiración, `type`, `sub` y `jti`)."""
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        return None
    if payload.get("type") != REFRESH_TOKEN_TYPE or not payload.get("sub") or not payload.get("jti"):
        return None
    return payload


def _expiration(payload: dict[str, Any]) -> datetime:
    return datetime.fromtimestamp(payload["exp"], tz=timezone.utc)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Canjea un refresh token por un par nuevo de tokens.

    El refresh token es de un solo uso (rotación): queda revocado al canjearlo, así que el
    cliente debe guardar el nuevo. Responde `401` si es inválido, expiró, ya se usó o el
    usuario ya no está activo.
    """
    payload = _decode_refresh_token(body.refresh_token)
    if payload is None:
        raise _INVALID_REFRESH_ERROR

    user = await get_user_by_username(db, payload["sub"])
    if user is None or not user.is_active:
        raise _INVALID_REFRESH_ERROR

    if not await consume_refresh_token(db, payload["jti"], _expiration(payload)):
        raise _INVALID_REFRESH_ERROR

    return _issue_tokens(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: LogoutRequest | None = None,
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Cierra la sesión: invalida el token actual y, si se envía, también el refresh token."""
    payload = decode_token(token)
    jti = payload.get("jti")
    if jti is not None:
        await revoke_token(db, jti, _expiration(payload))

    if body is not None and body.refresh_token:
        refresh_payload = _decode_refresh_token(body.refresh_token)
        # Solo se revoca un refresh token del mismo usuario; uno inválido se ignora.
        if refresh_payload is not None and refresh_payload["sub"] == current_user.username:
            await revoke_token(db, refresh_payload["jti"], _expiration(refresh_payload))


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


@users_router.delete("/{user_id}", response_model=DeleteResponse)
async def remove_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_USER_MANAGEMENT_ROLES)),
) -> DeleteResponse:
    """Smart Delete: borrado físico si el usuario no tiene actividad registrada; si la tiene
    (documentos subidos, auditados o tomados, o cambios de catálogos), se desactiva para
    conservar la autoría. Requiere rol ADMIN o GESTOR_USUARIOS.

    `409` al intentar eliminarse a sí mismo; `403` si un no-ADMIN intenta eliminar a un ADMIN.
    """
    deletion_type, message = await delete_user(user_id, db, current_user)
    return DeleteResponse(message=message, deletion_type=deletion_type)
