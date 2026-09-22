"""Lógica de negocio para el chequeo de salud: conectividad con la base de datos y OCI."""

import asyncio
import logging

import asyncpg
from oci.exceptions import ServiceError

from app import __version__ as app_version
from app.core.database import check_db_connection
from app.features.health.schemas import HealthCheckResponse, HealthStatus
from app.shared.oci_client import oci_storage_client

logger = logging.getLogger(__name__)


async def _safe_check_db() -> bool:
    """Verifica la conexión a la base de datos capturando errores específicos de Postgres."""
    try:
        return await check_db_connection()
    except asyncpg.PostgresError:
        logger.exception("Error de Postgres al verificar la base de datos")
        return False
    except Exception:
        logger.exception("Error inesperado al verificar la base de datos")
        return False


async def _safe_check_oci() -> bool:
    """Verifica el acceso a OCI Object Storage capturando errores específicos del servicio."""
    try:
        return await oci_storage_client.check_bucket_access()
    except ServiceError:
        logger.exception("Error del servicio OCI al verificar el bucket")
        return False
    except Exception:
        logger.exception("Error inesperado al verificar OCI")
        return False


def _resolve_status(database_status: bool, oci_status: bool) -> HealthStatus:
    """Determina el estado general a partir de las dependencias verificadas."""
    if database_status and oci_status:
        return "healthy"
    if not database_status and not oci_status:
        return "unhealthy"
    return "degraded"


async def get_health_status() -> HealthCheckResponse:
    """Ejecuta de forma concurrente los chequeos de dependencias y construye la respuesta."""
    database_status, oci_status = await asyncio.gather(
        _safe_check_db(),
        _safe_check_oci(),
    )

    return HealthCheckResponse(
        status=_resolve_status(database_status, oci_status),
        version=app_version,
        database_status=database_status,
        oci_status=oci_status,
    )
