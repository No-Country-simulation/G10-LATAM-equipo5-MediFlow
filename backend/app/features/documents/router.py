"""Router de la feature de ingesta y consulta de documentos clínicos."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.documents.schemas import (
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


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest(
    payload: IngestPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IngestResponse:
    """Recibe un documento clínico procesado por n8n, lo respalda en OCI y lo registra en la base de datos.

    Requiere sesión autenticada (n8n debe enviar un token Bearer obtenido vía `/auth/login`).
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
        documento_id=document.documento_id,
        estado=document.estado,
        oci_binary_path=document.oci_binary_path,
        oci_json_path=document.oci_json_path,
        requiere_auditoria=document.requiere_auditoria,
    )


@router.get("", response_model=PaginatedDocumentResponse)
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    """Lista la bandeja documental con filtros dinámicos y paginación. Requiere sesión autenticada."""
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
