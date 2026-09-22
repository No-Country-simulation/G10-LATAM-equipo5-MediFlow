"""Esquemas Pydantic de entrada y salida para la feature de autenticación."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.features.auth.enums import UserRole


class LoginRequest(BaseModel):
    """Credenciales enviadas por el cliente para iniciar sesión."""

    username: str
    password: str


class UserOut(BaseModel):
    """Representación pública del usuario, sin datos sensibles."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str
    full_name: str
    role: UserRole


class TokenResponse(BaseModel):
    """Respuesta del login: token de acceso y perfil del usuario autenticado."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdateRequest(BaseModel):
    """Campos que un usuario puede editar en su propio perfil.

    `id`, `username`, `role` y `created_at` son inmutables por el propio usuario
    y, por diseño, no forman parte de este esquema.
    """

    full_name: str | None = None
    email: EmailStr | None = None


class PasswordChangeRequest(BaseModel):
    """Solicitud de cambio de contraseña del usuario autenticado."""

    current_password: str
    new_password: str = Field(min_length=8)


class UserCreateRequest(BaseModel):
    """Datos para crear un nuevo usuario (uso administrativo)."""

    username: str
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.AUDITOR_CLINICO


class UserAdminUpdateRequest(BaseModel):
    """Campos que un administrador o gestor de usuarios puede editar sobre otro usuario."""

    full_name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    """Representación completa de un usuario, para gestión administrativa y autogestión de perfil."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime


class PaginatedUsersResponse(BaseModel):
    """Página de resultados del listado de usuarios, con metadatos de paginación."""

    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
