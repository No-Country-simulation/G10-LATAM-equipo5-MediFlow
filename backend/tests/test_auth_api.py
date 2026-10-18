from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt

from app.core.config import settings
from app.core.security import create_access_token
from app.features.auth import dependencies as auth_dependencies
from app.features.auth import router as auth_router
from app.features.auth.enums import UserRole
from tests.conftest import make_area, make_queue, make_user


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


# --- Refresh token ---


def _refresh_token_for(username: str, **kwargs) -> str:
    from app.core.security import create_refresh_token

    return create_refresh_token({"sub": username}, **kwargs)


def _patch_refresh(monkeypatch, user, consumed: list | None = None, already_used: bool = False):
    async def fake_get_user(_db, _username):
        return user

    async def fake_consume(_db, jti, expires_at):
        if consumed is not None:
            consumed.append((jti, expires_at))
        return not already_used

    monkeypatch.setattr(auth_router, "get_user_by_username", fake_get_user)
    monkeypatch.setattr(auth_router, "consume_refresh_token", fake_consume)


async def test_login_returns_refresh_token(client, monkeypatch):
    user = make_user(UserRole.ADMIN, username="admin")

    async def fake_auth(*_):
        return user

    monkeypatch.setattr(auth_router, "authenticate_user", fake_auth)
    body = (await client.post("/api/v1/auth/login", json={"username": "admin", "password": "ok"})).json()

    refresh = jwt.decode(body["refresh_token"], settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    access = jwt.decode(body["access_token"], settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert refresh["type"] == "refresh"
    assert access["type"] == "access"
    assert refresh["exp"] > access["exp"]


async def test_refresh_rotates_tokens(client, monkeypatch):
    user = make_user(UserRole.AUDITOR_CLINICO, username="ana")
    consumed = []
    _patch_refresh(monkeypatch, user, consumed)
    old_refresh = _refresh_token_for("ana")

    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})

    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] and body["refresh_token"] != old_refresh
    assert body["user"]["username"] == "ana"
    old_jti = jwt.decode(old_refresh, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])["jti"]
    assert consumed[0][0] == old_jti


async def test_refresh_rejects_reused_token(client, monkeypatch):
    _patch_refresh(monkeypatch, make_user(UserRole.ADMIN), already_used=True)
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": _refresh_token_for("tester")})
    assert r.status_code == 401


async def test_refresh_rejects_access_token(client, monkeypatch):
    consumed = []
    _patch_refresh(monkeypatch, make_user(UserRole.ADMIN), consumed)
    access = create_access_token({"sub": "tester"})
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": access})
    assert r.status_code == 401
    assert consumed == []


async def test_refresh_rejects_expired_token(client, monkeypatch):
    _patch_refresh(monkeypatch, make_user(UserRole.ADMIN))
    expired = _refresh_token_for("tester", expires_delta=timedelta(seconds=-1))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": expired})
    assert r.status_code == 401


async def test_refresh_rejects_inactive_user(client, monkeypatch):
    _patch_refresh(monkeypatch, make_user(UserRole.ADMIN, active=False))
    r = await client.post("/api/v1/auth/refresh", json={"refresh_token": _refresh_token_for("tester")})
    assert r.status_code == 401


async def test_refresh_token_cannot_authorize_requests(client, login_as):
    login_as(UserRole.ADMIN)  # parchea el usuario y la revocación
    headers = {"Authorization": f"Bearer {_refresh_token_for('tester')}"}
    assert (await client.get("/api/v1/auth/me", headers=headers)).status_code == 401


async def test_logout_also_revokes_refresh_token(client, login_as, monkeypatch):
    headers = login_as(UserRole.ADMIN)  # usuario "tester"
    revoked = []

    async def fake_revoke(_db, jti, expires_at):
        revoked.append(jti)

    monkeypatch.setattr(auth_router, "revoke_token", fake_revoke)
    own = _refresh_token_for("tester")
    r = await client.post("/api/v1/auth/logout", headers=headers, json={"refresh_token": own})

    assert r.status_code == 204
    own_jti = jwt.decode(own, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])["jti"]
    assert len(revoked) == 2 and revoked[1] == own_jti


async def test_logout_ignores_refresh_token_of_other_user(client, login_as, monkeypatch):
    headers = login_as(UserRole.ADMIN)
    revoked = []

    async def fake_revoke(_db, jti, expires_at):
        revoked.append(jti)

    monkeypatch.setattr(auth_router, "revoke_token", fake_revoke)
    other = _refresh_token_for("otro")
    r = await client.post("/api/v1/auth/logout", headers=headers, json={"refresh_token": other})

    assert r.status_code == 204
    assert len(revoked) == 1  # solo el access token propio


# --- Área del usuario ---


def _new_user_body(**overrides) -> dict:
    body = {
        "username": "nuevo",
        "email": "nuevo@mediflow.cl",
        "password": "password123",
        "full_name": "Usuario Nuevo",
        "role": "OPERADOR",
        "area_id": str(uuid4()),
    }
    body.update(overrides)
    return body


async def test_me_includes_area(client, login_as):
    headers = login_as(UserRole.OPERADOR, area=make_area("URGENCIAS", "Urgencias"))
    r = await client.get("/api/v1/auth/me", headers=headers)
    assert r.json()["area"]["codigo"] == "URGENCIAS"


async def test_create_user_requires_area(client, login_as):
    headers = login_as(UserRole.ADMIN)
    body = _new_user_body()
    del body["area_id"]
    assert (await client.post("/api/v1/users", json=body, headers=headers)).status_code == 422


async def test_create_user_with_area(client, login_as, db):
    area = make_area()
    db.get_result = area
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.post("/api/v1/users", json=_new_user_body(area_id=str(area.id)), headers=headers)

    assert r.status_code == 201
    assert r.json()["area"] == {"id": str(area.id), "codigo": "ADMISION", "nombre": "Admisión y Recepción"}
    assert db.added[0].area is area


async def test_create_user_rejects_missing_or_inactive_area(client, login_as, db):
    headers = login_as(UserRole.ADMIN)
    r = await client.post("/api/v1/users", json=_new_user_body(), headers=headers)
    assert r.status_code == 422
    assert r.json()["detail"] == "El área indicada no existe o está inactiva"

    db.get_result = make_area(is_active=False)
    r = await client.post("/api/v1/users", json=_new_user_body(), headers=headers)
    assert r.status_code == 422
    assert db.added == []


async def test_admin_can_change_user_area(client, login_as, db):
    user = make_user(UserRole.OPERADOR, username="op", area=make_area())
    nueva = make_area("URGENCIAS", "Urgencias")
    db.queue(user)
    db.get_result = nueva
    headers = login_as(UserRole.ADMIN)
    r = await client.patch(f"/api/v1/users/{user.id}", json={"area_id": str(nueva.id)}, headers=headers)

    assert r.status_code == 200
    assert r.json()["area"]["codigo"] == "URGENCIAS"
    assert user.area is nueva


async def test_admin_cannot_assign_inactive_area(client, login_as, db):
    user = make_user(UserRole.OPERADOR, username="op", area=make_area())
    db.queue(user)
    db.get_result = make_area("URGENCIAS", "Urgencias", is_active=False)
    headers = login_as(UserRole.ADMIN)
    r = await client.patch(f"/api/v1/users/{user.id}", json={"area_id": str(uuid4())}, headers=headers)

    assert r.status_code == 422
    assert user.area.codigo == "ADMISION"


# --- Eliminación de usuarios (Smart Delete) ---


async def test_delete_user_without_activity_is_hard_delete(client, login_as, db):
    target = make_user(UserRole.OPERADOR, username="op")
    db.queue(target, 0, 0)  # usuario, documentos y cambios de catálogos
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.delete(f"/api/v1/users/{target.id}", headers=headers)

    assert r.status_code == 200
    assert r.json()["deletion_type"] == "HARD_DELETE"
    assert db.deleted == [target]


async def test_delete_user_with_activity_is_soft_delete(client, login_as, db):
    target = make_user(UserRole.AUDITOR_CLINICO, username="aud")
    db.queue(target, 4, 1)
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"/api/v1/users/{target.id}", headers=headers)

    assert r.json()["deletion_type"] == "SOFT_DELETE"
    assert "5 registro(s)" in r.json()["message"]
    assert target.is_active is False
    assert db.deleted == []


async def test_delete_missing_user_returns_404(client, login_as):
    headers = login_as(UserRole.ADMIN)
    assert (await client.delete(f"/api/v1/users/{uuid4()}", headers=headers)).status_code == 404


async def test_cannot_delete_own_account(client, login_as, db):
    headers = login_as(UserRole.ADMIN)
    me = await auth_dependencies.get_user_by_username(None, "tester")
    db.queue(me)
    r = await client.delete(f"/api/v1/users/{me.id}", headers=headers)
    assert r.status_code == 409
    assert db.deleted == []


async def test_gestor_cannot_delete_admin(client, login_as, db):
    db.queue(make_user(UserRole.ADMIN, username="root"))
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.delete(f"/api/v1/users/{uuid4()}", headers=headers)
    assert r.status_code == 403


async def test_delete_user_is_role_restricted(client, login_as):
    headers = login_as(UserRole.AUDITOR_CLINICO)
    assert (await client.delete(f"/api/v1/users/{uuid4()}", headers=headers)).status_code == 403


async def test_create_user_con_colas_de_triaje(client, login_as, db):
    area = make_area()
    cola = make_queue("Cola_Emergencia_Medica", "Urgencias")
    db.get_result = area
    db.queue([cola], None)
    headers = login_as(UserRole.ADMIN)
    body = _new_user_body(area_id=str(area.id), cola_ids=[str(cola.id)])
    r = await client.post("/api/v1/users", json=body, headers=headers)

    assert r.status_code == 201
    assert [c["codigo"] for c in r.json()["colas"]] == ["Cola_Emergencia_Medica"]
    assert db.added[0].colas == [cola]


async def test_create_user_rechaza_cola_inexistente_o_inactiva(client, login_as, db):
    db.get_result = make_area()
    db.queue([])
    body = _new_user_body(cola_ids=[str(uuid4())])
    r = await client.post("/api/v1/users", json=body, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 422
    assert r.json()["detail"] == "Alguna de las colas indicadas no existe o está inactiva"
    assert db.added == []


async def test_admin_reemplaza_las_colas_de_un_usuario(client, login_as, db):
    user = make_user(UserRole.AUDITOR_CLINICO, username="aud", colas=[make_queue("Cola_Oncologia", "Oncología")])
    nueva = make_queue("Gestion_Interconsultas", "Interconsultas")
    db.queue(user, [nueva])
    r = await client.patch(
        f"/api/v1/users/{user.id}", json={"cola_ids": [str(nueva.id)]}, headers=login_as(UserRole.ADMIN)
    )

    assert r.status_code == 200
    assert [c["codigo"] for c in r.json()["colas"]] == ["Gestion_Interconsultas"]

    db.queue(user)
    r = await client.patch(f"/api/v1/users/{user.id}", json={"cola_ids": []}, headers=login_as(UserRole.ADMIN))
    assert r.json()["colas"] == []


# --- Restablecer contraseña de otro usuario ---


async def test_gestor_restablece_la_contrasena_de_otro_usuario(client, login_as, db):
    from app.core.security import verify_password

    target = make_user(UserRole.OPERADOR, username="op")
    db.queue(target)
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.post(
        f"/api/v1/users/{target.id}/reset-password", json={"new_password": "NuevaClave123"}, headers=headers
    )

    assert r.status_code == 204
    assert verify_password("NuevaClave123", target.hashed_password)


async def test_reset_password_exige_largo_minimo(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.post(f"/api/v1/users/{uuid4()}/reset-password", json={"new_password": "corta"}, headers=headers)
    assert r.status_code == 422


async def test_no_se_restablece_la_propia_contrasena(client, login_as, db):
    headers = login_as(UserRole.ADMIN)
    me = await auth_dependencies.get_user_by_username(None, "tester")
    original_hash = me.hashed_password
    db.queue(me)
    r = await client.post(
        f"/api/v1/users/{me.id}/reset-password", json={"new_password": "NuevaClave123"}, headers=headers
    )

    assert r.status_code == 409
    assert me.hashed_password == original_hash


async def test_gestor_no_restablece_la_contrasena_de_un_admin(client, login_as, db):
    admin = make_user(UserRole.ADMIN, username="root")
    original_hash = admin.hashed_password
    db.queue(admin)
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.post(
        f"/api/v1/users/{admin.id}/reset-password", json={"new_password": "NuevaClave123"}, headers=headers
    )

    assert r.status_code == 403
    assert admin.hashed_password == original_hash


async def test_reset_password_es_restringido_por_rol(client, login_as):
    headers = login_as(UserRole.OPERADOR)
    r = await client.post(
        f"/api/v1/users/{uuid4()}/reset-password", json={"new_password": "NuevaClave123"}, headers=headers
    )
    assert r.status_code == 403
