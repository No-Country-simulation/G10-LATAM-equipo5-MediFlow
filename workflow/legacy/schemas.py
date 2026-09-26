from pydantic import BaseModel, Field
from typing import Optional, Literal

class MedicoSolicitante(BaseModel):
    nombre: str = Field(..., description="Nombre completo del médico, ej: Dra. Renata Silveira")
    matricula: str = Field(..., description="Número de matrícula profesional o registro médico")

class Paciente(BaseModel):
    nombre: str = Field(..., description="Nombre completo del paciente")
    edad: Optional[int] = Field(None, description="Edad del paciente si está disponible")

class Clasificacion(BaseModel):
    tipo_documento: Literal[
        "Receta Médica",
        "Informe de Estudio por Imágenes/Laboratorio",
        "Orden de Solicitud de Procedimiento",
        "Epicrisis / Informe de Alta",
        "Certificado Médico"
    ] = Field(..., description="Categoría estandarizada del documento clínico")
    especialidad: str = Field(..., description="Especialidad médica vinculada al caso, ej: Radiología / Neumonología")
    nivel_prioridad: Literal["Rutina", "Urgente", "Ambiguo"] = Field(..., description="Nivel de prioridad clínica detectado")
    score_confianza_clasificacion: float = Field(..., ge=0.0, le=1.0, description="Nivel de confianza de la clasificación entre 0 y 1")

class DatosExtraidos(BaseModel):
    paciente: Paciente
    medico_solicitante: MedicoSolicitante
    estudio_realizado: Optional[str] = Field(None, description="Nombre del estudio, receta o procedimiento")
    diagnostico_principal: str = Field(..., description="Diagnóstico principal o hipótesis diagnóstica")
    cie10_sugerido: Optional[str] = Field(None, description="Código CIE-10 normalizado sugerido, ej: I26.9")

class NotificacionGenerada(BaseModel):
    canal: str = Field(..., description="Canal de alerta, ej: Alerta_Guardia_Medica")
    mensaje: str = Field(..., description="Mensaje redactado para el equipo médico o de guardia")

class DecisionEnrutamiento(BaseModel):
    destino_principal: Literal[
        "Cola_Emergencia_Medica",
        "Auditoria_Autorizaciones",
        "Farmacia_Hospitalaria",
        "Historia_Clinica_Electronica",
        "Cola_Revision_Humana"
    ] = Field(..., description="Destino del documento según la lógica del agente")
    requiere_auditoria_humana: bool = Field(..., description="True si el score es bajo o hay ambigüedad crítica")
    justificacion_enrutamiento: str = Field(..., description="Explicación clínica y técnica de la decisión")
    notificacion_generada: Optional[NotificacionGenerada] = None

class AlmacenamientoOCI(BaseModel):
    bucket: str = Field("mediflow-documentos-clinicos", description="Nombre del bucket en OCI")
    ruta_objeto: str = Field(..., description="Ruta dinámica según estado, ej: procesados/urgentes/DOC-ID.json")
    status_backup: Literal["exito", "pendiente", "error"] = Field("exito")

class MediFlowResponseSchema(BaseModel):
    status: Literal["procesado", "en_revision", "error"] = Field(..., description="Estado global del procesamiento")
    documento_id: str = Field(..., description="Identificador único del documento clínico")
    clasificacion: Clasificacion
    datos_extraidos: DatosExtraidos
    decision_enrutamiento: DecisionEnrutamiento
    almacenamiento_oci: AlmacenamientoOCI
