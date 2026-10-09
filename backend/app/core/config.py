"""Configuración centralizada de la aplicación mediante Pydantic Settings."""

import json
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Valores de ejemplo que nunca deben llegar a producción.
_INSECURE_JWT_SECRETS = {"", "insecure-dev-secret-change-me", "change-me"}
_MIN_JWT_SECRET_LENGTH = 32


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

    # Base de datos. `DB_ECHO` imprime cada SQL con sus parámetros (datos de pacientes): solo
    # para depurar en local.
    DATABASE_URL: str = ""
    DB_ECHO: bool = False

    # Autenticación (JWT)
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Bloqueo temporal del login tras varios intentos fallidos (por usuario + IP).
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # Tamaño máximo de cada archivo de la ingesta (ya decodificado). El front limita a 10 MB.
    INGEST_MAX_FILE_MB: int = 10
    INGEST_MAX_FILES: int = 10

    # Oracle Cloud Infrastructure (OCI) Object Storage.
    # `api_key`: usuario + llave PEM (desarrollo). `instance_principal`: la VM de OCI se
    # autentica sola mediante un Dynamic Group + Policy, sin llaves en el servidor.
    OCI_AUTH_MODE: Literal["api_key", "instance_principal"] = "api_key"
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
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def _check_production_secrets(self) -> "Settings":
        """En producción no se arranca con un secreto JWT de ejemplo o demasiado corto."""
        if self.is_production and (
            self.JWT_SECRET_KEY in _INSECURE_JWT_SECRETS
            or len(self.JWT_SECRET_KEY) < _MIN_JWT_SECRET_LENGTH
        ):
            raise ValueError(
                "JWT_SECRET_KEY inseguro para producción: genera uno con `openssl rand -hex 32`"
            )
        return self

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
