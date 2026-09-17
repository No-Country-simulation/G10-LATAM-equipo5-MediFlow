"""Modelos de dominio (Pydantic v2) para el triaje clinico de documentos."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class NivelPrioridad(str, Enum):
    """Nivel de urgencia asignado a un documento clinico tras el triaje."""

    CRITICO = "CRITICO"
    ALTO = "ALTO"
    MEDIO = "MEDIO"
    BAJO = "BAJO"


class TipoDocumento(str, Enum):
    """Clasificacion del tipo de documento clinico ingresado."""

    RECETA = "RECETA"
    LABORATORIO = "LABORATORIO"
    RADIOLOGIA = "RADIOLOGIA"
    CERTIFICADO = "CERTIFICADO"
    DESCONOCIDO = "DESCONOCIDO"


class EstadoTriaje(str, Enum):
    """Estado del ciclo de vida del documento dentro del pipeline de triaje."""

    PROCESADO = "PROCESADO"
    PENDIENTE_AUDITORIA = "PENDIENTE_AUDITORIA"
    APROBADO = "APROBADO"
    RECHAZADO = "RECHAZADO"


class MedicamentoItem(BaseModel):
    """Representa un medicamento extraido de una receta o reporte clinico."""

    nombre: str = Field(..., min_length=1, description="Nombre comercial o generico del medicamento")
    dosis: str = Field(..., description="Dosis indicada, por ejemplo '500 mg'")
    frecuencia: str = Field(..., description="Frecuencia de administracion, por ejemplo 'cada 8 horas'")


class DatosClinicosSchema(BaseModel):
    """Datos clinicos estructurados extraidos de un documento fuente."""

    paciente_nombre: str = Field(..., min_length=1)
    paciente_edad: int | None = Field(default=None, ge=0, le=130)
    medico_solicitante: str | None = Field(default=None)
    diagnostico_principal: str = Field(..., min_length=1)
    cie10_sugerido: str | None = Field(
        default=None, description="Codigo CIE-10 sugerido para el diagnostico principal"
    )
    medicamentos: list[MedicamentoItem] = Field(default_factory=list)


class TriajeFinalSchema(BaseModel):
    """Resultado final del pipeline de triaje, listo para enrutamiento y auditoria."""

    documento_id: str = Field(..., min_length=1)
    status: EstadoTriaje = Field(default=EstadoTriaje.PROCESADO)
    tipo_documento: TipoDocumento = Field(default=TipoDocumento.DESCONOCIDO)
    nivel_prioridad: NivelPrioridad = Field(default=NivelPrioridad.MEDIO)
    score_confianza: float = Field(..., ge=0.0, le=1.0)
    datos_extraidos: DatosClinicosSchema
    justificacion_decision: str = Field(
        ..., description="Explicacion generada por el agente sobre la clasificacion y prioridad"
    )
    destino_enrutamiento: str = Field(
        ..., description="Area, cola o sistema al que se enruta el documento"
    )
    ruta_oci: str | None = Field(
        default=None, description="Ruta del objeto almacenado en OCI Object Storage"
    )
