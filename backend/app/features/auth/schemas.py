"""Esquemas Pydantic de entrada y salida para la feature de autenticación."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict


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
    role: str


class TokenResponse(BaseModel):
    """Respuesta del login: token de acceso y perfil del usuario autenticado."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut
