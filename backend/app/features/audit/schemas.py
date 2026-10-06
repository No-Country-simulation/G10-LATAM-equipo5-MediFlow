"""Esquemas Pydantic para la feature de auditoría humana."""

from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, Field, StringConstraints

from app.features.documents.schemas import DetalleClinicoExtract, NivelPrioridad

# Texto obligatorio: se recortan los espacios antes de validar el largo, así "   " no pasa.
TextoObligatorio = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ArchivoPreview(BaseModel):
    """Un archivo del documento con su URL pre-firmada de solo lectura.

    `visualizable` indica si el navegador puede mostrarlo (PDF/PNG/JPG); TIFF y DICOM se
    ofrecen como descarga.
    """

    orden: int
    tipo_archivo: str
    rol: str | None
    url: str
    visualizable: bool


class AuditDetailResponse(BaseModel):
    """Detalle de un caso de auditoría, con URLs pre-firmadas para visualizar los binarios originales."""

    documento_id: str
    estado: str
    oci_preview_url: str
    archivos: list[ArchivoPreview]
    preview_expira_en_minutos: int
    motivos_auditoria: list[str]
    rut_paciente: str | None
    nombre_paciente: str | None
    edad_paciente: int | None
    medico_nombre: str | None
    medico_rut: str | None
    tipo_documento: str
    especialidad: str | None
    nivel_prioridad: str
    score_confianza: float
    diagnostico_principal: str | None
    cie10_sugerido: str | None
    destino_enrutamiento: str | None
    raw_extracted_json: dict[str, Any]
    uploaded_by_id: UUID | None
    asignado_a_id: UUID | None
    asignado_a_username: str | None
    asignado_at: datetime | None
    audited_by_id: UUID | None
    audited_at: datetime | None
    audit_notes: str | None
    created_at: datetime


class AuditResolveRequest(BaseModel):
    """Datos corregidos por el auditor humano para resolver un caso pendiente.

    `especialidad` y `detalle_clinico` son opcionales: si no se envían, se conservan los
    extraídos por la IA. Si se envían, reemplazan a los anteriores. En ambos casos el
    `detalle_clinico` final debe ser coherente con el `tipo_documento` final (si el auditor
    cambia el tipo, debe enviar el detalle del nuevo tipo, o `{}`).
    """

    rut_paciente: TextoObligatorio
    nombre_paciente: TextoObligatorio
    edad_paciente: int | None = None
    medico_nombre: str | None = None
    medico_rut: str | None = None
    tipo_documento: str
    nivel_prioridad: NivelPrioridad
    diagnostico_principal: TextoObligatorio
    cie10_sugerido: str | None = Field(None, max_length=10)
    destino_enrutamiento: str
    especialidad: str | None = None
    detalle_clinico: DetalleClinicoExtract | None = None
    audit_notes: TextoObligatorio


class AuditDiscardRequest(BaseModel):
    """Descarte de un caso: documento no clínico, duplicado o ilegible sin remedio."""

    motivo: TextoObligatorio


class AuditClaimResponse(BaseModel):
    """Estado de la asignación ("tomar caso") de un documento en auditoría."""

    documento_id: str
    asignado_a_id: UUID
    asignado_a_username: str
    asignado_at: datetime
    expira_at: datetime
