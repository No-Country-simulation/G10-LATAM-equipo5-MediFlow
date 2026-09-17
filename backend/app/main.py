"""Punto de entrada de la API FastAPI de MediFlow."""

from __future__ import annotations

import logging
import re
import uuid
from functools import lru_cache

import httpx
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.domain.schemas import (
    DatosClinicosSchema,
    EstadoTriaje,
    MedicamentoItem,
    NivelPrioridad,
    TipoDocumento,
    TriajeFinalSchema,
)
from app.infrastructure.audit_db import AuditDB
from app.infrastructure.doc_processor import extract_text_from_file
from app.infrastructure.oci_storage import OCIStorageError, OCIStorageService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="MediFlow API",
    description="API para triaje, extraccion y enrutamiento de documentos clinicos",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache
def get_audit_db() -> AuditDB:
    """Instancia cacheada del manejador de la base de datos de auditoria."""
    return AuditDB(settings)


@lru_cache
def get_oci_service() -> OCIStorageService | None:
    """Instancia cacheada del servicio de OCI. Retorna None si la configuracion es invalida."""
    try:
        return OCIStorageService(settings)
    except Exception:
        logger.warning("OCI Object Storage no esta configurado; se omitira la persistencia remota.")
        return None


UMBRAL_CONFIANZA_AUDITORIA = 0.85

_PALABRAS_CLAVE_URGENCIA_CRITICA = ("emergencia", "critico", "paro", "urgencia vital")
_PALABRAS_CLAVE_URGENCIA_ALTA = ("urgente", "grave", "severo")
_PALABRAS_CLAVE_TIPO_DOCUMENTO = {
    TipoDocumento.RECETA: ("receta", "prescripcion", "medicamento"),
    TipoDocumento.LABORATORIO: ("laboratorio", "hemograma", "resultado de examen"),
    TipoDocumento.RADIOLOGIA: ("radiografia", "resonancia", "tomografia", "radiologia"),
    TipoDocumento.CERTIFICADO: ("certificado", "incapacidad", "constancia"),
}

_PATRON_CAMPO = {
    "paciente_nombre": re.compile(r"paciente\s*:\s*(.+)", re.IGNORECASE),
    "paciente_edad": re.compile(r"edad\s*:\s*(\d+)", re.IGNORECASE),
    "medico_solicitante": re.compile(r"m[ée]dico\s*:\s*(.+)", re.IGNORECASE),
    "diagnostico_principal": re.compile(r"diagn[oó]stico\s*:\s*(.+)", re.IGNORECASE),
    "cie10_sugerido": re.compile(r"cie[-\s]?10\s*:\s*([A-Za-z0-9.]+)", re.IGNORECASE),
}

_PATRON_MEDICAMENTO = re.compile(
    r"medicamento\s*:\s*(?P<nombre>[^,;\n]+)[,;]?\s*dosis\s*:\s*(?P<dosis>[^,;\n]+)[,;]?\s*frecuencia\s*:\s*(?P<frecuencia>[^,;\n]+)",
    re.IGNORECASE,
)


def _clasificar_tipo_documento(texto: str) -> TipoDocumento:
    texto_normalizado = texto.lower()
    for tipo, palabras in _PALABRAS_CLAVE_TIPO_DOCUMENTO.items():
        if any(palabra in texto_normalizado for palabra in palabras):
            return tipo
    return TipoDocumento.DESCONOCIDO


def _determinar_nivel_prioridad(texto: str) -> NivelPrioridad:
    texto_normalizado = texto.lower()
    if any(palabra in texto_normalizado for palabra in _PALABRAS_CLAVE_URGENCIA_CRITICA):
        return NivelPrioridad.CRITICO
    if any(palabra in texto_normalizado for palabra in _PALABRAS_CLAVE_URGENCIA_ALTA):
        return NivelPrioridad.ALTO
    return NivelPrioridad.MEDIO


def _extraer_medicamentos(texto: str) -> list[MedicamentoItem]:
    medicamentos = []
    for coincidencia in _PATRON_MEDICAMENTO.finditer(texto):
        medicamentos.append(
            MedicamentoItem(
                nombre=coincidencia.group("nombre").strip(),
                dosis=coincidencia.group("dosis").strip(),
                frecuencia=coincidencia.group("frecuencia").strip(),
            )
        )
    return medicamentos


def _extraer_datos_clinicos(texto: str) -> tuple[DatosClinicosSchema, float]:
    """Extrae datos clinicos estructurados de texto crudo mediante heuristicas de patrones.

    Retorna el esquema poblado y un score de confianza basado en la proporcion
    de campos obligatorios que fueron efectivamente encontrados en el texto.
    """
    valores: dict[str, str] = {}
    for campo, patron in _PATRON_CAMPO.items():
        coincidencia = patron.search(texto)
        if coincidencia:
            valores[campo] = coincidencia.group(1).strip()

    campos_obligatorios = ("paciente_nombre", "diagnostico_principal")
    campos_encontrados = sum(1 for campo in campos_obligatorios if campo in valores)
    campos_opcionales = ("paciente_edad", "medico_solicitante", "cie10_sugerido")
    opcionales_encontrados = sum(1 for campo in campos_opcionales if campo in valores)

    score = (campos_encontrados / len(campos_obligatorios)) * 0.7
    score += (opcionales_encontrados / len(campos_opcionales)) * 0.3
    score = round(min(score, 1.0), 2)

    datos = DatosClinicosSchema(
        paciente_nombre=valores.get("paciente_nombre", "Desconocido"),
        paciente_edad=int(valores["paciente_edad"]) if "paciente_edad" in valores else None,
        medico_solicitante=valores.get("medico_solicitante"),
        diagnostico_principal=valores.get("diagnostico_principal", "Sin diagnostico identificado"),
        cie10_sugerido=valores.get("cie10_sugerido"),
        medicamentos=_extraer_medicamentos(texto),
    )
    return datos, score


async def _notificar_n8n(triaje: TriajeFinalSchema) -> None:
    """Notifica el resultado del triaje al webhook de n8n. Falla de forma silenciosa (best-effort)."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(settings.n8n_webhook_url, json=triaje.model_dump(mode="json"))
    except httpx.HTTPError:
        logger.warning("No se pudo notificar a n8n en '%s'", settings.n8n_webhook_url)


@app.get("/health")
def health() -> dict[str, str]:
    """Endpoint de verificacion de salud del servicio."""
    return {"status": "ok"}


@app.post("/api/v1/documentos/procesar", response_model=TriajeFinalSchema)
async def procesar_documento(file: UploadFile) -> TriajeFinalSchema:
    """Recibe un documento clinico, extrae su texto y ejecuta el triaje inicial."""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo recibido esta vacio")

    filename = file.filename or "documento_sin_nombre"
    documento_id = str(uuid.uuid4())

    texto = extract_text_from_file(file_bytes, filename)
    datos_extraidos, score_confianza = _extraer_datos_clinicos(texto)
    tipo_documento = _clasificar_tipo_documento(texto)
    nivel_prioridad = _determinar_nivel_prioridad(texto)

    ruta_oci: str | None = None
    oci_service = get_oci_service()
    if oci_service is not None:
        try:
            object_name = f"{documento_id}/{filename}"
            ruta_oci = oci_service.upload_bytes(
                bucket=settings.oci_bucket_name,
                object_name=object_name,
                data=file_bytes,
                content_type=file.content_type or "application/octet-stream",
            )
        except OCIStorageError:
            logger.warning("No se pudo almacenar el documento '%s' en OCI", filename)

    if score_confianza < UMBRAL_CONFIANZA_AUDITORIA:
        status = EstadoTriaje.PENDIENTE_AUDITORIA
        destino_enrutamiento = "cola_auditoria_manual"
        justificacion = (
            f"Score de confianza ({score_confianza}) por debajo del umbral "
            f"({UMBRAL_CONFIANZA_AUDITORIA}); se requiere revision humana."
        )
    else:
        status = EstadoTriaje.PROCESADO
        destino_enrutamiento = f"area_{tipo_documento.value.lower()}"
        justificacion = (
            f"Score de confianza ({score_confianza}) supera el umbral; "
            f"documento enrutado automaticamente a '{destino_enrutamiento}'."
        )

    triaje = TriajeFinalSchema(
        documento_id=documento_id,
        status=status,
        tipo_documento=tipo_documento,
        nivel_prioridad=nivel_prioridad,
        score_confianza=score_confianza,
        datos_extraidos=datos_extraidos,
        justificacion_decision=justificacion,
        destino_enrutamiento=destino_enrutamiento,
        ruta_oci=ruta_oci,
    )

    if status is EstadoTriaje.PENDIENTE_AUDITORIA:
        get_audit_db().insertar_pendiente(
            paciente_nombre=datos_extraidos.paciente_nombre,
            diagnostico=datos_extraidos.diagnostico_principal,
            score_confianza=score_confianza,
            payload=triaje.model_dump(mode="json"),
        )
    else:
        await _notificar_n8n(triaje)

    return triaje


@app.get("/api/v1/auditoria/pendientes")
def listar_pendientes() -> list[dict]:
    """Lista los documentos pendientes de auditoria manual."""
    return get_audit_db().listar_pendientes()


@app.put("/api/v1/auditoria/{registro_id}/aprobar")
async def aprobar_registro(registro_id: int) -> dict:
    """Aprueba un registro de auditoria pendiente y notifica a n8n el resultado final."""
    registro = get_audit_db().marcar_aprobado(registro_id)
    if registro is None:
        raise HTTPException(status_code=404, detail="Registro de auditoria no encontrado")

    triaje = TriajeFinalSchema.model_validate(registro["payload_json"])
    triaje.status = EstadoTriaje.APROBADO
    await _notificar_n8n(triaje)

    return registro
