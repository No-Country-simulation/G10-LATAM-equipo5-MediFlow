"""Esquemas Pydantic para la feature de catálogos y tablas maestras."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

DeletionType = Literal["HARD_DELETE", "SOFT_DELETE"]


# --- Colas de enrutamiento ---------------------------------------------------


class QueueCreate(BaseModel):
    """Datos para crear una cola de enrutamiento."""

    codigo: str = Field(..., min_length=1, max_length=80)
    nombre: str = Field(..., min_length=1, max_length=150)
    descripcion_semantica: str = Field(..., min_length=1)
    notificar_inmediato: bool = False


class QueueUpdate(BaseModel):
    """Actualización parcial de una cola. El `codigo` es inmutable (lo referencian los documentos)."""

    nombre: str | None = Field(None, min_length=1, max_length=150)
    descripcion_semantica: str | None = Field(None, min_length=1)
    notificar_inmediato: bool | None = None
    is_active: bool | None = None


class QueueResponse(BaseModel):
    """Cola de enrutamiento completa (vista de administración)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    nombre: str
    descripcion_semantica: str
    notificar_inmediato: bool
    is_active: bool
    created_at: datetime


class QueueActiveForLLM(BaseModel):
    """DTO compacto de una cola activa, pensado para inyectarse en el prompt de n8n."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    descripcion_semantica: str


# --- Tipos de documento ------------------------------------------------------


class DocumentTypeCreate(BaseModel):
    """Datos para crear un tipo de documento clínico."""

    codigo: str = Field(..., min_length=1, max_length=50)
    nombre: str = Field(..., min_length=1, max_length=80)
    descripcion: str | None = None


class DocumentTypeUpdate(BaseModel):
    """Actualización parcial de un tipo de documento. El `codigo` es inmutable."""

    nombre: str | None = Field(None, min_length=1, max_length=80)
    descripcion: str | None = None
    is_active: bool | None = None


class DocumentTypeActiveForLLM(BaseModel):
    """DTO compacto de un tipo de documento activo, pensado para inyectarse en el prompt de n8n."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    descripcion: str | None


class DocumentTypeResponse(BaseModel):
    """Tipo de documento clínico (vista de administración)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    nombre: str
    descripcion: str | None
    is_active: bool
    created_at: datetime


# --- Borrado -----------------------------------------------------------------


class DeleteResponse(BaseModel):
    """Resultado de un Smart Delete: físico si no hay documentos asociados, lógico si los hay."""

    message: str
    deletion_type: DeletionType
