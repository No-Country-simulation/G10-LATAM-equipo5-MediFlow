"""Servicio de acceso a Oracle Cloud Infrastructure (OCI) Object Storage."""

from __future__ import annotations

import logging

import oci
from oci.exceptions import ServiceError

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class OCIStorageError(RuntimeError):
    """Error de negocio al interactuar con OCI Object Storage."""


class OCIStorageService:
    """Encapsula las operaciones de subida y movimiento de objetos en OCI."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._config = self._settings.oci_config
        self._client = oci.object_storage.ObjectStorageClient(self._config)
        self._namespace = self._client.get_namespace().data

    @property
    def namespace(self) -> str:
        """Namespace del tenancy de OCI, requerido para operar sobre buckets."""
        return self._namespace

    def upload_bytes(
        self,
        bucket: str,
        object_name: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """Sube un arreglo de bytes como objeto a un bucket de OCI.

        Retorna la ruta logica del objeto (bucket/object_name) si la subida es exitosa.
        """
        try:
            self._client.put_object(
                namespace_name=self._namespace,
                bucket_name=bucket,
                object_name=object_name,
                put_object_body=data,
                content_type=content_type,
            )
        except ServiceError as error:
            logger.error(
                "Fallo al subir objeto '%s' al bucket '%s': %s",
                object_name,
                bucket,
                error.message,
            )
            raise OCIStorageError(
                f"No se pudo subir el objeto '{object_name}' al bucket '{bucket}': {error.message}"
            ) from error

        return f"{bucket}/{object_name}"

    def move_object(self, bucket: str, source: str, target: str) -> str:
        """Mueve (copia y elimina) un objeto dentro del mismo bucket.

        OCI no ofrece un 'rename' nativo; se implementa como copy + delete.
        Retorna la ruta logica del objeto en su nueva ubicacion.
        """
        try:
            self._client.copy_object(
                namespace_name=self._namespace,
                bucket_name=bucket,
                copy_object_details=oci.object_storage.models.CopyObjectDetails(
                    source_object_name=source,
                    destination_region=self._settings.oci_region,
                    destination_namespace=self._namespace,
                    destination_bucket=bucket,
                    destination_object_name=target,
                ),
            )
            self._client.delete_object(
                namespace_name=self._namespace,
                bucket_name=bucket,
                object_name=source,
            )
        except ServiceError as error:
            logger.error(
                "Fallo al mover objeto de '%s' a '%s' en bucket '%s': %s",
                source,
                target,
                bucket,
                error.message,
            )
            raise OCIStorageError(
                f"No se pudo mover el objeto de '{source}' a '{target}': {error.message}"
            ) from error

        return f"{bucket}/{target}"
