"""Dependencias de FastAPI para autenticación y control de acceso por rol."""

from collections.abc import Callable, Coroutine
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.features.auth.models import User
from app.features.auth.service import get_user_by_username

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
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        username: str | None = payload.get("sub")
        if username is None:
            raise _CREDENTIALS_ERROR
    except JWTError as exc:
        raise _CREDENTIALS_ERROR from exc

    user = await get_user_by_username(db, username)
    if user is None or not user.is_active:
        raise _CREDENTIALS_ERROR
    return user


def require_role(allowed_roles: list[str]) -> Callable[..., Coroutine[Any, Any, User]]:
    """Crea una dependencia que exige que el usuario autenticado tenga uno de los roles permitidos."""

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos suficientes para acceder a este recurso",
            )
        return current_user

    return role_checker
