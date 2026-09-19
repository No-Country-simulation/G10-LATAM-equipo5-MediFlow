"""Configuración centralizada de la aplicación mediante Pydantic Settings."""

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
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mediflow"

    # Oracle Cloud Infrastructure (OCI) Object Storage
    OCI_USER_OCID: str = ""
    OCI_TENANCY_OCID: str = ""
    OCI_FINGERPRINT: str = ""
    OCI_REGION: str = ""
    OCI_KEY_FILE_PATH: str = ""
    OCI_BUCKET_NAME: str = ""
    OCI_COMPARTMENT_OCID: str = ""

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    """Retorna una instancia cacheada de la configuración de la aplicación."""
    return Settings()


settings = get_settings()
