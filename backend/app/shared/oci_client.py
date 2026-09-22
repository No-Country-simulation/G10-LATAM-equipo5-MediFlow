"""Cliente singleton para interactuar con Oracle Cloud Infrastructure (OCI) Object Storage."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import ClassVar, Optional
from uuid import uuid4

import oci
from oci.exceptions import ConfigFileNotFound, InvalidConfig, ServiceError

from app.core.config import settings

logger = logging.getLogger(__name__)


class OCIStorageClient:
    """Cliente singleton que encapsula el acceso al servicio OCI Object Storage."""

    _instance: ClassVar[Optional["OCIStorageClient"]] = None
    _client: Optional[oci.object_storage.ObjectStorageClient]
    _namespace: Optional[str]

    def __new__(cls) -> "OCIStorageClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._client = None
            cls._instance._namespace = None
        return cls._instance

    def _build_config(self) -> dict:
        """Construye el diccionario de configuración de autenticación programática de OCI."""
        return {
            "user": settings.OCI_USER_OCID,
            "tenancy": settings.OCI_TENANCY_OCID,
            "fingerprint": settings.OCI_FINGERPRINT,
            "region": settings.OCI_REGION,
            "key_file": settings.OCI_KEY_FILE_PATH,
        }

    @property
    def client(self) -> oci.object_storage.ObjectStorageClient:
        """Retorna (creando si es necesario) el cliente de bajo nivel de OCI Object Storage."""
        if self._client is None:
            config = self._build_config()
            oci.config.validate_config(config)
            self._client = oci.object_storage.ObjectStorageClient(config)
        return self._client

    def _check_bucket_access_sync(self) -> bool:
        """Realiza `get_namespace` y `get_bucket` de forma bloqueante contra el SDK de OCI."""
        namespace_response = self.client.get_namespace(
            compartment_id=settings.OCI_COMPARTMENT_OCID
        )
        self.client.get_bucket(
            namespace_name=namespace_response.data,
            bucket_name=settings.OCI_BUCKET_NAME,
        )
        return True

    async def check_bucket_access(self) -> bool:
        """Verifica credenciales y visibilidad del bucket configurado.

        Realiza `get_namespace` para validar las credenciales y `get_bucket`
        para confirmar que el bucket objetivo es accesible dentro del compartment configurado.
        El SDK de OCI es síncrono, por lo que la llamada se delega a un hilo aparte
        para no bloquear el event loop.
        """
        try:
            return await asyncio.to_thread(self._check_bucket_access_sync)
        except (ServiceError, ConfigFileNotFound, InvalidConfig):
            logger.exception("Fallo al verificar el acceso al bucket de OCI")
            return False
        except Exception:
            logger.exception("Error inesperado al verificar el acceso al bucket de OCI")
            return False

    def _get_namespace_sync(self) -> str:
        """Obtiene (cacheando) el namespace de Object Storage del tenancy configurado."""
        if self._namespace is None:
            self._namespace = self.client.get_namespace(
                compartment_id=settings.OCI_COMPARTMENT_OCID
            ).data
        return self._namespace

    def _upload_object_sync(
        self, object_name: str, content: bytes, content_type: Optional[str]
    ) -> None:
        self.client.put_object(
            namespace_name=self._get_namespace_sync(),
            bucket_name=settings.OCI_BUCKET_NAME,
            object_name=object_name,
            put_object_body=content,
            content_type=content_type,
        )

    async def upload_object(
        self, object_name: str, content: bytes, content_type: Optional[str] = None
    ) -> None:
        """Sube `content` al bucket configurado bajo la ruta `object_name`.

        El SDK de OCI es síncrono, por lo que la llamada se delega a un hilo aparte
        para no bloquear el event loop.
        """
        await asyncio.to_thread(self._upload_object_sync, object_name, content, content_type)

    def _delete_object_sync(self, object_name: str) -> None:
        self.client.delete_object(
            namespace_name=self._get_namespace_sync(),
            bucket_name=settings.OCI_BUCKET_NAME,
            object_name=object_name,
        )

    async def delete_object(self, object_name: str) -> None:
        """Elimina `object_name` del bucket configurado. Es un no-op si el objeto no existe."""
        try:
            await asyncio.to_thread(self._delete_object_sync, object_name)
        except ServiceError as exc:
            if exc.status == 404:
                return
            raise

    def _create_par_sync(self, object_name: str, expire_minutes: int) -> str:
        details = oci.object_storage.models.CreatePreauthenticatedRequestDetails(
            name=f"par-{uuid4().hex}",
            object_name=object_name,
            access_type="ObjectRead",
            time_expires=datetime.now(timezone.utc) + timedelta(minutes=expire_minutes),
        )
        response = self.client.create_preauthenticated_request(
            namespace_name=self._get_namespace_sync(),
            bucket_name=settings.OCI_BUCKET_NAME,
            create_preauthenticated_request_details=details,
        )
        return f"{self.client.base_client.endpoint}{response.data.access_uri}"

    async def create_preauthenticated_request(
        self, object_name: str, expire_minutes: int = 15
    ) -> str:
        """Genera una URL pre-firmada (PAR) de solo lectura para `object_name`, válida por `expire_minutes`."""
        return await asyncio.to_thread(self._create_par_sync, object_name, expire_minutes)


oci_storage_client = OCIStorageClient()
