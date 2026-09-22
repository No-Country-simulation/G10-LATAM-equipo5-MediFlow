"""Router de la feature de diagnóstico y salud."""

from fastapi import APIRouter, Response, status

from app.features.health.schemas import HealthCheckResponse
from app.features.health.service import get_health_status

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(response: Response) -> HealthCheckResponse:
    """Retorna el estado de salud de la API y sus dependencias externas (DB y OCI)."""
    health = await get_health_status()

    if not (health.database_status and health.oci_status):
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return health
