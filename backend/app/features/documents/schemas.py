"""Esquemas Pydantic para la feature de ingesta y consulta de documentos clínicos."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PacienteExtract(BaseModel):
    """Datos del paciente extraídos por el pipeline de OCR/LLM."""

    nombre: str | None = None
    edad: int | None = None
    rut: str | None = None


class MedicoExtract(BaseModel):
    """Datos del profesional solicitante extraídos por el pipeline."""

    nombre: str | None = None
    matricula: str | None = None


class ClasificacionExtract(BaseModel):
    """Resultado de la clasificación automática del documento."""

    tipo_documento: str
    especialidad: str | None = None
    nivel_prioridad: str
    score_confianza_clasificacion: float


class DecisionEnrutamientoExtract(BaseModel):
    """Decisión de enrutamiento tomada por el pipeline de triaje."""

    destino_principal: str
    requiere_auditoria_humana: bool
    justificacion_enrutamiento: str | None = None


class DatosExtraidos(BaseModel):
    """Datos clínicos extraídos del documento original."""

    paciente: PacienteExtract
    medico_solicitante: MedicoExtract
    diagnostico_principal: str | None = None
    cie10_sugerido: str | None = None


class IngestPayload(BaseModel):
    """Payload enviado por el workflow de n8n tras procesar un documento clínico."""

    documento_id: str
    tipo_archivo: str
    archivo_base64: str
    clasificacion: ClasificacionExtract
    datos_extraidos: DatosExtraidos
    decision_enrutamiento: DecisionEnrutamientoExtract


class IngestResponse(BaseModel):
    """Confirmación de ingesta: identificador, estado asignado y rutas de respaldo en OCI."""

    documento_id: str
    estado: str
    oci_binary_path: str
    oci_json_path: str
    requiere_auditoria: bool


class DocumentListItemResponse(BaseModel):
    """DTO resumido de un documento clínico, usado en resultados de búsqueda."""

    model_config = ConfigDict(from_attributes=True)

    documento_id: str
    estado: str
    rut_paciente: str | None
    nombre_paciente: str | None
    tipo_documento: str
    nivel_prioridad: str
    score_confianza: Decimal
    destino_enrutamiento: str | None
    created_at: datetime
