"""Utilidades de seguridad: hashing de contraseñas y generación de tokens JWT."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica que una contraseña en texto plano coincida con su hash bcrypt."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano."""
    return pwd_context.hash(password)


# Valor del claim `type`: impide usar un refresh token como access token y viceversa.
ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def _create_token(data: dict[str, Any], token_type: str, expires_delta: timedelta) -> str:
    """Genera un JWT firmado con `exp` (expiración), `jti` (id único, usado para revocarlo) y `type`."""
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + expires_delta
    to_encode["jti"] = str(uuid4())
    to_encode["type"] = token_type
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Genera el token de acceso (vida corta) que se envía en `Authorization: Bearer`."""
    return _create_token(
        data,
        ACCESS_TOKEN_TYPE,
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Genera el refresh token (vida larga), que solo sirve para obtener un par nuevo en `/auth/refresh`."""
    return _create_token(
        data,
        REFRESH_TOKEN_TYPE,
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    """Valida firma y expiración de un JWT y retorna su payload. Lanza `jwt.PyJWTError` si no es válido."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
