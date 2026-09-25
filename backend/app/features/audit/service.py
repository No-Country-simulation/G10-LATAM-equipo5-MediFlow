"""Lógica de negocio de la feature de auditoría humana (Human-in-the-Loop)."""

import json
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.audit.schemas import AuditDetailResponse, AuditResolveRequest
from app.features.auth.models import User
from app.features.documents.models import ClinicalDocument
from app.shared.oci_client import oci_storage_client

logger = logging.getLogger(__name__)

PREVIEW_URL_EXPIRE_MINUTES = 15


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


async def get_audit_case(documento_id: str, db: AsyncSession) -> AuditDetailResponse:
    """Obtiene el detalle de un caso de auditoría, con una URL pre-firmada para visualizar el binario en OCI."""
    document = await _get_document_or_404(documento_id, db)

    if not document.attachments:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"El documento {documento_id} no tiene archivos binarios asociados",
        )

    # El adjunto de `orden` más bajo es el archivo principal (el informe/receta en sí);
    # los siguientes son imágenes de respaldo del mismo estudio (ver ClinicalDocument.attachments).
    preview_url = await oci_storage_client.create_preauthenticated_request(
        document.attachments[0].oci_path, expire_minutes=PREVIEW_URL_EXPIRE_MINUTES
    )

    return AuditDetailResponse(
        documento_id=document.documento_id,
        estado=document.estado,
        oci_preview_url=preview_url,
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
        created_at=document.created_at,
    )


async def resolve_audit_case(
    documento_id: str,
    payload: AuditResolveRequest,
    current_user: User,
    db: AsyncSession,
) -> ClinicalDocument:
    """Resuelve un caso de auditoría: persiste la corrección humana y reubica el JSON definitivo en OCI."""
    document = await _get_document_or_404(documento_id, db)

    if document.estado != "PENDIENTE_AUDITORIA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El documento ya fue resuelto",
        )

    old_json_path = document.oci_json_path
    new_json_path = f"procesados/auditados/{documento_id}.json"
    audited_at = datetime.now(timezone.utc)

    consolidated_json = {
        **document.raw_extracted_json,
        "auditoria": {
            "audited_by_id": str(current_user.id),
            "audited_by_username": current_user.username,
            "audit_notes": payload.audit_notes,
            "audited_at": audited_at.isoformat(),
            "correcciones": payload.model_dump(mode="json", exclude={"audit_notes"}),
        },
    }

    try:
        content = json.dumps(consolidated_json, ensure_ascii=False).encode("utf-8")
        await oci_storage_client.upload_object(
            new_json_path, content, content_type="application/json"
        )
    except Exception as exc:
        logger.exception(
            "Fallo al subir el JSON auditado a OCI para el documento %s", documento_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible almacenar el JSON auditado en OCI Object Storage",
        ) from exc

    document.rut_paciente = payload.rut_paciente
    document.nombre_paciente = payload.nombre_paciente
    document.edad_paciente = payload.edad_paciente
    document.medico_nombre = payload.medico_nombre
    document.medico_rut = payload.medico_rut
    document.tipo_documento = payload.tipo_documento
    document.nivel_prioridad = payload.nivel_prioridad
    document.diagnostico_principal = payload.diagnostico_principal
    document.cie10_sugerido = payload.cie10_sugerido
    document.destino_enrutamiento = payload.destino_enrutamiento
    document.estado = "AUDITADO"
    document.requiere_auditoria = False
    document.audited_by_id = current_user.id
    document.audit_notes = payload.audit_notes
    document.audited_at = audited_at
    document.oci_json_path = new_json_path

    try:
        await db.commit()
        await db.refresh(document)
    except SQLAlchemyError as exc:
        logger.exception(
            "Fallo al persistir la auditoría del documento %s en PostgreSQL", documento_id
        )
        await db.rollback()
        try:
            await oci_storage_client.delete_object(new_json_path)
            logger.warning(
                "Compensación aplicada: JSON auditado eliminado de OCI -> %s", new_json_path
            )
        except Exception:
            logger.exception(
                "Fallo al ejecutar la compensación de OCI para %s", new_json_path
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible registrar la auditoría en la base de datos",
        ) from exc

    try:
        await oci_storage_client.delete_object(old_json_path)
    except Exception:
        logger.exception(
            "El documento %s fue auditado correctamente pero no se pudo eliminar "
            "el JSON antiguo en %s",
            documento_id,
            old_json_path,
        )

    logger.info(
        "Documento %s auditado correctamente por %s", documento_id, current_user.username
    )
    return document
