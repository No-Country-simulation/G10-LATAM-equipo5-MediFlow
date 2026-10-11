"""Middleware que da a cada petición un ID de seguimiento y escribe una línea de log por petición.

    POST /api/v1/users?page -> 201 (35 ms)

- Reutiliza el `X-Request-ID` recibido (lo genera el frontend y n8n lo reenvía) si tiene un
  formato seguro; si no, genera uno. Lo devuelve en el header `X-Request-ID` de la respuesta.
- De la query solo registra los **nombres** de los parámetros: sus valores pueden ser datos de
  pacientes (ej. `?rut=...`).
- Nivel según el resultado: `INFO` (2xx/3xx), `WARNING` (4xx o petición lenta), `ERROR` (5xx).
- Un error no controlado se registra una sola vez, con traceback, y se responde `500` en JSON
  con el código de seguimiento para que el usuario pueda reportarlo.

Se monta **dentro** de `CORSMiddleware`: los preflight `OPTIONS` no llegan aquí (no ensucian el
log) y la respuesta `500` también lleva los headers CORS.
"""

import logging
import re
import time
from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.log_config import RequestContext, bind_request_context, reset_request_context

logger = logging.getLogger("app.http")

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
SLOW_REQUEST_MS = 3000

# Sondas de salud de Docker / balanceador: cada 30 s, no aportan al seguimiento.
_QUIET_PATHS = ("/health/live",)


def resolve_request_id(received: str | None) -> str:
    """El ID recibido si es seguro para el log; si no, uno nuevo de 12 caracteres."""
    if received and _VALID_REQUEST_ID.match(received):
        return received
    return uuid4().hex[:12]


def describe_target(path: str, query_string: bytes) -> str:
    """Ruta con los nombres de los parámetros de la query, sin sus valores."""
    if not query_string:
        return path
    names = sorted({pair.split(b"=", 1)[0].decode("latin-1") for pair in query_string.split(b"&") if pair})
    return f"{path}?{','.join(names)}"


def _level_for(status: int, duration_ms: float) -> int:
    if status >= 500:
        return logging.ERROR
    if status >= 400 or duration_ms >= SLOW_REQUEST_MS:
        return logging.WARNING
    return logging.INFO


class RequestLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        request_id = resolve_request_id(headers.get(REQUEST_ID_HEADER.lower().encode(), b"").decode("latin-1"))
        token = bind_request_context(RequestContext(request_id=request_id))
        target = describe_target(scope["path"], scope.get("query_string", b""))
        started = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            logger.exception("Error no controlado en %s %s", scope["method"], target)
            if not response_started:
                response = JSONResponse(
                    status_code=500,
                    content={"detail": f"Error interno del servidor. Código de seguimiento: {request_id}"},
                    headers={REQUEST_ID_HEADER: request_id},
                )
                await response(scope, receive, send)
            status_code = 500
        finally:
            duration_ms = (time.perf_counter() - started) * 1000
            if not scope["path"].endswith(_QUIET_PATHS) or status_code >= 400:
                logger.log(
                    _level_for(status_code, duration_ms),
                    "%s %s -> %d (%.0f ms)",
                    scope["method"],
                    target,
                    status_code,
                    duration_ms,
                )
            reset_request_context(token)
