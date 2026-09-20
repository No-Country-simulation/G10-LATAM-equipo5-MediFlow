from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings
from app.features.auth import router as auth_router
from app.features.auth.enums import UserRole
from tests.conftest import make_user


async def test_login_success(client, monkeypatch):
    user = make_user(UserRole.ADMIN, username="admin")

    async def fake_auth(_db, username, password):
        return user if (username, password) == ("admin", "ok") else None

    monkeypatch.setattr(auth_router, "authenticate_user", fake_auth)
    r = await client.post("/api/v1/auth/login", json={"username": "admin", "password": "ok"})

    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["role"] == "ADMIN"


async def test_login_wrong_credentials(client, monkeypatch):
    async def fake_auth(*_):
        return None

    monkeypatch.setattr(auth_router, "authenticate_user", fake_auth)
    r = await client.post("/api/v1/auth/login", json={"username": "x", "password": "y"})
    assert r.status_code == 401


async def test_me_requires_token(client):
    assert (await client.get("/api/v1/auth/me")).status_code == 401


async def test_me_rejects_garbage_token(client):
    r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer basura"})
    assert r.status_code == 401


async def test_me_returns_profile(client, login_as):
    headers = login_as(UserRole.AUDITOR_CLINICO, username="ana")
    r = await client.get("/api/v1/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["username"] == "ana"


async def test_inactive_user_is_rejected(client, login_as):
    headers = login_as(UserRole.ADMIN, active=False)
    # login_as parchea get_user_by_username; el usuario inactivo debe ser rechazado igualmente
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401


async def test_logout_revokes_current_token(client, login_as, monkeypatch):
    headers = login_as(UserRole.ADMIN)
    revoked = []

    async def fake_revoke(_db, jti, expires_at):
        revoked.append((jti, expires_at))

    monkeypatch.setattr(auth_router, "revoke_token", fake_revoke)
    r = await client.post("/api/v1/auth/logout", headers=headers)

    assert r.status_code == 204
    assert len(revoked) == 1
    jti, expires_at = revoked[0]
    assert jti
    assert expires_at > datetime.now(timezone.utc)


async def test_revoked_token_is_rejected(client, login_as, monkeypatch):
    headers = login_as(UserRole.ADMIN)

    async def always_revoked(_db, _jti):
        return True

    monkeypatch.setattr("app.features.auth.dependencies.is_token_revoked", always_revoked)
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401


async def test_logout_requires_token(client):
    assert (await client.post("/api/v1/auth/logout")).status_code == 401


async def test_token_without_jti_still_valid(client, monkeypatch):
    """Los tokens emitidos antes del logout (sin jti) siguen funcionando hasta expirar."""
    user = make_user(UserRole.ADMIN)

    async def fake_get_user(_db, _username):
        return user

    monkeypatch.setattr("app.features.auth.dependencies.get_user_by_username", fake_get_user)
    token = jwt.encode(
        {"sub": user.username, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200


async def test_users_management_is_role_restricted(client, login_as):
    headers = login_as(UserRole.AUDITOR_CLINICO)
    assert (await client.get("/api/v1/users", headers=headers)).status_code == 403
    assert (await client.post("/api/v1/users", json={}, headers=headers)).status_code == 403
