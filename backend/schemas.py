"""Adaptador del schema del brief (Felipe) al IngestPayload de FastAPI.

El contrato oficial que valida la API está en `app.features.documents.schemas`.
Este módulo conserva el JSON del PDF del hackathon y lo traduce para n8n / pruebas.
"""

from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class MedicoSolicitante(BaseModel):
    nombre: str
    matricula: str


class Paciente(BaseModel):
    nombre: str
    edad: Optional[int] = None


class Clasificacion(BaseModel):
    tipo_documento: str
    especialidad: str
    nivel_prioridad: Literal["Rutina", "Urgente", "Ambiguo"]
    score_confianza_clasificacion: float = Field(..., ge=0.0, le=1.0)


class DatosExtraidos(BaseModel):
    paciente: Paciente
    medico_solicitante: MedicoSolicitante
    estudio_realizado: Optional[str] = None
    diagnostico_principal: str
    cie10_sugerido: Optional[str] = None


class NotificacionGenerada(BaseModel):
    canal: str
    mensaje: str


class DecisionEnrutamiento(BaseModel):
    destino_principal: str
    requiere_auditoria_humana: bool
    justificacion_enrutamiento: str
    notificacion_generada: Optional[NotificacionGenerada] = None


class AlmacenamientoOCI(BaseModel):
    bucket: str = "mediflow-documentos-clinicos"
    ruta_objeto: str
    status_backup: Literal["exito", "pendiente", "error"] = "exito"


class MediFlowResponseSchema(BaseModel):
    """Schema del brief (datos_extraidos). No lo envíes a POST /documents/ingest."""

    status: Literal["procesado", "en_revision", "error"]
    documento_id: str
    clasificacion: Clasificacion
    datos_extraidos: DatosExtraidos
    decision_enrutamiento: DecisionEnrutamiento
    almacenamiento_oci: AlmacenamientoOCI


_TIPO_BRIEF_A_CATALOGO = {
    "Receta Médica": "Receta Médica",
    "Informe de Estudio por Imágenes/Laboratorio": "Informe de Estudio por Imágenes",
    "Orden de Solicitud de Procedimiento": "Solicitud de Procedimiento",
    "Epicrisis / Informe de Alta": "Epicrisis / Informe de Alta",
    "Certificado Médico": "Otro / No clasificable",
}

_DESTINO_BRIEF_A_CATALOGO = {
    "Cola_Emergencia_Medica": "Cola_Emergencia_Medica",
    "Farmacia_Hospitalaria": "Farmacia_Hospitalaria",
    "Auditoria_Autorizaciones": "Gestion_Procedimientos",
    "Historia_Clinica_Electronica": "Ficha_Clinica",
    "Cola_Revision_Humana": "Ficha_Clinica",
}


def brief_to_ingest_payload(
    brief: MediFlowResponseSchema,
    *,
    archivo_base64: str,
    tipo_archivo: str = "PDF",
) -> dict[str, Any]:
    """Traduce el JSON del brief al body de POST /api/v1/documents/ingest."""
    tipo = _TIPO_BRIEF_A_CATALOGO.get(
        brief.clasificacion.tipo_documento, brief.clasificacion.tipo_documento
    )
    destino = _DESTINO_BRIEF_A_CATALOGO.get(
        brief.decision_enrutamiento.destino_principal,
        brief.decision_enrutamiento.destino_principal,
    )
    hitl = brief.decision_enrutamiento.requiere_auditoria_humana or (
        brief.decision_enrutamiento.destino_principal == "Cola_Revision_Humana"
    )
    prioridad = brief.clasificacion.nivel_prioridad
    if prioridad == "Ambiguo":
        prioridad = "Prioritario"
        hitl = True

    estudio = brief.datos_extraidos.estudio_realizado
    detalle: dict[str, Any] = {
        "medicamentos": None,
        "examenes_y_laboratorio": None,
        "procedimientos_e_internacion": None,
        "informe_imagenologico": None,
        "nota_atencion_ambulatoria": None,
    }
    if tipo == "Receta Médica":
        detalle["medicamentos"] = [
            {"nombre": estudio or "Medicamento no especificado", "dosis": None, "duracion_tratamiento": None}
        ]
    elif tipo == "Informe de Laboratorio":
        detalle["examenes_y_laboratorio"] = {
            "estudio_solicitado": estudio,
            "conclusiones_o_hallazgos": brief.datos_extraidos.diagnostico_principal,
            "paneles": [],
        }
    elif tipo == "Informe de Estudio por Imágenes":
        detalle["informe_imagenologico"] = {
            "tecnica": estudio,
            "antecedentes": None,
            "hallazgos": None,
            "impresion_diagnostica": brief.datos_extraidos.diagnostico_principal,
        }
    elif tipo == "Epicrisis / Informe de Alta":
        detalle["procedimientos_e_internacion"] = {
            "fecha_ingreso": None,
            "fecha_alta": None,
            "resumen_evolucion": brief.datos_extraidos.diagnostico_principal,
            "antecedentes_relevantes": None,
            "procedimientos_realizados": [estudio] if estudio else [],
        }

    notif = brief.decision_enrutamiento.notificacion_generada
    return {
        "documento_id": brief.documento_id,
        "archivos": [
            {
                "tipo_archivo": tipo_archivo,
                "archivo_base64": archivo_base64,
                "rol": "documento_principal",
            }
        ],
        "clasificacion": {
            "tipo_documento": tipo,
            "especialidad": brief.clasificacion.especialidad,
            "nivel_prioridad": prioridad,
            "score_confianza_clasificacion": brief.clasificacion.score_confianza_clasificacion,
        },
        "datos_generales": {
            "paciente": {
                "rut": None,
                "nombre": brief.datos_extraidos.paciente.nombre,
                "edad": brief.datos_extraidos.paciente.edad,
            },
            "medico_solicitante": {
                "rut": None,
                "nombre": brief.datos_extraidos.medico_solicitante.nombre,
                "matricula": brief.datos_extraidos.medico_solicitante.matricula,
            },
            "diagnostico_principal": brief.datos_extraidos.diagnostico_principal,
            "cie10_sugerido": brief.datos_extraidos.cie10_sugerido,
        },
        "detalle_clinico": detalle,
        "decision_enrutamiento": {
            "destino_principal": destino,
            "requiere_auditoria_humana": hitl,
            "justificacion_enrutamiento": brief.decision_enrutamiento.justificacion_enrutamiento,
            "notificacion_generada": (
                {"canal": notif.canal, "mensaje": notif.mensaje} if notif else None
            ),
        },
    }
