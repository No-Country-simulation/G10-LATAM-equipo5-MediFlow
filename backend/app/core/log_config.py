"""Configuración de logs de MediFlow API: un formato único, fácil de leer y de seguir.

Cada línea lleva la hora, el nivel, el **ID de seguimiento** de la petición y el usuario:

    2026-10-09 21:14:03 INFO    [a1b2c3d4e5f6 admin_user] auth.service: Usuario kine creado

El ID llega en el header `X-Request-ID` (lo genera el frontend y n8n lo reenvía), así que
una misma operación se puede seguir del navegador a n8n y al backend buscando ese valor.
Con `LOG_FORMAT=json` cada línea es un objeto JSON, para agregadores de logs.

Nunca se registran tokens, contraseñas ni datos de pacientes (nombre, RUT): solo
identificadores técnicos como `documento_id`.
"""

import json
import logging
import logging.config
import re
import sys
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

NO_CONTEXT = "-"
_APP_PREFIX = "app.features."
_MAX_LOGGED_VALUE = 120
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")

TEXT_FORMAT = "%(asctime)s %(levelname)-7s [%(request_id)s %(username)s] %(short_name)s: %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


@dataclass
class RequestContext:
    """Datos de la petición en curso que se agregan a cada línea de log.

    Es mutable a propósito: el middleware crea una instancia por petición y la dependencia de
    autenticación completa `username`, aunque se ejecute en un contexto copiado.
    """

    request_id: str = NO_CONTEXT
    username: str = NO_CONTEXT


_request_context: ContextVar[RequestContext | None] = ContextVar("request_context", default=None)


def current_context() -> RequestContext:
    return _request_context.get() or RequestContext()


def bind_request_context(context: RequestContext):
    """Activa el contexto de una petición; retorna el token para restaurarlo al terminar."""
    return _request_context.set(context)


def reset_request_context(token) -> None:
    _request_context.reset(token)


def set_current_username(username: str) -> None:
    """Asocia el usuario autenticado a la petición en curso (no-op fuera de una petición)."""
    context = _request_context.get()
    if context is not None:
        context.username = username


def safe(value: object) -> str:
    """Valor apto para el log: sin saltos de línea ni caracteres de control (evita que un dato
    del usuario falsifique líneas de log) y acotado en largo."""
    text = _CONTROL_CHARS.sub("?", str(value))
    return text if len(text) <= _MAX_LOGGED_VALUE else f"{text[:_MAX_LOGGED_VALUE]}..."


def _short_logger_name(name: str) -> str:
    """`app.features.auth.service` -> `auth.service`; `uvicorn.error` (que también emite los
    mensajes INFO de arranque) -> `uvicorn`, para no leer "error" donde no lo hay."""
    if name.startswith("uvicorn"):
        return "uvicorn"
    return name.removeprefix(_APP_PREFIX).removeprefix("app.")


class ContextFilter(logging.Filter):
    """Agrega `request_id`, `username` y un nombre de logger corto a cada registro."""

    def filter(self, record: logging.LogRecord) -> bool:
        context = current_context()
        record.request_id = context.request_id
        record.username = context.username
        record.short_name = _short_logger_name(record.name)
        return True


class JsonFormatter(logging.Formatter):
    """Una línea JSON por registro, con los mismos campos que el formato de texto."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": getattr(record, "short_name", record.name),
            "request_id": getattr(record, "request_id", NO_CONTEXT),
            "user": getattr(record, "username", NO_CONTEXT),
            "message": record.getMessage(),
        }
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


def configure_logging(level: str = "INFO", log_format: Literal["text", "json"] = "text") -> None:
    """Configura todos los loggers (app, uvicorn y librerías) con el formato de MediFlow.

    El access log de uvicorn se apaga: lo reemplaza `RequestLoggingMiddleware`, que registra
    una línea por petición con el usuario y la duración (y sin los preflight `OPTIONS`).
    """
    # La consola de Windows o una redirección a archivo usan otra codificación por defecto: así
    # las tildes se ven igual en local y en Docker.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")

    formatter: dict[str, Any] = (
        {"()": JsonFormatter}
        if log_format == "json"
        else {"format": TEXT_FORMAT, "datefmt": DATE_FORMAT}
    )
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "filters": {"context": {"()": ContextFilter}},
            "formatters": {"mediflow": formatter},
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "mediflow",
                    "filters": ["context"],
                    "stream": "ext://sys.stdout",
                }
            },
            "root": {"handlers": ["console"], "level": level.upper()},
            "loggers": {
                "uvicorn": {"handlers": ["console"], "level": "INFO", "propagate": False},
                "uvicorn.error": {"handlers": ["console"], "level": "INFO", "propagate": False},
                "uvicorn.access": {"handlers": [], "level": "WARNING", "propagate": False},
                # Librerías ruidosas: solo advertencias y errores.
                "oci": {"level": "WARNING"},
                "sqlalchemy": {"level": "WARNING"},
                "httpx": {"level": "WARNING"},
                "passlib": {"level": "ERROR"},
            },
        }
    )
