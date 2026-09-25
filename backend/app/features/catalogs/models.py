"""Modelos ORM de los catálogos y tablas maestras de MediFlow.

`RoutingQueue` define las colas a las que el pipeline de n8n puede enrutar un documento; su
`descripcion_semantica` se inyecta en el prompt del LLM para que elija el destino correcto.
`DocumentType` define los tipos de documentos clínicos admitidos por la clasificación.

La relación con `clinical_documents` es por valor (`destino_enrutamiento` = `RoutingQueue.codigo`,
`tipo_documento` = `DocumentType.nombre`) y no por FK, por eso el borrado se decide consultando
el uso real (ver `service.smart_delete_*`).
"""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, String, Text, func
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
    descripcion: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
