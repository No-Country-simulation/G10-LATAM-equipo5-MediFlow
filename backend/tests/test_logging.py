import json
import logging

import pytest

from app.core.log_config import ContextFilter, JsonFormatter, safe
from app.core.request_logging import describe_target, resolve_request_id
from app.features.auth import router as auth_router
from app.features.auth.enums import UserRole
from app.main import app
from tests.conftest import make_user


class _ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records: list[logging.LogRecord] = []

    def emit(self, record):
        self.records.append(record)


@pytest.fixture
def log_records():
    """Registros emitidos durante el test, ya enriquecidos con el contexto de la petición."""
    handler = _ListHandler()
    handler.addFilter(ContextFilter())
    root = logging.getLogger()
    root.addHandler(handler)
    yield handler.records
    root.removeHandler(handler)


def _http_lines(records):
    return [r for r in records if r.name == "app.http"]


# --- Utilidades --------------------------------------------------------------


def test_describe_target_keeps_param_names_but_not_values():
    # Los valores pueden ser datos de pacientes (RUT).
    assert describe_target("/api/v1/documents", b"rut=12.345.678-9&page=2&rut=x") == "/api/v1/documents?page,rut"
    assert describe_target("/api/v1/users", b"") == "/api/v1/users"


@pytest.mark.parametrize(
    ("received", "kept"),
    [("a1b2c3d4e5f6", True), ("front-0123456789", True), ("corto", False), ("con espacio 123", False), (None, False)],
)
def test_resolve_request_id(received, kept):
    request_id = resolve_request_id(received)
    assert (request_id == received) is kept
    assert 8 <= len(request_id) <= 64


def test_safe_removes_control_chars_and_truncates():
    assert safe("admin\nINFO falso") == "admin?INFO falso"
    assert safe("x" * 500).endswith("...")
    assert len(safe("x" * 500)) == 123


def test_json_formatter_includes_context():
    record = logging.LogRecord("app.features.auth.service", logging.INFO, __file__, 1, "Hola %s", ("ana",), None)
    ContextFilter().filter(record)
    entry = json.loads(JsonFormatter().format(record))
    assert entry["message"] == "Hola ana"
    assert entry["logger"] == "auth.service"
    assert entry["level"] == "INFO"
    assert entry["request_id"] == "-"


# --- Middleware --------------------------------------------------------------


async def test_request_gets_tracking_id_and_one_access_line(client, login_as, log_records):
    headers = login_as(UserRole.AUDITOR_CLINICO, username="ana")
    r = await client.get("/api/v1/auth/me", headers=headers)

    request_id = r.headers["X-Request-ID"]
    assert len(request_id) == 12
    lines = _http_lines(log_records)
    assert len(lines) == 1
    assert lines[0].getMessage().startswith("GET /api/v1/auth/me -> 200 (")
    assert lines[0].request_id == request_id
    assert lines[0].username == "ana"
    assert lines[0].levelno == logging.INFO


async def test_incoming_request_id_is_reused(client, log_records):
    r = await client.get("/api/v1/auth/me", headers={"X-Request-ID": "front-abc12345"})
    assert r.headers["X-Request-ID"] == "front-abc12345"
    line = _http_lines(log_records)[0]
    assert line.request_id == "front-abc12345"
    assert line.levelno == logging.WARNING  # 401


async def test_health_probe_is_not_logged(client, log_records):
    assert (await client.get("/api/v1/health/live")).status_code == 200
    assert _http_lines(log_records) == []


async def test_unhandled_error_returns_json_500_with_tracking_code(client, log_records):
    async def boom():
        raise RuntimeError("fallo inesperado")

    app.add_api_route("/api/v1/_test_boom", boom)
    try:
        r = await client.get("/api/v1/_test_boom", headers={"X-Request-ID": "boom-12345678"})
    finally:
        app.router.routes.pop()

    assert r.status_code == 500
    assert r.json() == {"detail": "Error interno del servidor. Código de seguimiento: boom-12345678"}
    errors = [rec for rec in log_records if rec.exc_info]
    assert len(errors) == 1
    assert errors[0].request_id == "boom-12345678"
    assert _http_lines(log_records)[-1].levelno == logging.ERROR


# --- Eventos de negocio ------------------------------------------------------


async def test_failed_login_is_logged_without_log_injection(client, monkeypatch, log_records):
    async def no_user(*_):
        return None

    monkeypatch.setattr(auth_router, "authenticate_user", no_user)
    await client.post("/api/v1/auth/login", json={"username": "evil\nINFO admin ok", "password": "x"})

    failures = [r for r in log_records if r.getMessage().startswith("Login fallido")]
    assert len(failures) == 1
    assert "\n" not in failures[0].getMessage()
    assert failures[0].levelno == logging.WARNING


async def test_successful_login_is_logged_with_user(client, monkeypatch, log_records):
    async def ok(*_):
        return make_user(UserRole.ADMIN, username="root")

    monkeypatch.setattr(auth_router, "authenticate_user", ok)
    await client.post("/api/v1/auth/login", json={"username": "root", "password": "x"})

    login_line = next(r for r in log_records if r.getMessage().startswith("Inicio de sesión de root"))
    assert login_line.username == "root"
    assert "password" not in login_line.getMessage().lower()


def test_uvicorn_logger_is_shown_without_error_suffix():
    record = logging.LogRecord("uvicorn.error", logging.INFO, __file__, 1, "Application startup complete.", (), None)
    ContextFilter().filter(record)
    assert record.short_name == "uvicorn"
