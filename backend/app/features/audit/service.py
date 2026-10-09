"""Lógica de negocio de la feature de auditoría humana (Human-in-the-Loop).

Un caso `PENDIENTE_AUDITORIA` termina `AUDITADO` (resuelto con correcciones) o `DESCARTADO`
(no clínico, duplicado o ilegible). En ambos casos el JSON del documento se "mueve" en OCI
(se sube el nuevo y luego se borra el anterior) y la BD queda con el mismo JSON consolidado.

Para que dos auditores no trabajen el mismo caso, un auditor puede "tomarlo": mientras la
asignación esté vigente (`CLAIM_TTL_MINUTES`), nadie más puede resolverlo ni descartarlo.
"""

import asyncio
import copy
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.audit.schemas import (
    ArchivoPreview,
    AuditClaimResponse,
    AuditDetailResponse,
    AuditDiscardRequest,
    AuditResolveRequest,
)
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.documents.models import ClinicalDocument
from app.features.documents.schemas import TIPOS_ARCHIVO_PRINCIPAL, DetalleClinicoExtract
from app.features.documents.service import (
    active_document_types,
    active_queue_codes,
    apply_clinical_detail,
    detalle_reasons,
)
from app.shared.oci_client import oci_storage_client

logger = logging.getLogger(__name__)

PREVIEW_URL_EXPIRE_MINUTES = 15
CLAIM_TTL_MINUTES = 30

ESTADO_PENDIENTE = "PENDIENTE_AUDITORIA"
ESTADO_AUDITADO = "AUDITADO"
ESTADO_DESCARTADO = "DESCARTADO"

# Columnas que el auditor puede corregir (nombre en el request == nombre de la columna).
_CAMPOS_CORREGIBLES = (
    "rut_paciente",
    "nombre_paciente",
    "edad_paciente",
    "medico_nombre",
    "medico_rut",
    "tipo_documento",
    "nivel_prioridad",
    "diagnostico_principal",
    "cie10_sugerido",
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
    urls = await asyncio.gather(
        *(
            oci_storage_client.create_preauthenticated_request(
                attachment.oci_path, expire_minutes=PREVIEW_URL_EXPIRE_MINUTES
            )
            for attachment in document.attachments
        )
    )
    archivos = [
        ArchivoPreview(
            orden=attachment.orden,
            tipo_archivo=attachment.tipo_archivo,
            rol=attachment.rol,
            url=url,
            visualizable=attachment.tipo_archivo in TIPOS_ARCHIVO_PRINCIPAL,
        )
        for attachment, url in zip(document.attachments, urls, strict=True)
    ]

    return AuditDetailResponse(
        documento_id=document.documento_id,
        estado=document.estado,
        oci_preview_url=archivos[0].url,
        archivos=archivos,
        preview_expira_en_minutos=PREVIEW_URL_EXPIRE_MINUTES,
        motivos_auditoria=document.motivos_auditoria,
        rut_paciente=document.rut_paciente,
        nombre_paciente=document.nombre_paciente,
        edad_paciente=document.edad_paciente,
        medico_nombre=document.medico_nombre,
        medico_rut=document.medico_rut,
        tipo_documento=document.tipo_documento,
        especialidad=document.especialidad,
        nivel_prioridad=document.nivel_prioridad,
        score_confianza=document.score_confianza,
        diagnostico_principal=document.diagnostico_principal,
        cie10_sugerido=document.cie10_sugerido,
        destino_enrutamiento=document.destino_enrutamiento,
        raw_extracted_json=document.raw_extracted_json,
        uploaded_by_id=document.uploaded_by_id,
        asignado_a_id=document.asignado_a_id,
        asignado_a_username=document.asignado_a_username,
        asignado_at=document.asignado_at,
        audited_by_id=document.audited_by_id,
        audited_at=document.audited_at,
        audit_notes=document.audit_notes,
        created_at=document.created_at,
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
    document.asignado_a_id = None
    document.asignado_a_username = None
    document.asignado_at = None
    await db.commit()


# --- Resolver / descartar ----------------------------------------------------


def _final_audited_json(
    raw: dict[str, Any],
    payload: AuditResolveRequest,
    detalle_final: DetalleClinicoExtract,
    especialidad: str | None,
    auditoria: dict[str, Any],
) -> dict[str, Any]:
    """Arma el JSON final: valores corregidos arriba y la extracción original en `version_ia`."""
    final = copy.deepcopy(raw)
    final["version_ia"] = {
        clave: copy.deepcopy(raw.get(clave))
        for clave in ("clasificacion", "datos_generales", "detalle_clinico", "decision_enrutamiento")
    }

    clasificacion = final.setdefault("clasificacion", {})
    clasificacion.update(
        tipo_documento=payload.tipo_documento,
        especialidad=especialidad,
        nivel_prioridad=payload.nivel_prioridad,
    )
    generales = final.setdefault("datos_generales", {})
    generales.setdefault("paciente", {}).update(
        rut=payload.rut_paciente, nombre=payload.nombre_paciente, edad=payload.edad_paciente
    )
    generales.setdefault("medico_solicitante", {}).update(
        rut=payload.medico_rut, nombre=payload.medico_nombre
    )
    generales.update(
        diagnostico_principal=payload.diagnostico_principal,
        cie10_sugerido=payload.cie10_sugerido,
    )
    final["detalle_clinico"] = detalle_final.model_dump(mode="json")
    final.setdefault("decision_enrutamiento", {})["destino_principal"] = (
        payload.destino_enrutamiento
    )
    final.setdefault("triaje", {})["estado"] = ESTADO_AUDITADO
    final["auditoria"] = auditoria
    return final


async def resolve_audit_case(
    documento_id: str,
    payload: AuditResolveRequest,
    current_user: User,
    db: AsyncSession,
) -> ClinicalDocument:
    """Resuelve un caso: valida la corrección contra los catálogos, consolida y mueve el JSON en OCI."""
    document = await _get_document_or_404(documento_id, db)
    _ensure_workable(document, current_user)

    tipos_activos = await active_document_types(db)
    colas_activas = await active_queue_codes(db)

    raw = document.raw_extracted_json or {}
    detalle_ia = DetalleClinicoExtract.model_validate(raw.get("detalle_clinico") or {})
    detalle_final = payload.detalle_clinico if payload.detalle_clinico is not None else detalle_ia
    especialidad = (
        payload.especialidad if "especialidad" in payload.model_fields_set else document.especialidad
    )

    errores: list[str] = []
    if payload.tipo_documento not in tipos_activos:
        errores.append(
            f"El tipo de documento '{payload.tipo_documento}' no existe o está inactivo en el catálogo"
        )
    else:
        errores.extend(
            detalle_reasons(
                payload.tipo_documento, detalle_final, tipos_activos[payload.tipo_documento]
            )
        )
    if payload.destino_enrutamiento not in colas_activas:
        errores.append(
            f"La cola '{payload.destino_enrutamiento}' no existe o está inactiva en el catálogo"
        )
    if errores:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=errores)

    nuevos = {**payload.model_dump(include=set(_CAMPOS_CORREGIBLES)), "especialidad": especialidad}
    campos_corregidos = {
        campo: {"antes": getattr(document, campo), "despues": nuevos[campo]}
        for campo in _CAMPOS_CORREGIBLES
        if getattr(document, campo) != nuevos[campo]
    }
    detalle_cambio = detalle_final.model_dump(mode="json") != detalle_ia.model_dump(mode="json")
    if detalle_cambio:
        campos_corregidos["detalle_clinico"] = {
            "antes": detalle_ia.model_dump(mode="json"),
            "despues": detalle_final.model_dump(mode="json"),
        }

    audited_at = datetime.now(timezone.utc)
    auditoria = {
        "accion": ESTADO_AUDITADO,
        "audited_by_id": str(current_user.id),
        "audited_by_username": current_user.username,
        "audited_at": audited_at.isoformat(),
        "audit_notes": payload.audit_notes,
        "campos_corregidos": campos_corregidos,
    }
    final_json = _final_audited_json(raw, payload, detalle_final, especialidad, auditoria)

    for campo, valor in nuevos.items():
        setattr(document, campo, valor)
    if detalle_cambio:
        apply_clinical_detail(document, detalle_final)

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
