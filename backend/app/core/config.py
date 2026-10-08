"""Configuración centralizada de la aplicación mediante Pydantic Settings."""

import json
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de entorno y configuración global de MediFlow API."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Aplicación
    PROJECT_NAME: str = "MediFlow API"
    ENVIRONMENT: str = "development"
    API_V1_PREFIX: str = "/api/v1"

    # Base de datos
    DATABASE_URL: str = ""

    # Autenticación (JWT)
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Oracle Cloud Infrastructure (OCI) Object Storage
    OCI_USER_OCID: str = ""
    OCI_TENANCY_OCID: str = ""
    OCI_FINGERPRINT: str = ""
    OCI_REGION: str = ""
    OCI_KEY_FILE_PATH: str = ""
    OCI_BUCKET_NAME: str = ""
    OCI_COMPARTMENT_OCID: str = ""

    # CORS: orígenes separados por coma (o lista JSON) y, opcional, una regex para orígenes
    # variables, ej. previews `https://mediflow-.*\.vercel\.app`.
    BACKEND_CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    BACKEND_CORS_ORIGIN_REGEX: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        """Orígenes de `BACKEND_CORS_ORIGINS` normalizados (sin espacios ni `/` final)."""
        raw = self.BACKEND_CORS_ORIGINS.strip()
        origins = json.loads(raw) if raw.startswith("[") else raw.split(",")
        return [origin.strip().rstrip("/") for origin in origins if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Retorna una instancia cacheada de la configuración de la aplicación."""
    return Settings()


settings = get_settings()
