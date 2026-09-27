from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.features.auth.enums import UserRole
from app.features.catalogs.models import DocumentType, RoutingQueue


def make_queue(**overrides) -> RoutingQueue:
    fields = {
        "id": uuid4(),
        "codigo": "Cola_Emergencia_Medica",
        "nombre": "Emergencia Médica",
        "descripcion_semantica": "Hallazgos críticos que requieren atención inmediata",
        "notificar_inmediato": True,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    fields.update(overrides)
    return RoutingQueue(**fields)


def make_doc_type(**overrides) -> DocumentType:
    fields = {
        "id": uuid4(),
        "codigo": "RECETA",
        "nombre": "Receta",
        "descripcion": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    fields.update(overrides)
    return DocumentType(**fields)


QUEUE_BODY = {
    "codigo": "Farmacia_Hospitalaria",
    "nombre": "Farmacia",
    "descripcion_semantica": "Recetas y dispensación de medicamentos",
}


# --- Control de acceso -------------------------------------------------------


async def test_active_queues_requires_token(client):
    assert (await client.get("/api/v1/catalogs/queues/active")).status_code == 401


async def test_active_queues_returns_compact_dto(client, login_as, db):
    db.queue([make_queue()])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get("/api/v1/catalogs/queues/active", headers=headers)

    assert r.status_code == 200
    assert r.json() == [
        {
            "codigo": "Cola_Emergencia_Medica",
            "nombre": "Emergencia Médica",
            "descripcion_semantica": "Hallazgos críticos que requieren atención inmediata",
        }
    ]


async def test_write_endpoints_forbidden_for_non_admin(client, login_as):
    headers = login_as(UserRole.AUDITOR_CLINICO)
    some_id = uuid4()
    calls = [
        client.post("/api/v1/catalogs/queues", json=QUEUE_BODY, headers=headers),
        client.put(f"/api/v1/catalogs/queues/{some_id}", json={}, headers=headers),
        client.delete(f"/api/v1/catalogs/queues/{some_id}", headers=headers),
        client.post(
            "/api/v1/catalogs/document-types", json={"codigo": "X", "nombre": "X"}, headers=headers
        ),
        client.put(f"/api/v1/catalogs/document-types/{some_id}", json={}, headers=headers),
        client.delete(f"/api/v1/catalogs/document-types/{some_id}", headers=headers),
    ]
    for call in calls:
        assert (await call).status_code == 403


# --- CRUD --------------------------------------------------------------------


async def test_list_queues(client, login_as, db):
    db.queue([make_queue(), make_queue(codigo="Farmacia_Hospitalaria", is_active=False)])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get("/api/v1/catalogs/queues", headers=headers)
    assert r.status_code == 200
    assert [q["codigo"] for q in r.json()] == ["Cola_Emergencia_Medica", "Farmacia_Hospitalaria"]


async def test_create_queue(client, login_as, db):
    headers = login_as(UserRole.ADMIN)
    r = await client.post("/api/v1/catalogs/queues", json=QUEUE_BODY, headers=headers)

    assert r.status_code == 201
    assert r.json()["codigo"] == "Farmacia_Hospitalaria"
    assert r.json()["notificar_inmediato"] is False
    assert len(db.added) == 1 and db.commits == 1


async def test_create_queue_duplicate_codigo_returns_409(client, login_as, db):
    db.fail_commit = IntegrityError("INSERT", {}, Exception("duplicate key"))
    headers = login_as(UserRole.ADMIN)
    r = await client.post("/api/v1/catalogs/queues", json=QUEUE_BODY, headers=headers)
    assert r.status_code == 409
    assert db.rollbacks == 1


async def test_update_queue_applies_only_sent_fields(client, login_as, db):
    queue = make_queue()
    db.get_result = queue
    headers = login_as(UserRole.ADMIN)
    r = await client.put(
        f"/api/v1/catalogs/queues/{queue.id}", json={"is_active": False}, headers=headers
    )

    assert r.status_code == 200
    assert queue.is_active is False
    assert queue.nombre == "Emergencia Médica"


async def test_update_missing_queue_returns_404(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.put(f"/api/v1/catalogs/queues/{uuid4()}", json={}, headers=headers)
    assert r.status_code == 404


# --- Smart Delete ------------------------------------------------------------


async def test_delete_unused_queue_is_hard_delete(client, login_as, db):
    queue = make_queue()
    db.get_result = queue
    db.queue(0)
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"/api/v1/catalogs/queues/{queue.id}", headers=headers)

    assert r.status_code == 200
    assert r.json()["deletion_type"] == "HARD_DELETE"
    assert db.deleted == [queue]
    assert db.commits == 1


async def test_delete_used_queue_is_soft_delete(client, login_as, db):
    queue = make_queue()
    db.get_result = queue
    db.queue(3)
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"/api/v1/catalogs/queues/{queue.id}", headers=headers)

    assert r.status_code == 200
    assert r.json()["deletion_type"] == "SOFT_DELETE"
    assert db.deleted == []
    assert queue.is_active is False
    assert db.commits == 1


async def test_delete_missing_queue_returns_404(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"/api/v1/catalogs/queues/{uuid4()}", headers=headers)
    assert r.status_code == 404


async def test_delete_used_document_type_is_soft_delete(client, login_as, db):
    doc_type = make_doc_type()
    db.get_result = doc_type
    db.queue(1)
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"/api/v1/catalogs/document-types/{doc_type.id}", headers=headers)

    assert r.status_code == 200
    assert r.json()["deletion_type"] == "SOFT_DELETE"
    assert doc_type.is_active is False


async def test_delete_unused_document_type_is_hard_delete(client, login_as, db):
    doc_type = make_doc_type()
    db.get_result = doc_type
    db.queue(0)
    headers = login_as(UserRole.ADMIN)
    r = await client.delete(f"/api/v1/catalogs/document-types/{doc_type.id}", headers=headers)

    assert r.status_code == 200
    assert r.json()["deletion_type"] == "HARD_DELETE"
    assert db.deleted == [doc_type]


# --- Lectura por id, listados activos y reactivación ------------------------


async def test_get_queue_by_id(client, login_as, db):
    queue = make_queue()
    db.get_result = queue
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get(f"/api/v1/catalogs/queues/{queue.id}", headers=headers)
    assert r.status_code == 200
    assert r.json()["codigo"] == "Cola_Emergencia_Medica"


async def test_get_missing_document_type_returns_404(client, login_as):
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get(f"/api/v1/catalogs/document-types/{uuid4()}", headers=headers)
    assert r.status_code == 404


async def test_active_routes_are_not_parsed_as_ids(client, login_as, db):
    db.queue([], [])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    assert (await client.get("/api/v1/catalogs/queues/active", headers=headers)).status_code == 200
    r = await client.get("/api/v1/catalogs/document-types/active", headers=headers)
    assert r.status_code == 200


async def test_active_document_types_returns_compact_dto(client, login_as, db):
    db.queue([make_doc_type()])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get("/api/v1/catalogs/document-types/active", headers=headers)

    assert r.status_code == 200
    assert r.json() == [{"codigo": "RECETA", "nombre": "Receta", "descripcion": None}]


async def test_create_document_type(client, login_as, db):
    headers = login_as(UserRole.ADMIN)
    r = await client.post(
        "/api/v1/catalogs/document-types",
        json={"codigo": "LICENCIA", "nombre": "Licencia Médica"},
        headers=headers,
    )
    assert r.status_code == 201
    assert r.json()["is_active"] is True
    assert r.json()["descripcion"] is None


async def test_update_document_type_can_reactivate(client, login_as, db):
    doc_type = make_doc_type(is_active=False)
    db.get_result = doc_type
    headers = login_as(UserRole.ADMIN)
    r = await client.put(
        f"/api/v1/catalogs/document-types/{doc_type.id}",
        json={"is_active": True, "descripcion": "Prescripción de medicamentos"},
        headers=headers,
    )
    assert r.status_code == 200
    assert doc_type.is_active is True
    assert r.json()["descripcion"] == "Prescripción de medicamentos"
