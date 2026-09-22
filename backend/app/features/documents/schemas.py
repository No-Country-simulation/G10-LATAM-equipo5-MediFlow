"""Esquemas Pydantic para la feature de ingesta y consulta de documentos clínicos."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PacienteExtract(BaseModel):
    """Datos del paciente extraídos por el pipeline de OCR/LLM."""

    nombre: str | None = None
    edad: int | None = None
    rut: str | None = None


class MedicoExtract(BaseModel):
    """Datos del profesional solicitante extraídos por el pipeline."""

    nombre: str | None = None
    rut: str | None = None


class ClasificacionExtract(BaseModel):
    """Resultado de la clasificación automática del documento."""

    tipo_documento: str
    especialidad: str | None = None
    nivel_prioridad: str
    score_confianza_clasificacion: float


class NotificacionGenerada(BaseModel):
    """Alerta generada por el pipeline para casos críticos."""

    canal: str
    mensaje: str


class DecisionEnrutamientoExtract(BaseModel):
    """Decisión de enrutamiento tomada por el pipeline de triaje."""

    destino_principal: str
    requiere_auditoria_humana: bool
    justificacion_enrutamiento: str | None = None
    notificacion_generada: NotificacionGenerada | None = None


class DatosExtraidos(BaseModel):
    """Datos clínicos extraídos del documento original."""

    paciente: PacienteExtract
    medico_solicitante: MedicoExtract
    estudio_realizado: str | None = None
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


class AlmacenamientoOci(BaseModel):
    """Resultado del respaldo del documento en OCI Object Storage."""

    bucket: str
    ruta_objeto: str
    status_backup: str


class IngestResponse(BaseModel):
    """Respuesta final del procesamiento, consumida por el frontend React.

    Repite la información recibida desde n8n y agrega `status` y `almacenamiento_oci`.
    """

    status: str
    documento_id: str
    clasificacion: ClasificacionExtract
    datos_extraidos: DatosExtraidos
    decision_enrutamiento: DecisionEnrutamientoExtract
    almacenamiento_oci: AlmacenamientoOci


class DocumentListItemResponse(BaseModel):
    """DTO resumido de un documento clínico, usado en el listado paginado y en resoluciones de auditoría."""

    model_config = ConfigDict(from_attributes=True)

    documento_id: str
    estado: str
    rut_paciente: str | None
    nombre_paciente: str | None
    tipo_documento: str
    nivel_prioridad: str
    score_confianza: float
    destino_enrutamiento: str | None
    oci_json_path: str
    created_at: datetime


class PaginatedDocumentResponse(BaseModel):
    """Página de resultados de la bandeja documental, con metadatos de paginación."""

    items: list[DocumentListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    message: str | None = None
