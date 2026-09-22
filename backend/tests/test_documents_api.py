from datetime import datetime, timezone
from decimal import Decimal

from app.features.auth.enums import UserRole
from app.features.documents.models import ClinicalDocument
from tests.conftest import ingest_body


async def test_ingest_requires_token(client):
    r = await client.post("/api/v1/documents/ingest", json=ingest_body())
    assert r.status_code == 401


async def test_ingest_forbidden_for_gestor_usuarios(client, login_as):
    headers = login_as(UserRole.GESTOR_USUARIOS)
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=headers)
    assert r.status_code == 403


async def test_ingest_returns_full_json_for_react(client, login_as, db, oci):
    db.queue(None)
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=headers)

    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "procesado"
    assert data["documento_id"] == "DOC-TEST-1"
    assert data["clasificacion"]["nivel_prioridad"] == "Urgente"
    assert data["datos_extraidos"]["medico_solicitante"]["rut"] == "9.876.543-2"
    assert data["datos_extraidos"]["estudio_realizado"] == "Tomografia de Torax"
    assert data["decision_enrutamiento"]["notificacion_generada"]["canal"] == "Alerta_Guardia_Medica"
    assert data["almacenamiento_oci"] == {
        "bucket": "test-bucket",
        "ruta_objeto": "procesados/urgente/DOC-TEST-1.json",
        "status_backup": "exito",
    }


async def test_ingest_low_confidence_reports_pendiente_auditoria(client, login_as, db, oci):
    db.queue(None)
    headers = login_as(UserRole.ADMIN)
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(score=0.5), headers=headers)
    assert r.status_code == 201
    assert r.json()["status"] == "pendiente_auditoria"
    assert r.json()["almacenamiento_oci"]["ruta_objeto"] == "auditoria_humana/DOC-TEST-1.json"


async def test_ingest_invalid_base64_returns_400(client, login_as, oci):
    headers = login_as(UserRole.ADMIN)
    body = ingest_body(archivo_base64="###")
    r = await client.post("/api/v1/documents/ingest", json=body, headers=headers)
    assert r.status_code == 400


async def test_ingest_oci_failure_returns_500(client, login_as, db, oci):
    db.queue(None)
    oci.fail_on = "recibidos"
    headers = login_as(UserRole.ADMIN)
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=headers)
    assert r.status_code == 500


def _document(**kwargs) -> ClinicalDocument:
    fields = dict(
        documento_id="DOC-1",
        estado="PROCESADO",
        rut_paciente="1-9",
        nombre_paciente="Ana",
        tipo_documento="Receta",
        nivel_prioridad="Rutina",
        score_confianza=Decimal("0.900"),
        destino_enrutamiento="Farmacia_Hospitalaria",
        oci_json_path="procesados/rutina/DOC-1.json",
        created_at=datetime.now(timezone.utc),
    )
    fields.update(kwargs)
    return ClinicalDocument(**fields)


async def test_list_documents_paginates(client, login_as, db):
    db.queue(45, [_document(), _document(documento_id="DOC-2")])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get("/api/v1/documents?page=1&page_size=20", headers=headers)

    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 45
    assert data["total_pages"] == 3
    assert [i["documento_id"] for i in data["items"]] == ["DOC-1", "DOC-2"]
    assert data["message"] is None


async def test_list_documents_empty_has_message(client, login_as, db):
    db.queue(0, [])
    headers = login_as(UserRole.ADMIN)
    r = await client.get("/api/v1/documents?estado=AUDITADO", headers=headers)
    assert r.json()["items"] == []
    assert r.json()["message"] == "No hay documentos con los filtros utilizados"


async def test_list_documents_rejects_bad_page_size(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.get("/api/v1/documents?page_size=500", headers=headers)
    assert r.status_code == 422
