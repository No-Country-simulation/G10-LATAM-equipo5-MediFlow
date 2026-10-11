"""Lógica de negocio de la feature de auditoría humana (Human-in-the-Loop).

Un caso `PENDIENTE_AUDITORIA` termina `AUDITADO` (resuelto con correcciones) o `DESCARTADO`
(no clínico, duplicado o ilegible). En ambos casos el JSON del documento se "mueve" en OCI
(se sube el nuevo y luego se borra el anterior) y la BD queda con el mismo JSON consolidado.

Un documento `PROCESADO` o `AUDITADO` puede corregirse después (`correct_document`) con las
mismas validaciones; conserva su estado y su JSON se sobrescribe en la misma ruta de OCI. La
resolución de la auditoría y cada corrección quedan en `clinical_document_corrections`.

Para que dos auditores no trabajen el mismo caso, un auditor puede "tomarlo": mientras la
asignación esté vigente (`CLAIM_TTL_MINUTES`), nadie más puede resolverlo ni descartarlo.
"""

import asyncio
import copy
import json
import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.features.audit.changes import cambios_de_correccion
from app.features.audit.schemas import (
    AuditClaimResponse,
    AuditDetailResponse,
    AuditDiscardRequest,
    AuditResolveRequest,
    CorreccionClinica,
    DocumentCorrectionRequest,
)
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.documents.detail import attachment_fields, create_preview_url
from app.features.documents.models import ClinicalDocument, ClinicalDocumentCorrection
from app.features.documents.schemas import ArchivoPreview, DatosGeneralesExtract, DetalleClinicoExtract
from app.features.documents.service import (
    active_document_types,
    active_queue_codes,
    apply_clinical_detail,
    apply_general_data,
    detalle_reasons,
    normalizar_datos_generales,
)
from app.shared.oci_client import oci_storage_client

logger = logging.getLogger(__name__)

CLAIM_TTL_MINUTES = 30

ESTADO_PENDIENTE = "PENDIENTE_AUDITORIA"
ESTADO_AUDITADO = "AUDITADO"
ESTADO_DESCARTADO = "DESCARTADO"
ESTADOS_CORREGIBLES = ("PROCESADO", ESTADO_AUDITADO)

ORIGEN_AUDITORIA = "AUDITORIA"
ORIGEN_CORRECCION = "CORRECCION"

# Columnas que quedan registradas en `campos_corregidos` cuando el auditor las cambia.
_CAMPOS_CORREGIBLES = (
    "identificacion_paciente",
    "tipo_identificacion",
    "pais_identificacion",
    "nombre_paciente",
    "edad_paciente",
    "fecha_nacimiento",
    "sexo",
    "numero_ficha",
    "medico_nombre",
    "medico_identificacion",
    "institucion_emisora",
    "fecha_documento",
    "tipo_documento",
    "nivel_prioridad",
    "diagnostico_principal",
    "cie10_sugerido",
    "cie10_origen",
    "destino_enrutamiento",
    "especialidad",
)


# --- Helpers -----------------------------------------------------------------


async def _get_document_or_404(documento_id: str, db: AsyncSession) -> ClinicalDocument:
    """Busca un documento clínico por `documento_id` o lanza HTTPException 404."""
    result = await db.execute(
        select(ClinicalDocument).where(ClinicalDocument.documento_id == documento_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el documento {documento_id}",
        )
    return document


def _claim_expires_at(document: ClinicalDocument) -> datetime | None:
    if document.asignado_at is None:
        return None
    return document.asignado_at + timedelta(minutes=CLAIM_TTL_MINUTES)


def _claimed_by_other(document: ClinicalDocument, user: User) -> bool:
    """True si otro auditor tiene el caso tomado y su asignación sigue vigente."""
    expires_at = _claim_expires_at(document)
    return (
        document.asignado_a_id is not None
        and document.asignado_a_id != user.id
        and expires_at is not None
        and expires_at > datetime.now(timezone.utc)
    )


def _ensure_workable(document: ClinicalDocument, user: User) -> None:
    """Exige que el caso esté pendiente y que no lo tenga tomado otro auditor (409)."""
    if document.estado != ESTADO_PENDIENTE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El documento ya fue resuelto (estado {document.estado})",
        )
    if _claimed_by_other(document, user):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"El caso está en revisión por {document.asignado_a_username} "
                f"hasta {_claim_expires_at(document):%H:%M} UTC"
            ),
        )


async def _finalize(
    document: ClinicalDocument,
    *,
    estado: str,
    final_json: dict[str, Any],
    new_json_path: str,
    user: User,
    notes: str,
    audited_at: datetime,
    db: AsyncSession,
) -> ClinicalDocument:
    """Cierra un caso: sube el JSON final a OCI, hace commit y recién entonces borra el JSON viejo.

    Si OCI falla no hay nada que deshacer; si falla el commit se borra el JSON recién subido.
    Si falla el borrado del JSON viejo solo se registra en el log: el caso ya quedó cerrado.
    """
    documento_id = document.documento_id
    old_json_path = document.oci_json_path

    try:
        content = json.dumps(final_json, ensure_ascii=False).encode("utf-8")
        await oci_storage_client.upload_object(
            new_json_path, content, content_type="application/json"
        )
    except Exception as exc:
        logger.exception("Fallo al subir el JSON final a OCI para el documento %s", documento_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible almacenar el JSON auditado en OCI Object Storage",
        ) from exc

    document.estado = estado
    document.requiere_auditoria = False
    document.audited_by_id = user.id
    document.audit_notes = notes
    document.audited_at = audited_at
    document.oci_json_path = new_json_path
    document.raw_extracted_json = final_json
    document.asignado_a_id = None
    document.asignado_a_username = None
    document.asignado_at = None

    try:
        await db.commit()
        await db.refresh(document)
    except SQLAlchemyError as exc:
        logger.exception("Fallo al persistir la auditoría del documento %s", documento_id)
        await db.rollback()
        try:
            await oci_storage_client.delete_object(new_json_path)
            logger.warning("Compensación aplicada: JSON eliminado de OCI -> %s", new_json_path)
        except Exception:
            logger.exception("Fallo al ejecutar la compensación de OCI para %s", new_json_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible registrar la auditoría en la base de datos",
        ) from exc

    try:
        await oci_storage_client.delete_object(old_json_path)
    except Exception:
        logger.exception(
            "El documento %s quedó %s pero no se pudo eliminar el JSON antiguo en %s",
            documento_id,
            estado,
            old_json_path,
        )

    logger.info("Documento %s quedó %s por %s", documento_id, estado, user.username)
    return document


# --- Consulta ----------------------------------------------------------------


async def get_audit_case(documento_id: str, db: AsyncSession) -> AuditDetailResponse:
    """Detalle de un caso, con una URL pre-firmada de solo lectura por cada archivo en OCI."""
    document = await _get_document_or_404(documento_id, db)

    if not document.attachments:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"El documento {documento_id} no tiene archivos binarios asociados",
        )

    # El adjunto de `orden` más bajo es el archivo principal (el informe/receta en sí);
    # los siguientes son imágenes de respaldo del mismo estudio. Las URLs se piden en paralelo.
    # A diferencia del detalle de documentos, aquí un fallo de OCI corta la respuesta: un
    # auditor no puede resolver el caso sin ver el original.
    urls = await asyncio.gather(
        *(create_preview_url(attachment.oci_path) for attachment in document.attachments)
    )
    archivos = [
        ArchivoPreview(**attachment_fields(attachment), url=url)
        for attachment, url in zip(document.attachments, urls, strict=True)
    ]

    # Las columnas del documento se copian por nombre: la respuesta no se desfasa si cambian.
    columnas = {campo: getattr(document, campo) for campo in AuditDetailResponse.model_fields if hasattr(document, campo)}
    return AuditDetailResponse(
        **columnas,
        oci_preview_url=archivos[0].url,
        archivos=archivos,
        preview_expira_en_minutos=settings.DOCUMENT_PREVIEW_URL_EXPIRE_MINUTES,
    )


# --- Tomar / liberar caso ----------------------------------------------------


async def claim_audit_case(documento_id: str, user: User, db: AsyncSession) -> AuditClaimResponse:
    """Asigna el caso al auditor (o renueva su asignación) por `CLAIM_TTL_MINUTES` minutos."""
    document = await _get_document_or_404(documento_id, db)
    _ensure_workable(document, user)

    document.asignado_a_id = user.id
    document.asignado_a_username = user.username
    document.asignado_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("Caso %s tomado por %s hasta %s", documento_id, user.username, f"{_claim_expires_at(document):%H:%M} UTC")

    return AuditClaimResponse(
        documento_id=document.documento_id,
        asignado_a_id=user.id,
        asignado_a_username=user.username,
        asignado_at=document.asignado_at,
        expira_at=_claim_expires_at(document),
    )


async def release_audit_case(documento_id: str, user: User, db: AsyncSession) -> None:
    """Libera el caso. Solo puede hacerlo quien lo tomó o un ADMIN."""
    document = await _get_document_or_404(documento_id, db)
    if document.asignado_a_id is None:
        return
    if document.asignado_a_id != user.id and user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo quien tomó el caso o un ADMIN puede liberarlo",
        )
    previous_owner = document.asignado_a_username
    document.asignado_a_id = None
    document.asignado_a_username = None
    document.asignado_at = None
    await db.commit()
    logger.info("Caso %s liberado (estaba tomado por %s)", documento_id, previous_owner)


# --- Validar y aplicar una corrección (auditoría y corrección de documentos) --


@dataclass
class _CorreccionValidada:
    """Corrección ya normalizada y validada, lista para aplicarse al documento."""

    datos: DatosGeneralesExtract
    detalle_vigente: DetalleClinicoExtract
    detalle_final: DetalleClinicoExtract
    especialidad: str | None


def _json_corregido(
    raw: dict[str, Any], payload: CorreccionClinica, correccion: _CorreccionValidada
) -> dict[str, Any]:
    """JSON con los valores corregidos arriba. La extracción original de la IA queda en
    `version_ia` la primera vez que alguien corrige el documento y no se vuelve a pisar."""
    final = copy.deepcopy(raw)
    final.setdefault(
        "version_ia",
        {
            clave: copy.deepcopy(raw.get(clave))
            for clave in ("clasificacion", "datos_generales", "detalle_clinico", "decision_enrutamiento")
        },
    )
    final.setdefault("clasificacion", {}).update(
        tipo_documento=payload.tipo_documento,
        especialidad=correccion.especialidad,
        nivel_prioridad=payload.nivel_prioridad,
    )
    final["datos_generales"] = correccion.datos.model_dump(mode="json")
    final["detalle_clinico"] = correccion.detalle_final.model_dump(mode="json")
    final.setdefault("decision_enrutamiento", {})["destino_principal"] = payload.destino_enrutamiento
    return final


def _marcar_cie10_del_auditor(datos: DatosGeneralesExtract, raw: dict[str, Any]) -> None:
    """Los códigos CIE-10 que no estaban en la versión vigente quedan con origen AUDITOR."""
    diagnosticos_previos = (raw.get("datos_generales") or {}).get("diagnosticos") or []
    codigos_previos = {d.get("cie10") for d in diagnosticos_previos if isinstance(d, dict)}
    for diagnostico in datos.diagnosticos:
        if diagnostico.cie10 and diagnostico.cie10 not in codigos_previos:
            diagnostico.origen_cie10 = "AUDITOR"


def _errores_de_catalogo(
    payload: CorreccionClinica,
    detalle_final: DetalleClinicoExtract,
    tipos_activos: dict[str, dict[str, Any] | None],
    colas_activas: set[str],
) -> list[str]:
    errores: list[str] = []
    if payload.tipo_documento not in tipos_activos:
        errores.append(
            f"El tipo de documento '{payload.tipo_documento}' no existe o está inactivo en el catálogo"
        )
    else:
        errores.extend(
            detalle_reasons(payload.tipo_documento, detalle_final, tipos_activos[payload.tipo_documento])
        )
    if payload.destino_enrutamiento not in colas_activas:
        errores.append(f"La cola '{payload.destino_enrutamiento}' no existe o está inactiva en el catálogo")
    return errores


def _errores_de_datos(
    datos: DatosGeneralesExtract, problema_identificacion: str | None, cie10_invalidos: int
) -> list[str]:
    """Mismas validaciones que la ingesta, pero aquí bloquean: quien corrige debe resolverlas."""
    errores: list[str] = []
    if not datos.paciente.nombre:
        errores.append("El nombre del paciente es obligatorio")
    if problema_identificacion:
        errores.append(problema_identificacion)
    if cie10_invalidos:
        errores.append(f"{cie10_invalidos} código(s) CIE-10 sin formato válido (ej. J45.9, N47)")
    principal = datos.diagnostico_principal
    if principal is None or not principal.descripcion:
        errores.append("El diagnóstico principal es obligatorio")
    return errores


async def _validar_correccion(
    document: ClinicalDocument, payload: CorreccionClinica, raw: dict[str, Any], db: AsyncSession
) -> _CorreccionValidada:
    """Normaliza y valida la corrección (catálogos, identificación, CIE-10, detalle según el
    tipo). Lanza 422 con todos los problemas juntos; no modifica el documento."""
    tipos_activos = await active_document_types(db)
    colas_activas = await active_queue_codes(db)

    detalle_vigente = DetalleClinicoExtract.model_validate(raw.get("detalle_clinico") or {})
    detalle_final = payload.detalle_clinico if payload.detalle_clinico is not None else detalle_vigente
    especialidad = (
        payload.especialidad if "especialidad" in payload.model_fields_set else document.especialidad
    )
    datos = payload.datos_generales.model_copy(deep=True)
    problema_identificacion, cie10_invalidos = normalizar_datos_generales(datos)
    _marcar_cie10_del_auditor(datos, raw)

    errores = _errores_de_catalogo(payload, detalle_final, tipos_activos, colas_activas)
    errores.extend(_errores_de_datos(datos, problema_identificacion, cie10_invalidos))
    if errores:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=errores)
    return _CorreccionValidada(datos, detalle_vigente, detalle_final, especialidad)


def _valor_json(valor: Any) -> Any:
    return valor.isoformat() if isinstance(valor, (date, datetime)) else valor


def _snapshot(document: ClinicalDocument) -> dict[str, Any]:
    return {campo: _valor_json(getattr(document, campo)) for campo in _CAMPOS_CORREGIBLES}


def _aplicar_correccion(
    document: ClinicalDocument, payload: CorreccionClinica, correccion: _CorreccionValidada
) -> dict[str, Any]:
    """Aplica la corrección a las columnas y tablas hijas. Devuelve `campos_corregidos`
    (`{campo: {antes, despues}}`), el resumen que queda en el JSON del documento."""
    antes = _snapshot(document)
    document.tipo_documento = payload.tipo_documento
    document.nivel_prioridad = payload.nivel_prioridad
    document.destino_enrutamiento = payload.destino_enrutamiento
    document.especialidad = correccion.especialidad
    apply_general_data(document, correccion.datos)
    despues = _snapshot(document)

    campos_corregidos: dict[str, Any] = {
        campo: {"antes": antes[campo], "despues": despues[campo]}
        for campo in _CAMPOS_CORREGIBLES
        if antes[campo] != despues[campo]
    }
    detalle_vigente = correccion.detalle_vigente.model_dump(mode="json")
    detalle_final = correccion.detalle_final.model_dump(mode="json")
    if detalle_final != detalle_vigente:
        campos_corregidos["detalle_clinico"] = {"antes": detalle_vigente, "despues": detalle_final}
        apply_clinical_detail(document, correccion.detalle_final)
    return campos_corregidos


def _clasificacion_nueva(payload: CorreccionClinica, correccion: _CorreccionValidada) -> dict[str, Any]:
    return {
        "tipo_documento": payload.tipo_documento,
        "nivel_prioridad": payload.nivel_prioridad,
        "destino_enrutamiento": payload.destino_enrutamiento,
        "especialidad": correccion.especialidad,
    }


def _registrar_correccion(
    document: ClinicalDocument,
    *,
    origen: str,
    justificacion: str,
    cambios: list[dict[str, Any]],
    user: User,
    corrected_at: datetime,
) -> None:
    """Agrega la entrada al historial (la más reciente primero, como lo carga la relación)."""
    document.corrections.insert(
        0,
        ClinicalDocumentCorrection(
            origen=origen,
            justificacion=justificacion,
            cambios=cambios,
            corrected_by_id=user.id,
            corrected_by_username=user.username,
            corrected_at=corrected_at,
        ),
    )


# --- Resolver / descartar ----------------------------------------------------


async def resolve_audit_case(
    documento_id: str,
    payload: AuditResolveRequest,
    current_user: User,
    db: AsyncSession,
) -> ClinicalDocument:
    """Resuelve un caso: valida la corrección, consolida los datos, deja la entrada en el
    historial y mueve el JSON en OCI."""
    document = await _get_document_or_404(documento_id, db)
    _ensure_workable(document, current_user)

    raw = document.raw_extracted_json or {}
    correccion = await _validar_correccion(document, payload, raw, db)
    cambios = cambios_de_correccion(
        document, raw, _clasificacion_nueva(payload, correccion), correccion.datos, correccion.detalle_final
    )
    campos_corregidos = _aplicar_correccion(document, payload, correccion)

    audited_at = datetime.now(timezone.utc)
    final_json = _json_corregido(raw, payload, correccion)
    final_json.setdefault("triaje", {})["estado"] = ESTADO_AUDITADO
    final_json["auditoria"] = {
        "accion": ESTADO_AUDITADO,
        "audited_by_id": str(current_user.id),
        "audited_by_username": current_user.username,
        "audited_at": audited_at.isoformat(),
        "audit_notes": payload.audit_notes,
        "campos_corregidos": campos_corregidos,
    }
    # Sin cambios también se registra: el auditor validó los valores tal como venían.
    _registrar_correccion(
        document,
        origen=ORIGEN_AUDITORIA,
        justificacion=payload.audit_notes,
        cambios=cambios,
        user=current_user,
        corrected_at=audited_at,
    )

    return await _finalize(
        document,
        estado=ESTADO_AUDITADO,
        final_json=final_json,
        new_json_path=f"procesados/auditados/{documento_id}.json",
        user=current_user,
        notes=payload.audit_notes,
        audited_at=audited_at,
        db=db,
    )


# --- Corregir un documento ya procesado o auditado ---------------------------


async def _guardar_correccion(
    document: ClinicalDocument, final_json: dict[str, Any], json_anterior: dict[str, Any], db: AsyncSession
) -> None:
    """Sobrescribe el JSON del documento en OCI (misma ruta) y hace commit.

    Si OCI falla no hay nada que deshacer; si falla el commit se vuelve a subir el JSON anterior.
    """
    documento_id = document.documento_id
    ruta = document.oci_json_path

    async def _subir(contenido: dict[str, Any]) -> None:
        await oci_storage_client.upload_object(
            ruta, json.dumps(contenido, ensure_ascii=False).encode("utf-8"), content_type="application/json"
        )

    try:
        await _subir(final_json)
    except Exception as exc:
        logger.exception("Fallo al subir el JSON corregido a OCI para el documento %s", documento_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible almacenar el JSON corregido en OCI Object Storage",
        ) from exc

    try:
        await db.commit()
        await db.refresh(document)
    except SQLAlchemyError as exc:
        logger.exception("Fallo al persistir la corrección del documento %s", documento_id)
        await db.rollback()
        try:
            await _subir(json_anterior)
            logger.warning("Compensación aplicada: JSON anterior restaurado en OCI -> %s", ruta)
        except Exception:
            logger.exception("Fallo al restaurar el JSON anterior en OCI para %s", ruta)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible registrar la corrección en la base de datos",
        ) from exc


async def correct_document(
    documento_id: str,
    payload: DocumentCorrectionRequest,
    current_user: User,
    db: AsyncSession,
) -> ClinicalDocument:
    """Corrige un documento PROCESADO o AUDITADO con las mismas validaciones de la auditoría.

    El documento conserva su estado; si cambian el tipo, la prioridad o el destino, queda
    enrutado a la nueva cola. Cada corrección deja una entrada en el historial con lo que cambió.
    """
    document = await _get_document_or_404(documento_id, db)
    if document.estado not in ESTADOS_CORREGIBLES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Solo se pueden corregir documentos procesados o auditados (estado {document.estado}); "
                "los pendientes se corrigen desde la auditoría"
            ),
        )

    raw = document.raw_extracted_json or {}
    correccion = await _validar_correccion(document, payload, raw, db)
    cambios = cambios_de_correccion(
        document, raw, _clasificacion_nueva(payload, correccion), correccion.datos, correccion.detalle_final
    )
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=["La corrección no modifica ningún valor del documento"],
        )
    campos_corregidos = _aplicar_correccion(document, payload, correccion)

    corrected_at = datetime.now(timezone.utc)
    final_json = _json_corregido(raw, payload, correccion)
    final_json["correcciones"] = [
        *(raw.get("correcciones") or []),
        {
            "corrected_by_id": str(current_user.id),
            "corrected_by_username": current_user.username,
            "corrected_at": corrected_at.isoformat(),
            "justificacion": payload.justificacion,
            "campos_corregidos": campos_corregidos,
        },
    ]
    document.raw_extracted_json = final_json
    _registrar_correccion(
        document,
        origen=ORIGEN_CORRECCION,
        justificacion=payload.justificacion,
        cambios=cambios,
        user=current_user,
        corrected_at=corrected_at,
    )

    await _guardar_correccion(document, final_json, raw, db)
    logger.info(
        "Documento %s corregido por %s (%d cambio(s))", documento_id, current_user.username, len(cambios)
    )
    return document


async def discard_audit_case(
    documento_id: str,
    payload: AuditDiscardRequest,
    current_user: User,
    db: AsyncSession,
) -> ClinicalDocument:
    """Descarta un caso (no clínico, duplicado o ilegible): sale de la bandeja sin enrutarse."""
    document = await _get_document_or_404(documento_id, db)
    _ensure_workable(document, current_user)

    audited_at = datetime.now(timezone.utc)
    final_json = copy.deepcopy(document.raw_extracted_json or {})
    final_json.setdefault("triaje", {})["estado"] = ESTADO_DESCARTADO
    final_json["auditoria"] = {
        "accion": ESTADO_DESCARTADO,
        "audited_by_id": str(current_user.id),
        "audited_by_username": current_user.username,
        "audited_at": audited_at.isoformat(),
        "motivo": payload.motivo,
    }

    return await _finalize(
        document,
        estado=ESTADO_DESCARTADO,
        final_json=final_json,
        new_json_path=f"descartados/{documento_id}.json",
        user=current_user,
        notes=payload.motivo,
        audited_at=audited_at,
        db=db,
    )
