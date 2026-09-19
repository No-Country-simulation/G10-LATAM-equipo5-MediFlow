"""Modelos de respuesta para el endpoint de diagnóstico y salud."""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

HealthStatus = Literal["healthy", "degraded", "unhealthy"]


class HealthCheckResponse(BaseModel):
    """Respuesta del chequeo de salud, incluyendo el estado de dependencias externas."""

    status: HealthStatus
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str
    database_status: bool
    oci_status: bool
