"""Router de la feature de ingesta y consulta de documentos clínicos."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.auth.dependencies import require_roles
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.documents.schemas import (
    AlmacenamientoOci,
    DocumentListItemResponse,
    IngestPayload,
    IngestResponse,
    PaginatedDocumentResponse,
)
from app.features.documents.service import (
    DocumentIngestionError,
    InvalidBase64Error,
    get_paginated_documents,
    ingest_document,
)

router = APIRouter(tags=["Documents"])

_DOCUMENT_ACCESS_ROLES = [UserRole.ADMIN, UserRole.AUDITOR_CLINICO]


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest(
    payload: IngestPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_DOCUMENT_ACCESS_ROLES)),
) -> IngestResponse:
    """Recibe un documento clínico procesado por n8n, lo respalda en OCI y lo registra en la base de datos.

    Requiere rol ADMIN o AUDITOR_CLINICO (n8n debe autenticarse con una cuenta de servicio con uno
    de esos roles y enviar el token Bearer obtenido vía `/auth/login`).
    """
    try:
        document = await ingest_document(payload, db)
    except InvalidBase64Error as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DocumentIngestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc

    return IngestResponse(
        status="pendiente_auditoria" if document.requiere_auditoria else "procesado",
        documento_id=document.documento_id,
        clasificacion=payload.clasificacion,
        datos_generales=payload.datos_generales,
        detalle_clinico=payload.detalle_clinico,
        decision_enrutamiento=payload.decision_enrutamiento,
        almacenamiento_oci=AlmacenamientoOci(
            bucket=document.oci_bucket_name,
            ruta_objeto=document.oci_json_path,
            rutas_binarios=[attachment.oci_path for attachment in document.attachments],
            status_backup="exito",
        ),
    )


@router.get("", response_model=PaginatedDocumentResponse)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_DOCUMENT_ACCESS_ROLES)),
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Elementos por página"),
    estado: str | None = Query(
        None, description="Filtrar por estado: PENDIENTE_AUDITORIA, PROCESADO, AUDITADO"
    ),
    destino: str | None = Query(
        None, description="Filtrar por cola: Cola_Emergencia_Medica, Farmacia_Hospitalaria, etc."
    ),
    rut: str | None = Query(None, description="Filtrar por RUT de paciente"),
    prioridad: str | None = Query(None, description="Rutina, Prioritario, Urgente"),
    fecha_desde: datetime | None = Query(None),
    fecha_hasta: datetime | None = Query(None),
) -> PaginatedDocumentResponse:
    """Lista la bandeja documental con filtros dinámicos y paginación. Requiere rol ADMIN o AUDITOR_CLINICO."""
    result = await get_paginated_documents(
        db,
        page=page,
        page_size=page_size,
        estado=estado,
        destino=destino,
        rut=rut,
        prioridad=prioridad,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )
    return PaginatedDocumentResponse(
        items=[DocumentListItemResponse.model_validate(item) for item in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
        message="No hay documentos con los filtros utilizados" if result["total"] == 0 else None,
    )
