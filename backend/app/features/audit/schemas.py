"""Esquemas Pydantic para la feature de auditoría humana."""

from datetime import date, datetime
from typing import Annotated, Any
from uuid import UUID

from pydantic import BaseModel, StringConstraints

from app.features.documents.schemas import (
    ArchivoPreview,
    DatosGeneralesExtract,
    DetalleClinicoExtract,
    NivelPrioridad,
)

# Texto obligatorio: se recortan los espacios antes de validar el largo, así "   " no pasa.
TextoObligatorio = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class AuditDetailResponse(BaseModel):
    """Detalle de un caso de auditoría, con URLs pre-firmadas para visualizar los binarios originales."""

    documento_id: str
    estado: str
    oci_preview_url: str
    archivos: list[ArchivoPreview]
    preview_expira_en_minutos: int
    motivos_auditoria: list[str]
    identificacion_paciente: str | None
    tipo_identificacion: str | None
    pais_identificacion: str | None
    nombre_paciente: str | None
    edad_paciente: int | None
    fecha_nacimiento: date | None
    sexo: str | None
    numero_ficha: str | None
    medico_nombre: str | None
    medico_identificacion: str | None
    institucion_emisora: str | None
    fecha_documento: date | None
    tipo_documento: str
    especialidad: str | None
    nivel_prioridad: str
    score_confianza: float
    diagnostico_principal: str | None
    cie10_sugerido: str | None
    cie10_origen: str | None
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

    Usa la **misma estructura que la ingesta** (`datos_generales`, `detalle_clinico`) y pasa por las
    mismas normalizaciones y validaciones: identificación (dígito verificador), CIE-10 y
    coherencia del detalle con el tipo. El paciente debe tener nombre y el documento un
    diagnóstico principal.

    `especialidad` y `detalle_clinico` son opcionales: si no se envían, se conservan los
    extraídos por la IA. Si el auditor cambia el tipo, debe enviar el detalle del nuevo tipo (o
    `{}`): el formulario de auditoría muestra los campos que corresponden al tipo elegido.
    """

    tipo_documento: str
    nivel_prioridad: NivelPrioridad
    destino_enrutamiento: str
    especialidad: str | None = None
    datos_generales: DatosGeneralesExtract
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
