"""Modelos ORM de los catálogos y tablas maestras de MediFlow.

`RoutingQueue` define las colas a las que el pipeline de n8n puede enrutar un documento; su
`descripcion_semantica` se inyecta en el prompt del LLM para que elija el destino correcto.
`DocumentType` define los tipos de documentos clínicos admitidos por la clasificación; su
`campos_extraccion` (JSON Schema opcional) indica al LLM qué campos adicionales extraer.

La relación con `clinical_documents` es por valor (`destino_enrutamiento` = `RoutingQueue.codigo`,
`tipo_documento` = `DocumentType.codigo`) y no por FK, por eso el borrado se decide consultando
el uso real (ver `service.smart_delete_*`).

Los registros `es_sistema` (OTRO y Ficha_Clinica) son de los que depende el pipeline y no se
pueden eliminar ni desactivar. Cada alta, cambio o borrado queda en `CatalogHistory`.
"""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RoutingQueue(Base):
    """Cola de enrutamiento de documentos clínicos."""

    __tablename__ = "routing_queues"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    codigo: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion_semantica: Mapped[str] = mapped_column(Text, nullable=False)
    notificar_inmediato: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    es_sistema: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )


class DocumentType(Base):
    """Tipo de documento clínico admitido por el pipeline de clasificación."""

    __tablename__ = "document_types"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    codigo: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(80), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    campos_extraccion: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    es_sistema: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )


class CatalogHistory(Base):
    """Bitácora de cambios de los catálogos: quién cambió qué, cuándo y con qué valores.

    `registro_id` no es FK: el historial debe sobrevivir al borrado físico del registro.
    `cambios` es `{campo: {"antes": ..., "despues": ...}}` solo con los campos modificados.
    """

    __tablename__ = "catalog_history"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    catalogo: Mapped[str] = mapped_column(String(30), nullable=False)
    registro_id: Mapped[UUID] = mapped_column(index=True, nullable=False)
    codigo: Mapped[str] = mapped_column(String(80), nullable=False)
    accion: Mapped[str] = mapped_column(String(20), nullable=False)
    cambios: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    changed_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
