"""Endurecimiento para producción: bloqueo de login, secretos, límites de ingesta y liveness."""

import pytest
from pydantic import ValidationError

from app.core.config import Settings, settings
from app.core.rate_limit import login_throttle
from app.features.auth import router as auth_router
from app.features.auth.enums import UserRole
from tests.conftest import ingest_body


@pytest.fixture(autouse=True)
def _reset_throttle():
    login_throttle._failures.clear()
    yield
    login_throttle._failures.clear()


async def test_login_locks_after_max_attempts(client, monkeypatch):
    async def fake_auth(*_):
        return None

    monkeypatch.setattr(auth_router, "authenticate_user", fake_auth)
    credentials = {"username": "Admin", "password": "mala"}
    for _ in range(settings.LOGIN_MAX_ATTEMPTS):
        assert (await client.post("/api/v1/auth/login", json=credentials)).status_code == 401

    r = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "otra"})
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0


async def test_login_success_resets_failures(client, monkeypatch):
    from tests.conftest import make_user

    user = make_user(UserRole.ADMIN, username="admin")

    async def fake_auth(_db, username, password):
        return user if password == "ok" else None

    monkeypatch.setattr(auth_router, "authenticate_user", fake_auth)
    for _ in range(settings.LOGIN_MAX_ATTEMPTS - 1):
        await client.post("/api/v1/auth/login", json={"username": "admin", "password": "mala"})
    assert (
        await client.post("/api/v1/auth/login", json={"username": "admin", "password": "ok"})
    ).status_code == 200
    assert (
        await client.post("/api/v1/auth/login", json={"username": "admin", "password": "mala"})
    ).status_code == 401


@pytest.mark.parametrize("secret", ["", "insecure-dev-secret-change-me", "corto"])
def test_production_rejects_weak_jwt_secret(secret):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, ENVIRONMENT="production", JWT_SECRET_KEY=secret)


def test_production_accepts_strong_jwt_secret():
    assert Settings(_env_file=None, ENVIRONMENT="production", JWT_SECRET_KEY="a" * 64).is_production


@pytest.mark.parametrize("documento_id", ["../otro", "DOC 1", "x" * 65, ""])
async def test_ingest_rejects_unsafe_documento_id(client, login_as, documento_id):
    headers = login_as(UserRole.ADMIN)
    body = ingest_body(documento_id=documento_id)
    r = await client.post("/api/v1/documents/ingest", json=body, headers=headers)
    assert r.status_code == 422


async def test_liveness_does_not_touch_dependencies(client):
    r = await client.get("/api/v1/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "alive"}
