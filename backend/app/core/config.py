"""Configuracion centralizada de la aplicacion, cargada desde variables de entorno."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables de entorno y configuracion tipada de MediFlow backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Entorno general ---
    environment: str = Field(default="development", alias="ENVIRONMENT")
    backend_port: int = Field(default=8000, alias="BACKEND_PORT")

    # --- Orquestacion (n8n) ---
    n8n_webhook_url: str = Field(
        default="http://n8n:5678/webhook/triage", alias="N8N_WEBHOOK_URL"
    )

    # --- Oracle Cloud Infrastructure (OCI) ---
    oci_user_ocid: str = Field(default="", alias="OCI_USER_OCID")
    oci_tenancy_ocid: str = Field(default="", alias="OCI_TENANCY_OCID")
    oci_fingerprint: str = Field(default="", alias="OCI_FINGERPRINT")
    oci_region: str = Field(default="us-ashburn-1", alias="OCI_REGION")
    oci_key_file_path: str = Field(
        default="/secrets/oci_api_key.pem", alias="OCI_KEY_FILE_PATH"
    )
    oci_bucket_name: str = Field(
        default="mediflow-documentos-clinicos", alias="OCI_BUCKET_NAME"
    )

    # --- Proveedores de LLM ---
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")

    # --- Base de datos local de auditoria ---
    audit_db_path: str = Field(default="/app/data/mediflow_audit.db", alias="AUDIT_DB_PATH")

    @property
    def oci_config(self) -> dict[str, str]:
        """Diccionario de configuracion compatible con el SDK de OCI."""
        return {
            "user": self.oci_user_ocid,
            "tenancy": self.oci_tenancy_ocid,
            "fingerprint": self.oci_fingerprint,
            "region": self.oci_region,
            "key_file": self.oci_key_file_path,
        }


@lru_cache
def get_settings() -> Settings:
    """Retorna una instancia cacheada de Settings para evitar relecturas repetidas."""
    return Settings()
