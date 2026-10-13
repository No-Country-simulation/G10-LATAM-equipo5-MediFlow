"""Router de la feature de ingesta y consulta de documentos clínicos."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.features.audit.schemas import DocumentCorrectionRequest
from app.features.audit.service import correct_document
from app.features.auth.dependencies import require_roles
from app.features.auth.enums import UserRole
from app.features.auth.models import User
from app.features.documents.detail import get_document_detail
from app.features.documents.duplicates import coincidencias_de_archivo
from app.features.documents.schemas import (
    AlmacenamientoOci,
    DashboardStatsResponse,
    DocumentDetailResponse,
    DocumentListItemResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    IngestPayload,
    IngestResponse,
    PaginatedDocumentResponse,
)
from app.features.documents.service import (
    DocumentAlreadyExistsError,
    DocumentIngestionError,
    InvalidBase64Error,
    get_paginated_documents,
    ingest_document,
)
from app.features.documents.stats import get_dashboard_stats

router = APIRouter(tags=["Documents"])

_DOCUMENT_ACCESS_ROLES = [UserRole.ADMIN, UserRole.AUDITOR_CLINICO, UserRole.OPERADOR]
_DOCUMENT_CORRECTION_ROLES = [UserRole.ADMIN, UserRole.AUDITOR_CLINICO]
_DIAS_DASHBOARD_POR_DEFECTO = 14
_DIAS_DASHBOARD_MAXIMO = 92
_DOCUMENTO_ID = Path(max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


def _own_documents_only(user: User) -> UUID | None:
    """Un OPERADOR solo accede a los documentos que subió; los demás roles, a todos."""
    return user.id if user.role == UserRole.OPERADOR else None


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest(
    payload: IngestPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_DOCUMENT_ACCESS_ROLES)),
) -> IngestResponse:
    """Recibe un documento clínico procesado por n8n, lo respalda en OCI y lo registra en la base de datos.

    Requiere rol ADMIN, AUDITOR_CLINICO u OPERADOR. n8n reenvía el token Bearer del usuario que
    subió el documento desde el front, y ese usuario queda registrado en `uploaded_by_id`.
    """
    try:
        document = await ingest_document(payload, db, uploaded_by=current_user)
    except InvalidBase64Error as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except DocumentAlreadyExistsError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except DocumentIngestionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        ) from exc

    # Se responde con lo guardado (normalizado por el backend), no con el payload recibido.
    guardado = document.raw_extracted_json
    return IngestResponse(
        status=document.estado,
        documento_id=document.documento_id,
        score_confianza=float(document.score_confianza),
        motivos_auditoria=guardado["triaje"]["motivos_auditoria"],
        clasificacion=guardado["clasificacion"],
        datos_generales=guardado["datos_generales"],
        detalle_clinico=guardado["detalle_clinico"],
        decision_enrutamiento=guardado["decision_enrutamiento"],
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
        None, description="Filtrar por estado (uno o varios separados por coma): PENDIENTE_AUDITORIA, PROCESADO, AUDITADO, DESCARTADO"
    ),
    destino: str | None = Query(
        None, description="Filtrar por cola: Cola_Emergencia_Medica, Farmacia_Hospitalaria, etc."
    ),
    identificacion: str | None = Query(
        None, max_length=40, description="Filtrar por identificación del paciente (RUT, DNI, cédula...)"
    ),
    numero_ficha: str | None = Query(None, max_length=50, description="Filtrar por N° de ficha clínica"),
    prioridad: str | None = Query(None, description="Rutina, Prioritario, Urgente"),
    fecha_desde: datetime | None = Query(None),
    fecha_hasta: datetime | None = Query(None),
    area_origen_id: UUID | None = Query(None, description="Filtrar por área de origen (id del área)"),
) -> PaginatedDocumentResponse:
    """Lista la bandeja documental con filtros dinámicos y paginación.

    Requiere rol ADMIN, AUDITOR_CLINICO u OPERADOR; un OPERADOR solo ve los documentos que subió.
    """
    result = await get_paginated_documents(
        db,
        uploaded_by_id=_own_documents_only(current_user),
        page=page,
        page_size=page_size,
        estado=estado,
        destino=destino,
        identificacion=identificacion,
        numero_ficha=numero_ficha,
        prioridad=prioridad,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        area_origen_id=area_origen_id,
    )
    return PaginatedDocumentResponse(
        items=[DocumentListItemResponse.model_validate(item) for item in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        total_pages=result["total_pages"],
        message="No hay documentos con los filtros utilizados" if result["total"] == 0 else None,
    )


def _con_zona(valor: datetime | None) -> datetime | None:
    """Una fecha sin zona horaria se interpreta en UTC (así se puede comparar con las que la traen)."""
    if valor is not None and valor.tzinfo is None:
        return valor.replace(tzinfo=timezone.utc)
    return valor


@router.get("/stats", response_model=DashboardStatsResponse)
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_DOCUMENT_ACCESS_ROLES)),
    fecha_desde: datetime | None = Query(None, description="Inicio del período (por defecto, hace 14 días)"),
    fecha_hasta: datetime | None = Query(None, description="Fin del período (por defecto, ahora)"),
    utc_offset_min: int = Query(
        0, ge=-840, le=840, description="Desfase de la hora local respecto de UTC, en minutos (Chile: -180)"
    ),
) -> DashboardStatsResponse:
    """Resumen del inicio: conteos del período por prioridad, estado, día y cola, más las listas
    de trabajo del rol (pendientes de auditoría y casos tomados, o las últimas cargas del OPERADOR).

    Requiere rol ADMIN, AUDITOR_CLINICO u OPERADOR; un OPERADOR solo cuenta los documentos que subió.
    """
    hasta = _con_zona(fecha_hasta) or datetime.now(timezone.utc)
    desde = _con_zona(fecha_desde) or hasta - timedelta(days=_DIAS_DASHBOARD_POR_DEFECTO - 1)
    if desde > hasta:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="fecha_desde no puede ser posterior a fecha_hasta",
        )
    if hasta - desde > timedelta(days=_DIAS_DASHBOARD_MAXIMO):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"El período no puede superar {_DIAS_DASHBOARD_MAXIMO} días",
        )
    return await get_dashboard_stats(db, current_user, desde, hasta, utc_offset_min)


@router.post("/duplicates/check", response_model=DuplicateCheckResponse)
async def check_duplicate_files(
    payload: DuplicateCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_DOCUMENT_ACCESS_ROLES)),
) -> DuplicateCheckResponse:
    """Indica si alguno de los archivos (por su huella SHA-256) ya fue subido.

    El frontend lo consulta antes de enviar el archivo a n8n, para avisar antes de gastar en la
    IA. Se compara contra todos los documentos; un OPERADOR solo ve el detalle (`documento_id`,
    `estado`) de los que subió él: de los demás, solo el área y la fecha.

    Requiere rol ADMIN, AUDITOR_CLINICO u OPERADOR.
    """
    coincidencias = await coincidencias_de_archivo(
        db,
        payload.sha256,
        solicitante_id=current_user.id,
        ver_todo=_own_documents_only(current_user) is None,
    )
    return DuplicateCheckResponse(coincidencias=coincidencias)


@router.get("/{documento_id}", response_model=DocumentDetailResponse)
async def get_document(
    documento_id: str = _DOCUMENTO_ID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_DOCUMENT_ACCESS_ROLES)),
) -> DocumentDetailResponse:
    """Detalle de un documento: datos del caso, área de origen, archivos originales y detalle clínico.

    - `archivos`: una URL pre-firmada de solo lectura por archivo, válida por
      `preview_expira_en_minutos`. Si OCI no puede generar alguna, el detalle se entrega igual
      con `url: null` en ese archivo y el motivo en `aviso_archivos`.
    - `detalle.tablas`: medicamentos, paneles de laboratorio o procedimientos, según el tipo.
    - `detalle.campos_relevantes`: campos de texto del tipo que no tienen tabla propia.

    Requiere rol ADMIN, AUDITOR_CLINICO u OPERADOR. Un OPERADOR solo ve los documentos que
    subió; para cualquier otro recibe `404`.
    """
    return await get_document_detail(documento_id, db, uploaded_by_id=_own_documents_only(current_user))


@router.put("/{documento_id}", response_model=DocumentListItemResponse)
async def correct_document_values(
    payload: DocumentCorrectionRequest,
    documento_id: str = _DOCUMENTO_ID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(_DOCUMENT_CORRECTION_ROLES)),
) -> DocumentListItemResponse:
    """Corrige los valores de un documento PROCESADO o AUDITADO.

    Mismo cuerpo y mismas validaciones que la resolución de auditoría (identificación, CIE-10,
    catálogos, detalle según el tipo), con `justificacion` obligatoria. El documento conserva su
    estado y queda enrutado según la clasificación corregida; el cambio se registra en
    `historial_correcciones` del detalle.

    - `409` si el documento está pendiente de auditoría o descartado.
    - `422` con la lista de problemas si la corrección no es válida o no cambia nada.

    Requiere rol ADMIN o AUDITOR_CLINICO.
    """
    document = await correct_document(documento_id, payload, current_user, db)
    return DocumentListItemResponse.model_validate(document)
