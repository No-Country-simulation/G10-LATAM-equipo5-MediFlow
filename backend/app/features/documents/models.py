"""Modelos ORM de la feature de documentos clínicos.

`ClinicalDocument` es la tabla principal (datos administrativos, clasificación, triaje y
enrutamiento). El detalle clínico específico de cada `tipo_documento` que es realista
consultar/filtrar de forma agregada (medicamentos, parámetros de laboratorio, procedimientos)
vive en tablas hijas normalizadas en lugar de solo dentro de `raw_extracted_json`. El texto
libre de baja estructura (hallazgos de imagenología, evolución de una epicrisis) se mantiene
únicamente en `raw_extracted_json`: no se filtra por él y normalizarlo no simplificaría nada.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.features.catalogs.models import Area


# Eliminación lógica (solo ADMIN): el documento se conserva con quién, cuándo y por qué, y se puede
# restaurar al estado que tenía (`estado_previo`). Sale de todos los listados salvo el filtro
# "Eliminados" del ADMIN.
ESTADO_ELIMINADO = "ELIMINADO"


class ClinicalDocument(Base):
    """Documento clínico ingresado, clasificado y enrutado por el pipeline de triaje."""

    __tablename__ = "clinical_documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    documento_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    estado: Mapped[str] = mapped_column(String(30), nullable=False)

    # Identificación de cualquier país (RUT, DNI, CURP, cédula, CPF, pasaporte...), normalizada sin
    # puntos ni espacios; `pais_identificacion` en ISO 3166-1 alfa-2.
    identificacion_paciente: Mapped[str | None] = mapped_column(String(30), index=True)
    tipo_identificacion: Mapped[str | None] = mapped_column(String(15))
    pais_identificacion: Mapped[str | None] = mapped_column(String(2))
    nombre_paciente: Mapped[str | None] = mapped_column(String(150))
    edad_paciente: Mapped[int | None] = mapped_column(Integer)
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date)
    sexo: Mapped[str | None] = mapped_column(String(1))
    # N° de ficha / historia clínica / expediente: lo asigna cada institución.
    numero_ficha: Mapped[str | None] = mapped_column(String(50), index=True)

    # Profesional responsable del documento (quien lo informa o firma); el detalle de todos los
    # profesionales con su rol está en `clinical_document_professionals`.
    medico_nombre: Mapped[str | None] = mapped_column(String(150))
    medico_identificacion: Mapped[str | None] = mapped_column(String(30))

    institucion_emisora: Mapped[str | None] = mapped_column(String(200))
    fecha_documento: Mapped[date | None] = mapped_column(Date, index=True)

    tipo_documento: Mapped[str] = mapped_column(String(80), nullable=False)
    especialidad: Mapped[str | None] = mapped_column(String(100))
    nivel_prioridad: Mapped[str] = mapped_column(String(20), nullable=False)
    score_confianza: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    requiere_auditoria: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    diagnostico_principal: Mapped[str | None] = mapped_column(Text)
    cie10_sugerido: Mapped[str | None] = mapped_column(String(10))
    # DOCUMENTO: el código venía impreso; INFERIDO: lo propuso la IA; AUDITOR: lo fijó un auditor.
    cie10_origen: Mapped[str | None] = mapped_column(String(10))
    destino_enrutamiento: Mapped[str | None] = mapped_column(String(80))
    justificacion_enrutamiento: Mapped[str | None] = mapped_column(Text)

    oci_bucket_name: Mapped[str] = mapped_column(String(100), nullable=False)
    oci_json_path: Mapped[str] = mapped_column(String(255), nullable=False)

    # Respaldo íntegro del payload (incluye `detalle_clinico`: texto libre de imagenología,
    # evolución de epicrisis, etc. que no tiene columna relacional propia).
    raw_extracted_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Usuario cuyo token usó n8n para llamar a `/ingest` (quien subió el documento desde el front).
    uploaded_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Área del usuario que subió el documento, copiada al ingerirlo: si el usuario cambia de
    # área después, el documento conserva el área de la que salió.
    area_origen_id: Mapped[UUID | None] = mapped_column(ForeignKey("areas.id"), index=True)

    audited_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    audit_notes: Mapped[str | None] = mapped_column(Text)
    audited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # "Tomar caso": auditor que está revisando el documento. El username se guarda
    # desnormalizado para mostrar "En revisión por X" en la bandeja sin un JOIN a users.
    asignado_a_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    asignado_a_username: Mapped[str | None] = mapped_column(String(50))
    asignado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Consola de Triaje: quién marcó el caso como atendido y cuándo (sale de la consola). El
    # username se guarda desnormalizado, igual que `asignado_a_username`.
    atendido_por_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    atendido_por_username: Mapped[str | None] = mapped_column(String(50))
    atendido_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    # Eliminación lógica (ver `ESTADO_ELIMINADO`).
    eliminado_por_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    eliminado_por_username: Mapped[str | None] = mapped_column(String(50))
    eliminado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    motivo_eliminacion: Mapped[str | None] = mapped_column(Text)
    estado_previo: Mapped[str | None] = mapped_column(String(30))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Many-to-one: un LEFT JOIN en la misma consulta, también en el listado paginado.
    area_origen: Mapped[Area | None] = relationship(lazy="joined")

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
    diagnoses: Mapped[list["ClinicalDocumentDiagnosis"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ClinicalDocumentDiagnosis.orden",
        lazy="selectin",
    )
    requested_exams: Mapped[list["ClinicalDocumentRequestedExam"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ClinicalDocumentRequestedExam.orden",
        lazy="selectin",
    )
    professionals: Mapped[list["ClinicalDocumentProfessional"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ClinicalDocumentProfessional.orden",
        lazy="selectin",
    )
    # Historial de correcciones humanas, de la más reciente a la más antigua.
    corrections: Mapped[list["ClinicalDocumentCorrection"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="desc(ClinicalDocumentCorrection.corrected_at)",
        lazy="selectin",
    )

    @property
    def motivos_auditoria(self) -> list[str]:
        """Motivos del triaje de ingesta por los que el documento fue (o está) en auditoría."""
        return ((self.raw_extracted_json or {}).get("triaje") or {}).get("motivos_auditoria", [])


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
    # Huella SHA-256 (hex) del archivo: detecta cuando se vuelve a subir el mismo archivo.
    sha256: Mapped[str | None] = mapped_column(String(64), index=True)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="attachments")


class ClinicalDocumentMedication(Base):
    """Medicamento prescrito o administrado (receta, indicaciones de alta, urgencias, atención)."""

    __tablename__ = "clinical_document_medications"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    dosis: Mapped[str | None] = mapped_column(String(100))
    frecuencia: Mapped[str | None] = mapped_column(String(100))
    via: Mapped[str | None] = mapped_column(String(50))
    duracion_tratamiento: Mapped[str | None] = mapped_column(String(100))
    cantidad: Mapped[str | None] = mapped_column(String(100))
    tipo: Mapped[str] = mapped_column(String(15), nullable=False, default="PRESCRITO")
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
    muestra: Mapped[str | None] = mapped_column(String(50))
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
    valor: Mapped[str | None] = mapped_column(String(100))
    unidad: Mapped[str | None] = mapped_column(String(50))
    rango_referencia: Mapped[str | None] = mapped_column(String(100))
    alterado: Mapped[bool | None] = mapped_column(Boolean)
    critico: Mapped[bool | None] = mapped_column(Boolean)
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


class ClinicalDocumentDiagnosis(Base):
    """Diagnóstico del documento (principal o secundario, confirmado o presuntivo).

    Tabla propia para responder rápido "qué documentos tienen el CIE-10 X". `origen_cie10` dice si
    el código venía impreso (DOCUMENTO), lo propuso la IA (INFERIDO) o lo fijó un auditor (AUDITOR).
    """

    __tablename__ = "clinical_document_diagnoses"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    descripcion: Mapped[str | None] = mapped_column(String(300))
    cie10: Mapped[str | None] = mapped_column(String(10), index=True)
    tipo: Mapped[str] = mapped_column(String(15), nullable=False, default="SECUNDARIO")
    certeza: Mapped[str] = mapped_column(String(15), nullable=False, default="PRESUNTIVO")
    origen_cie10: Mapped[str | None] = mapped_column(String(10))
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="diagnoses")


class ClinicalDocumentRequestedExam(Base):
    """Examen o estudio pedido en una orden médica (laboratorio, imagenología, procedimiento)."""

    __tablename__ = "clinical_document_requested_exams"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    codigo: Mapped[str | None] = mapped_column(String(30))
    nombre: Mapped[str] = mapped_column(String(300), nullable=False)
    categoria: Mapped[str] = mapped_column(String(20), nullable=False, default="OTRO")
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="requested_exams")


class ClinicalDocumentProfessional(Base):
    """Profesional que participa en el documento con su rol: quien solicita, informa, trata o
    recibe la derivación. El responsable se copia además en `clinical_documents.medico_*`."""

    __tablename__ = "clinical_document_professionals"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    identificacion: Mapped[str | None] = mapped_column(String(30))
    registro_profesional: Mapped[str | None] = mapped_column(String(50))
    especialidad: Mapped[str | None] = mapped_column(String(100))
    rol: Mapped[str] = mapped_column(String(20), nullable=False, default="OTRO")
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    document: Mapped["ClinicalDocument"] = relationship(back_populates="professionals")


class ClinicalDocumentCorrection(Base):
    """Corrección humana de un documento: la resolución de su auditoría (`AUDITORIA`) o un ajuste
    posterior de un documento ya procesado o auditado (`CORRECCION`).

    `cambios` guarda cada valor modificado como `{campo, etiqueta, antes, despues}`; el username se
    copia para que el historial siga legible si el usuario se elimina.
    """

    __tablename__ = "clinical_document_corrections"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("clinical_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    origen: Mapped[str] = mapped_column(String(20), nullable=False)
    justificacion: Mapped[str] = mapped_column(Text, nullable=False)
    cambios: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    corrected_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    corrected_by_username: Mapped[str] = mapped_column(String(50), nullable=False)
    corrected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.current_timestamp()
    )

    document: Mapped["ClinicalDocument"] = relationship(back_populates="corrections")
