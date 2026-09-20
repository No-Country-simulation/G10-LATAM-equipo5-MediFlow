"""Esquemas Pydantic para la feature de auditoría humana."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

NivelPrioridad = Literal["Rutina", "Prioritario", "Urgente"]


class AuditDetailResponse(BaseModel):
    """Detalle de un caso pendiente de auditoría, con URL pre-firmada para visualizar el binario original."""

    documento_id: str
    estado: str
    oci_preview_url: str
    rut_paciente: str | None
    nombre_paciente: str | None
    edad_paciente: int | None
    medico_nombre: str | None
    medico_matricula: str | None
    tipo_documento: str
    especialidad: str | None
    nivel_prioridad: str
    score_confianza: float
    diagnostico_principal: str | None
    cie10_sugerido: str | None
    destino_enrutamiento: str | None
    raw_extracted_json: dict[str, Any]
    created_at: datetime


class AuditResolveRequest(BaseModel):
    """Datos corregidos por el auditor humano para resolver un caso pendiente."""

    rut_paciente: str
    nombre_paciente: str
    edad_paciente: int | None = None
    medico_nombre: str | None = None
    medico_matricula: str | None = None
    tipo_documento: str
    nivel_prioridad: NivelPrioridad
    diagnostico_principal: str
    cie10_sugerido: str | None = None
    destino_enrutamiento: str
    audit_notes: str = Field(min_length=1)
