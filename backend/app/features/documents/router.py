"""Router de la feature de ingesta y consulta de documentos clínicos."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.auth.dependencies import get_current_user
from app.features.auth.models import User
from app.features.documents.schemas import (
    DocumentListItemResponse,
    IngestPayload,
    IngestResponse,
)
from app.features.documents.service import (
    DocumentIngestionError,
    InvalidBase64Error,
    ingest_document,
    search_documents_by_rut,
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


@router.get("/search", response_model=list[DocumentListItemResponse])
async def search(
    rut: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentListItemResponse]:
    """Busca los documentos clínicos asociados a un paciente por su RUT. Requiere sesión autenticada."""
    documents = await search_documents_by_rut(rut, db)
    if not documents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No se encontraron documentos para el RUT {rut}",
        )
    return [DocumentListItemResponse.model_validate(document) for document in documents]
