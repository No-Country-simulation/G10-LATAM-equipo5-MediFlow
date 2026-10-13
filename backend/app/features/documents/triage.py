"""Consola de Triaje: casos activos por cola, marcar como atendido y derivar a otra cola.

- Las colas que aparecen en la consola son las del catálogo marcadas como asistenciales.
- El ADMIN ve todas; un OPERADOR o AUDITOR_CLINICO solo las colas que tiene asignadas.
- Marcar como atendido no cambia el `estado`: el caso sigue en Expedientes y solo sale de la consola.
- Derivar cambia la cola con un motivo que queda en el historial del documento; en la nueva cola el
  caso vuelve a estar activo (se quita la marca de atendido).
"""

import copy
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import noload

from app.features.audit.service import _guardar_correccion, _registrar_correccion
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.catalogs.models import RoutingQueue
from app.features.documents.models import ClinicalDocument

logger = logging.getLogger(__name__)

ESTADOS_ACTIVOS = ("PROCESADO", "AUDITADO")
ORIGEN_DERIVACION = "DERIVACION"
LIMITE_CASOS = 200


async def visible_queues(db: AsyncSession, user: User) -> list[RoutingQueue]:
    """Colas asistenciales activas que el usuario ve en la consola (el ADMIN, todas)."""
    if user.role == UserRole.ADMIN:
        result = await db.execute(
            select(RoutingQueue)
            .where(RoutingQueue.is_active.is_(True), RoutingQueue.es_asistencial.is_(True))
            .order_by(RoutingQueue.nombre)
        )
        return list(result.scalars().all())
    return [q for q in user.colas if q.is_active and q.es_asistencial]


async def get_triage_cases(db: AsyncSession, user: User) -> tuple[list[RoutingQueue], list[ClinicalDocument]]:
    """Casos activos (resueltos, sin atender) de las colas visibles, los más recientes primero."""
    colas = await visible_queues(db, user)
    if not colas:
        return [], []
    result = await db.execute(
        select(ClinicalDocument)
        .options(
            noload(ClinicalDocument.attachments),
            noload(ClinicalDocument.medications),
            noload(ClinicalDocument.lab_panels),
            noload(ClinicalDocument.procedures),
        )
        .where(
            ClinicalDocument.estado.in_(ESTADOS_ACTIVOS),
            ClinicalDocument.destino_enrutamiento.in_([q.codigo for q in colas]),
            ClinicalDocument.atendido_at.is_(None),
        )
        .order_by(ClinicalDocument.created_at.desc())
        .limit(LIMITE_CASOS)
    )
    return colas, list(result.scalars().all())


async def _get_document_or_404(documento_id: str, db: AsyncSession) -> ClinicalDocument:
    result = await db.execute(select(ClinicalDocument).where(ClinicalDocument.documento_id == documento_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontró el documento {documento_id}",
        )
    return document


def _ensure_activo(document: ClinicalDocument, accion: str) -> None:
    if document.estado not in ESTADOS_ACTIVOS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se puede {accion} un documento procesado o auditado",
        )


def _ensure_en_sus_colas(document: ClinicalDocument, user: User) -> None:
    """Un AUDITOR_CLINICO solo actúa sobre los casos de sus colas; el ADMIN, sobre todos."""
    if user.role == UserRole.ADMIN:
        return
    if document.destino_enrutamiento not in {q.codigo for q in user.colas}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El documento no está en ninguna de tus colas",
        )


async def mark_attended(documento_id: str, user: User, db: AsyncSession) -> ClinicalDocument:
    """Marca el caso como atendido. Si ya lo estaba, lo deja como está (conserva quién y cuándo)."""
    document = await _get_document_or_404(documento_id, db)
    _ensure_activo(document, "marcar como atendido")
    _ensure_en_sus_colas(document, user)
    if document.atendido_at is not None:
        return document

    document.atendido_por_id = user.id
    document.atendido_por_username = user.username
    document.atendido_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(document)
    logger.info("Caso %s marcado como atendido por %s", documento_id, user.username)
    return document


async def unmark_attended(documento_id: str, user: User, db: AsyncSession) -> ClinicalDocument:
    """Deshace la marca de atendido: el caso vuelve a la Consola de Triaje."""
    document = await _get_document_or_404(documento_id, db)
    _ensure_en_sus_colas(document, user)
    if document.atendido_at is None:
        return document

    document.atendido_por_id = None
    document.atendido_por_username = None
    document.atendido_at = None
    await db.commit()
    await db.refresh(document)
    logger.info("Caso %s vuelve a la consola de triaje (desmarcado por %s)", documento_id, user.username)
    return document


async def derive_document(
    documento_id: str, destino: str, motivo: str, user: User, db: AsyncSession
) -> ClinicalDocument:
    """Deriva el caso a otra cola activa. El motivo queda en el historial y en el JSON de OCI."""
    document = await _get_document_or_404(documento_id, db)
    _ensure_activo(document, "derivar")
    _ensure_en_sus_colas(document, user)

    if destino == document.destino_enrutamiento:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El documento ya está en esa cola",
        )
    anterior = document.destino_enrutamiento
    result = await db.execute(
        select(RoutingQueue).where(RoutingQueue.codigo.in_([c for c in (destino, anterior) if c]))
    )
    colas = {q.codigo: q for q in result.scalars().all()}
    nueva = colas.get(destino)
    if nueva is None or not nueva.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"La cola '{destino}' no existe o está inactiva",
        )
    nombre_anterior = colas[anterior].nombre if anterior in colas else anterior

    derivado_at = datetime.now(timezone.utc)
    raw = document.raw_extracted_json or {}
    final_json = copy.deepcopy(raw)
    final_json.setdefault("decision_enrutamiento", {})["destino_principal"] = destino
    final_json["derivaciones"] = [
        *(raw.get("derivaciones") or []),
        {
            "desde": anterior,
            "hacia": destino,
            "motivo": motivo,
            "derivado_por_id": str(user.id),
            "derivado_por_username": user.username,
            "derivado_at": derivado_at.isoformat(),
        },
    ]

    document.destino_enrutamiento = destino
    document.justificacion_enrutamiento = f"Derivado manualmente desde {nombre_anterior or 'sin cola'}: {motivo}"
    document.raw_extracted_json = final_json
    # En la nueva cola el caso está pendiente de atender.
    document.atendido_por_id = None
    document.atendido_por_username = None
    document.atendido_at = None
    _registrar_correccion(
        document,
        origen=ORIGEN_DERIVACION,
        justificacion=motivo,
        cambios=[
            {"campo": "destino_enrutamiento", "etiqueta": "Destino", "antes": nombre_anterior, "despues": nueva.nombre}
        ],
        user=user,
        corrected_at=derivado_at,
    )

    await _guardar_correccion(document, final_json, raw, db)
    logger.info("Documento %s derivado de %s a %s por %s", documento_id, anterior, destino, user.username)
    return document
