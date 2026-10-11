"""Dependencias de FastAPI para autenticación y control de acceso por rol."""

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.log_config import set_current_username
from app.core.security import ACCESS_TOKEN_TYPE, decode_token
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.auth.service import get_user_by_username, is_token_revoked

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")

_CREDENTIALS_ERROR = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Credenciales inválidas o expiradas",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decodifica el JWT recibido y retorna el usuario autenticado correspondiente."""
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as exc:
        raise _CREDENTIALS_ERROR from exc
    username: str | None = payload.get("sub")
    # Un refresh token no autoriza peticiones. Los tokens sin `type` (emitidos antes del
    # refresh token) se aceptan como access hasta que expiren.
    if username is None or payload.get("type", ACCESS_TOKEN_TYPE) != ACCESS_TOKEN_TYPE:
        raise _CREDENTIALS_ERROR

    jti: str | None = payload.get("jti")
    if jti is not None and await is_token_revoked(db, jti):
        raise _CREDENTIALS_ERROR

    user = await get_user_by_username(db, username)
    if user is None or not user.is_active:
        raise _CREDENTIALS_ERROR
    set_current_username(user.username)
    return user


def require_roles(allowed_roles: list[UserRole]) -> Callable[..., Coroutine[Any, Any, User]]:
    """Crea una dependencia que exige que el usuario autenticado tenga uno de los roles permitidos."""

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Permiso denegado: se requiere uno de los siguientes roles: "
                    f"{[r.value for r in allowed_roles]}"
                ),
            )
        return current_user

    return role_checker
