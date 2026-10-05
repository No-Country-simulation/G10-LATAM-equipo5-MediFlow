"""Esquemas Pydantic para la feature de catálogos y tablas maestras."""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from jsonschema import Draft202012Validator, SchemaError
from pydantic import BaseModel, ConfigDict, Field, field_validator

DeletionType = Literal["HARD_DELETE", "SOFT_DELETE"]
CatalogAction = Literal["CREATE", "UPDATE", "HARD_DELETE", "SOFT_DELETE"]

# El `codigo` es inmutable y viaja en el prompt, en el JSON del LLM y en cada documento:
# sin espacios ni tildes. Los tipos van en mayúsculas (RECETA); las colas admiten
# mayúsculas y minúsculas por compatibilidad con la semilla (Cola_Emergencia_Medica).
_QUEUE_CODIGO_PATTERN = r"^[A-Za-z0-9_]+$"
_DOC_TYPE_CODIGO_PATTERN = r"^[A-Z0-9_]+$"


def _validate_campos_extraccion(schema: dict[str, Any] | None) -> dict[str, Any] | None:
    """Exige un JSON Schema válido de tipo objeto: es lo que llena el LLM en `campos_adicionales`."""
    if schema is None:
        return None
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as exc:
        raise ValueError(f"campos_extraccion no es un JSON Schema válido: {exc.message}") from exc
    if schema.get("type") != "object":
        raise ValueError('campos_extraccion debe ser un JSON Schema con "type": "object"')
    return schema


def _reject_null(value: Any) -> Any:
    if value is None:
        raise ValueError("no puede ser null")
    return value


# --- Colas de enrutamiento ---------------------------------------------------


class QueueCreate(BaseModel):
    """Datos para crear una cola de enrutamiento."""

    codigo: str = Field(..., min_length=1, max_length=80, pattern=_QUEUE_CODIGO_PATTERN)
    nombre: str = Field(..., min_length=1, max_length=150)
    descripcion_semantica: str = Field(..., min_length=1)
    notificar_inmediato: bool = False


class QueueUpdate(BaseModel):
    """Actualización parcial de una cola. El `codigo` es inmutable (lo referencian los documentos)."""

    nombre: str | None = Field(None, min_length=1, max_length=150)
    descripcion_semantica: str | None = Field(None, min_length=1)
    notificar_inmediato: bool | None = None
    is_active: bool | None = None

    no_null = field_validator(
        "nombre", "descripcion_semantica", "notificar_inmediato", "is_active"
    )(_reject_null)


class QueueResponse(BaseModel):
    """Cola de enrutamiento completa (vista de administración)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    nombre: str
    descripcion_semantica: str
    notificar_inmediato: bool
    is_active: bool
    es_sistema: bool
    created_at: datetime
    updated_at: datetime | None = None
    updated_by_id: UUID | None = None


class QueueActiveForLLM(BaseModel):
    """DTO compacto de una cola activa, pensado para inyectarse en el prompt de n8n.

    `notificar_inmediato` le indica a n8n cuándo generar `notificacion_generada`.
    """

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    descripcion_semantica: str
    notificar_inmediato: bool


# --- Tipos de documento ------------------------------------------------------


class DocumentTypeCreate(BaseModel):
    """Datos para crear un tipo de documento clínico."""

    codigo: str = Field(..., min_length=1, max_length=50, pattern=_DOC_TYPE_CODIGO_PATTERN)
    nombre: str = Field(..., min_length=1, max_length=80)
    descripcion: str = Field(..., min_length=1)
    campos_extraccion: dict[str, Any] | None = None

    schema_valido = field_validator("campos_extraccion")(_validate_campos_extraccion)


class DocumentTypeUpdate(BaseModel):
    """Actualización parcial de un tipo de documento. El `codigo` es inmutable.

    `campos_extraccion: null` elimina el esquema de campos adicionales del tipo.
    """

    nombre: str | None = Field(None, min_length=1, max_length=80)
    descripcion: str | None = Field(None, min_length=1)
    campos_extraccion: dict[str, Any] | None = None
    is_active: bool | None = None

    no_null = field_validator("nombre", "descripcion", "is_active")(_reject_null)
    schema_valido = field_validator("campos_extraccion")(_validate_campos_extraccion)


class DocumentTypeActiveForLLM(BaseModel):
    """DTO compacto de un tipo de documento activo, pensado para inyectarse en el prompt de n8n."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    descripcion: str
    campos_extraccion: dict[str, Any] | None


class DocumentTypeResponse(BaseModel):
    """Tipo de documento clínico (vista de administración)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    nombre: str
    descripcion: str
    campos_extraccion: dict[str, Any] | None
    is_active: bool
    es_sistema: bool
    created_at: datetime
    updated_at: datetime | None = None
    updated_by_id: UUID | None = None


# --- Borrado e historial -----------------------------------------------------


class DeleteResponse(BaseModel):
    """Resultado de un Smart Delete: físico si no hay documentos asociados, lógico si los hay."""

    message: str
    deletion_type: DeletionType


class CatalogHistoryResponse(BaseModel):
    """Entrada de la bitácora de cambios de un registro de catálogo."""

    model_config = ConfigDict(from_attributes=True)

    accion: CatalogAction
    cambios: dict[str, Any]
    changed_by_id: UUID | None
    changed_at: datetime
