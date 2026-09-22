"""Modelo ORM que mapea la tabla `clinical_documents` existente en PostgreSQL."""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ClinicalDocument(Base):
    """Documento clínico ingresado, clasificado y enrutado por el pipeline de triaje."""

    __tablename__ = "clinical_documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    documento_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False)

    rut_paciente: Mapped[str | None] = mapped_column(String(20), index=True)
    nombre_paciente: Mapped[str | None] = mapped_column(String(150))
    edad_paciente: Mapped[int | None] = mapped_column(Integer)

    medico_nombre: Mapped[str | None] = mapped_column(String(150))
    medico_rut: Mapped[str | None] = mapped_column(String(20))

    tipo_documento: Mapped[str] = mapped_column(String(80), nullable=False)
    especialidad: Mapped[str | None] = mapped_column(String(100))
    nivel_prioridad: Mapped[str] = mapped_column(String(20), nullable=False)
    score_confianza: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    requiere_auditoria: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    diagnostico_principal: Mapped[str | None] = mapped_column(Text)
    cie10_sugerido: Mapped[str | None] = mapped_column(String(10))
    destino_enrutamiento: Mapped[str | None] = mapped_column(String(80))
    justificacion_enrutamiento: Mapped[str | None] = mapped_column(Text)

    oci_bucket_name: Mapped[str] = mapped_column(String(100), nullable=False)
    oci_binary_path: Mapped[str] = mapped_column(String(255), nullable=False)
    oci_json_path: Mapped[str] = mapped_column(String(255), nullable=False)

    raw_extracted_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    audited_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    audit_notes: Mapped[str | None] = mapped_column(Text)
    audited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
