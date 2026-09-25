"""Modelos ORM de la feature de documentos clínicos.

`ClinicalDocument` es la tabla principal (datos administrativos, clasificación, triaje y
enrutamiento). El detalle clínico específico de cada `tipo_documento` que es realista
consultar/filtrar de forma agregada (medicamentos, parámetros de laboratorio, procedimientos)
vive en tablas hijas normalizadas en lugar de solo dentro de `raw_extracted_json`. El texto
libre de baja estructura (hallazgos de imagenología, evolución de una epicrisis) se mantiene
únicamente en `raw_extracted_json`: no se filtra por él y normalizarlo no simplificaría nada.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    oci_json_path: Mapped[str] = mapped_column(String(255), nullable=False)

    # Respaldo íntegro del payload (incluye `detalle_clinico`: texto libre de imagenología,
    # evolución de epicrisis, etc. que no tiene columna relacional propia).
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

    # `lazy="selectin"` en las cuatro relaciones: se cargan en la misma consulta que trae el
    # documento (una query extra por relación, sin N+1) y quedan disponibles de forma segura
    # en el `AsyncSession`, incluso al reasignar la lista completa al re-ingestar un documento
    # (evita el lazy-load implícito que rompe con SQLAlchemy async).
    attachments: Mapped[list["ClinicalDocumentAttachment"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ClinicalDocumentAttachment.orden",
        lazy="selectin",
    )
    medications: Mapped[list["ClinicalDocumentMedication"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ClinicalDocumentMedication.orden",
        lazy="selectin",
    )
    lab_panels: Mapped[list["LabPanel"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="LabPanel.orden",
        lazy="selectin",
    )
    procedures: Mapped[list["ClinicalDocumentProcedure"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ClinicalDocumentProcedure.orden",
        lazy="selectin",
    )


class ClinicalDocumentAttachment(Base):
    """Archivo binario asociado a un documento clínico.

    Un documento puede traer más de un archivo (ej. una orden de Rx con varias placas, o
    una ecotomografía con múltiples capturas más su informe). El de `orden` más bajo es el
    archivo principal, usado como vista previa en la bandeja de auditoría.
    """

    __tablename__ = "clinical_document_attachments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rol: Mapped[str | None] = mapped_column(String(50))
    tipo_archivo: Mapped[str] = mapped_column(String(20), nullable=False)
    oci_path: Mapped[str] = mapped_column(String(255), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="attachments")


class ClinicalDocumentMedication(Base):
    """Ítem de posología (medicamento) extraído de una Receta médica."""

    __tablename__ = "clinical_document_medications"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    dosis: Mapped[str | None] = mapped_column(String(100))
    duracion_tratamiento: Mapped[str | None] = mapped_column(String(100))
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="medications")


class LabPanel(Base):
    """Panel o sección de un Informe de Laboratorio (ej. 'Hemograma', 'Coagulación').

    Un mismo informe trae varios paneles; cada uno agrupa sus propios `LabParameter`.
    """

    __tablename__ = "lab_panels"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre_panel: Mapped[str] = mapped_column(String(150), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="lab_panels")
    parametros: Mapped[list["LabParameter"]] = relationship(
        back_populates="panel",
        cascade="all, delete-orphan",
        order_by="LabParameter.orden",
        lazy="selectin",
    )


class LabParameter(Base):
    """Parámetro individual dentro de un panel de laboratorio (ej. 'Glucosa', 'Hemoglobina').

    Normalizado como tabla propia (en vez de solo JSONB) para poder filtrar/agregar por
    parámetros alterados sin recorrer todo `raw_extracted_json` con cada consulta.
    """

    __tablename__ = "lab_parameters"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    panel_id: Mapped[UUID] = mapped_column(
        ForeignKey("lab_panels.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    valor: Mapped[str | None] = mapped_column(String(50))
    unidad: Mapped[str | None] = mapped_column(String(30))
    rango_referencia: Mapped[str | None] = mapped_column(String(50))
    alterado: Mapped[bool | None] = mapped_column(Boolean)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    panel: Mapped["LabPanel"] = relationship(back_populates="parametros")


class ClinicalDocumentProcedure(Base):
    """Procedimiento realizado durante una internación, extraído de una Epicrisis."""

    __tablename__ = "clinical_document_procedures"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="procedures")
