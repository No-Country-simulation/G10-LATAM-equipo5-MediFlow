"""Esquemas Pydantic de entrada y salida para la feature de autenticación."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.features.auth.enums import UserRole
from app.features.catalogs.schemas import AreaSummary, QueueSummary


class LoginRequest(BaseModel):
    """Credenciales enviadas por el cliente para iniciar sesión."""

    username: str = Field(max_length=50)
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    """Representación pública del usuario, sin datos sensibles."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str
    full_name: str
    role: UserRole
    area: AreaSummary | None = None
    colas: list[QueueSummary] = []


class TokenResponse(BaseModel):
    """Respuesta del login y del refresh: par de tokens y perfil del usuario autenticado."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshRequest(BaseModel):
    """Refresh token con el que se pide un par nuevo de tokens."""

    refresh_token: str = Field(max_length=2048)


class LogoutRequest(BaseModel):
    """Cuerpo opcional del logout: si trae el refresh token, también se revoca."""

    refresh_token: str | None = Field(default=None, max_length=2048)


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
    new_password: str = Field(min_length=8, max_length=72)


class PasswordResetRequest(BaseModel):
    """Nueva contraseña que un administrador o gestor asigna a otro usuario (sin la actual)."""

    new_password: str = Field(min_length=8, max_length=72)


class UserCreateRequest(BaseModel):
    """Datos para crear un nuevo usuario (uso administrativo)."""

    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    # bcrypt solo considera los primeros 72 bytes.
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=150)
    role: UserRole = UserRole.AUDITOR_CLINICO
    area_id: UUID
    # Colas de la Consola de Triaje que atiende (OPERADOR y AUDITOR_CLINICO; el ADMIN ve todas).
    cola_ids: list[UUID] = Field(default_factory=list, max_length=50)


class UserAdminUpdateRequest(BaseModel):
    """Campos que un administrador o gestor de usuarios puede editar sobre otro usuario."""

    full_name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    area_id: UUID | None = None
    # Reemplaza todas las colas del usuario; `[]` las quita.
    cola_ids: list[UUID] | None = Field(default=None, max_length=50)


class UserResponse(BaseModel):
    """Representación completa de un usuario, para gestión administrativa y autogestión de perfil."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    username: str
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    area: AreaSummary | None = None
    colas: list[QueueSummary] = []
    created_at: datetime


class PaginatedUsersResponse(BaseModel):
    """Página de resultados del listado de usuarios, con metadatos de paginación."""

    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
