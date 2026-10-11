from uuid import uuid4

from app.features.auth.enums import UserRole
from app.features.catalogs.models import CatalogHistory
from tests.conftest import make_area

AREAS_URL = "/api/v1/catalogs/areas"
AREA_BODY = {"codigo": "KINESIOLOGIA", "nombre": "Kinesiología", "descripcion": "Rehabilitación"}


# --- Lectura -----------------------------------------------------------------


async def test_areas_require_token(client):
    assert (await client.get(f"{AREAS_URL}/active")).status_code == 401


async def test_active_areas_returns_compact_dto(client, login_as, db):
    area = make_area()
    db.queue([area])
    headers = login_as(UserRole.OPERADOR)
    r = await client.get(f"{AREAS_URL}/active", headers=headers)

    assert r.status_code == 200
    assert r.json() == [{"id": str(area.id), "codigo": "ADMISION", "nombre": "Admisión y Recepción"}]


async def test_list_areas_returns_full_dto(client, login_as, db):
    db.queue([make_area(), make_area("URGENCIAS", "Urgencias", is_active=False)])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get(AREAS_URL, headers=headers)

    assert r.status_code == 200
    assert [(a["codigo"], a["is_active"]) for a in r.json()] == [
        ("ADMISION", True),
        ("URGENCIAS", False),
    ]


async def test_get_missing_area_returns_404(client, login_as):
    headers = login_as(UserRole.ADMIN)
    assert (await client.get(f"{AREAS_URL}/{uuid4()}", headers=headers)).status_code == 404


# --- Escritura y permisos ----------------------------------------------------


async def test_write_endpoints_forbidden_for_clinical_roles(client, login_as):
    area_url = f"{AREAS_URL}/{uuid4()}"
    for role in (UserRole.AUDITOR_CLINICO, UserRole.OPERADOR):
        headers = login_as(role)
        assert (await client.post(AREAS_URL, json=AREA_BODY, headers=headers)).status_code == 403
        assert (await client.put(area_url, json={"nombre": "X"}, headers=headers)).status_code == 403
        assert (await client.delete(area_url, headers=headers)).status_code == 403
        assert (await client.get(f"{area_url}/history", headers=headers)).status_code == 403


async def test_gestor_usuarios_can_create_area_and_history_is_recorded(client, login_as, db):
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.post(AREAS_URL, json=AREA_BODY, headers=headers)

    assert r.status_code == 201
    assert r.json()["codigo"] == "KINESIOLOGIA"
    assert r.json()["is_active"] is True
    history = next(obj for obj in db.added if isinstance(obj, CatalogHistory))
    assert history.catalogo == "AREA"
    assert history.accion == "CREATE"


async def test_area_codigo_must_be_uppercase(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.post(AREAS_URL, json={**AREA_BODY, "codigo": "kinesiologia"}, headers=headers)
    assert r.status_code == 422


async def test_update_area_rejects_null_nombre(client, login_as, db):
    db.get_result = make_area()
    headers = login_as(UserRole.ADMIN)
    r = await client.put(f"{AREAS_URL}/{uuid4()}", json={"nombre": None}, headers=headers)
    assert r.status_code == 422


async def test_update_area_applies_only_sent_fields(client, login_as, db):
    area = make_area()
    db.get_result = area
    headers = login_as(UserRole.ADMIN)
    r = await client.put(f"{AREAS_URL}/{area.id}", json={"nombre": "Admisión Central"}, headers=headers)

    assert r.status_code == 200
    assert r.json()["nombre"] == "Admisión Central"
    assert r.json()["codigo"] == "ADMISION"


# --- Smart Delete ------------------------------------------------------------


async def test_delete_unused_area_is_hard_delete(client, login_as, db):
    area = make_area()
    db.get_result = area
    db.queue(0, 0)  # usuarios y documentos que la usan
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"{AREAS_URL}/{area.id}", headers=headers)

    assert r.status_code == 200
    assert r.json()["deletion_type"] == "HARD_DELETE"
    assert db.deleted == [area]


async def test_delete_area_with_users_and_documents_is_soft_delete(client, login_as, db):
    area = make_area()
    db.get_result = area
    db.queue(3, 7)
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.delete(f"{AREAS_URL}/{area.id}", headers=headers)

    assert r.status_code == 200
    body = r.json()
    assert body["deletion_type"] == "SOFT_DELETE"
    assert "3 usuario(s) y 7 documento(s) clínico(s)" in body["message"]
    assert area.is_active is False
    assert db.deleted == []


async def test_delete_area_with_only_documents_reports_documents(client, login_as, db):
    db.get_result = make_area()
    db.queue(0, 2)
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"{AREAS_URL}/{uuid4()}", headers=headers)

    assert r.json()["deletion_type"] == "SOFT_DELETE"
    assert "tiene 2 documento(s) clínico(s) asociado(s)" in r.json()["message"]


async def test_area_history_lists_changes(client, login_as, db):
    area_id = uuid4()
    db.queue(
        [
            CatalogHistory(
                catalogo="AREA",
                registro_id=area_id,
                codigo="ADMISION",
                accion="UPDATE",
                cambios={"nombre": {"antes": "A", "despues": "B"}},
                changed_by_id=None,
                changed_at=make_area().created_at,
            )
        ]
    )
    headers = login_as(UserRole.ADMIN)
    r = await client.get(f"{AREAS_URL}/{area_id}/history", headers=headers)

    assert r.status_code == 200
    assert r.json()[0]["accion"] == "UPDATE"