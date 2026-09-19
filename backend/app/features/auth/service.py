"""Lógica de negocio de autenticación: verificación de credenciales contra la base de datos."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.features.auth.models import User


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
