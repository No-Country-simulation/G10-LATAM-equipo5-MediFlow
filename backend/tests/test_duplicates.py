"""Detección de duplicados: consulta previa por huella, marcado al ingerir y detalle."""

import base64
import hashlib
from datetime import date, datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.features.auth.enums import UserRole
from app.features.documents.duplicates import (
    MOTIVO_ARCHIVO_IDENTICO,
    MOTIVO_CONTENIDO_SIMILAR,
    _coincide_contenido,
    _documentos_similares,
    huella,
)
from app.features.documents.schemas import DatosGeneralesExtract
from tests.conftest import FakeSession, ingest_body, queue_ingest
from tests.test_document_correction_api import _procesado

CHECK_URL = "/api/v1/documents/duplicates/check"
HUELLA = hashlib.sha256(b"contenido").hexdigest()
CREADO = datetime(2026, 10, 1, 9, 30, tzinfo=timezone.utc)


def _fila(documento_id="DOC-ORIGINAL", uploaded_by_id=None, area="Urgencias"):
    """Fila de la consulta por huella: (sha256, documento_id, estado, created_at, uploaded_by_id, área)."""
    return (HUELLA, documento_id, "PROCESADO", CREADO, uploaded_by_id, area)


def _similar(documento_id="DOC-ORIGINAL", institucion="Hospital Demo", cie10=None, diagnostico=None):
    return SimpleNamespace(
        documento_id=documento_id,
        institucion_emisora=institucion,
        cie10_sugerido=cie10,
        diagnostico_principal=diagnostico,
    )


# --- Huella ------------------------------------------------------------------


def test_huella_is_sha256_hex():
    assert huella(b"contenido") == HUELLA
    assert len(HUELLA) == 64


# --- Consulta previa (POST /documents/duplicates/check) ----------------------


async def test_check_requires_document_role(client, login_as):
    r = await client.post(CHECK_URL, json={"sha256": [HUELLA]}, headers=login_as(UserRole.GESTOR_USUARIOS))
    assert r.status_code == 403


async def test_check_rejects_malformed_hashes(client, login_as):
    for cuerpo in ({"sha256": []}, {"sha256": ["no-es-un-hash"]}, {"sha256": [HUELLA.upper()]}):
        r = await client.post(CHECK_URL, json=cuerpo, headers=login_as(UserRole.ADMIN))
        assert r.status_code == 422


async def test_check_without_matches(client, login_as, db):
    db.queue([])
    r = await client.post(CHECK_URL, json={"sha256": [HUELLA]}, headers=login_as(UserRole.ADMIN))
    assert r.status_code == 200
    assert r.json() == {"coincidencias": []}


async def test_check_shows_document_to_auditor(client, login_as, db):
    db.queue([_fila(uploaded_by_id=uuid4())])
    r = await client.post(CHECK_URL, json={"sha256": [HUELLA]}, headers=login_as(UserRole.AUDITOR_CLINICO))

    [coincidencia] = r.json()["coincidencias"]
    assert coincidencia["documento_id"] == "DOC-ORIGINAL"
    assert coincidencia["estado"] == "PROCESADO"
    assert coincidencia["area_origen"] == "Urgencias"
    assert coincidencia["propio"] is False


async def test_check_hides_other_users_document_from_operador(client, login_as, db):
    """Al OPERADOR se le avisa, pero de un documento ajeno solo se informa el área y la fecha."""
    headers = login_as(UserRole.OPERADOR)
    db.queue([_fila(uploaded_by_id=uuid4())])
    r = await client.post(CHECK_URL, json={"sha256": [HUELLA]}, headers=headers)

    [coincidencia] = r.json()["coincidencias"]
    assert coincidencia["documento_id"] is None
    assert coincidencia["estado"] is None
    assert coincidencia["area_origen"] == "Urgencias"
    assert coincidencia["created_at"].startswith("2026-10-01")


async def test_check_shows_own_document_to_operador(client, login_as, db):
    operador_id = uuid4()
    headers = login_as(UserRole.OPERADOR, id=operador_id)
    db.queue([_fila(uploaded_by_id=operador_id)])
    r = await client.post(CHECK_URL, json={"sha256": [HUELLA]}, headers=headers)

    [coincidencia] = r.json()["coincidencias"]
    assert (coincidencia["documento_id"], coincidencia["propio"]) == ("DOC-ORIGINAL", True)


# --- Ingesta -----------------------------------------------------------------


async def test_ingest_stores_file_hash_and_flags_identical_file(client, login_as, db, oci):
    queue_ingest(db)
    db.queue(["DOC-ORIGINAL"], [])  # documentos con la misma huella; similares
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=login_as(UserRole.ADMIN))

    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "PENDIENTE_AUDITORIA"
    assert MOTIVO_ARCHIVO_IDENTICO in data["motivos_auditoria"]
    [documento] = [o for o in db.added if hasattr(o, "attachments")]
    assert documento.attachments[0].sha256 == HUELLA
    assert documento.raw_extracted_json["triaje"]["duplicados"] == [
        {"documento_id": "DOC-ORIGINAL", "tipo": "ARCHIVO_IDENTICO"}
    ]


async def test_ingest_flags_similar_content(client, login_as, db, oci):
    queue_ingest(db)
    db.queue([], [_similar(institucion="  hospital DEMO ")])
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=login_as(UserRole.ADMIN))

    data = r.json()
    assert data["status"] == "PENDIENTE_AUDITORIA"
    assert data["motivos_auditoria"] == [MOTIVO_CONTENIDO_SIMILAR]
    [documento] = [o for o in db.added if hasattr(o, "attachments")]
    assert documento.raw_extracted_json["triaje"]["duplicados"] == [
        {"documento_id": "DOC-ORIGINAL", "tipo": "CONTENIDO_SIMILAR"}
    ]


async def test_ingest_ignores_same_patient_and_date_with_different_content(client, login_as, db, oci):
    queue_ingest(db)
    db.queue([], [_similar(institucion="Clínica Otra", cie10="J45.9", diagnostico="Asma")])
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=login_as(UserRole.ADMIN))

    assert r.json()["status"] == "PROCESADO"
    assert r.json()["motivos_auditoria"] == []


async def test_identical_file_is_not_reported_twice_as_similar(client, login_as, db, oci):
    queue_ingest(db)
    db.queue(["DOC-ORIGINAL"], [_similar()])
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=login_as(UserRole.ADMIN))

    [documento] = [o for o in db.added if hasattr(o, "attachments")]
    assert documento.raw_extracted_json["triaje"]["duplicados"] == [
        {"documento_id": "DOC-ORIGINAL", "tipo": "ARCHIVO_IDENTICO"}
    ]
    assert r.json()["motivos_auditoria"] == [MOTIVO_ARCHIVO_IDENTICO]


async def test_similar_content_needs_identification_and_date():
    """Sin identificación o sin fecha la coincidencia sería débil: ni siquiera se consulta."""
    generales = ingest_body()["datos_generales"]
    sin_fecha = DatosGeneralesExtract.model_validate({**generales, "fecha_documento": None})
    sin_identificacion = DatosGeneralesExtract.model_validate(
        {**generales, "paciente": {**generales["paciente"], "identificacion": None}}
    )
    for datos in (sin_fecha, sin_identificacion):
        db = FakeSession()
        db.queue([_similar()])
        assert await _documentos_similares(db, datos, "LABORATORIO", "DOC-NUEVO") == []
        assert len(db.results) == 1  # la consulta no se hizo


def test_similar_content_matches_by_institution_cie10_or_diagnosis():
    datos = DatosGeneralesExtract.model_validate(
        {
            "paciente": {"nombre": "Ana"},
            "institucion_emisora": "Hospital Demo",
            "fecha_documento": date(2026, 3, 10).isoformat(),
            "diagnosticos": [{"descripcion": "TEP agudo", "cie10": "I26.9", "tipo": "PRINCIPAL"}],
        }
    )
    assert _coincide_contenido(_similar(institucion="HOSPITAL  demo"), datos)
    assert _coincide_contenido(_similar(institucion=None, cie10="I26.9"), datos)
    assert _coincide_contenido(_similar(institucion=None, diagnostico="tep agudo"), datos)
    assert not _coincide_contenido(_similar(institucion=None), datos)


# --- Detalle -----------------------------------------------------------------


def _con_duplicados():
    doc = _procesado()
    doc.raw_extracted_json["triaje"]["duplicados"] = [
        {"documento_id": "DOC-PROPIO", "tipo": "ARCHIVO_IDENTICO"},
        {"documento_id": "DOC-AJENO", "tipo": "CONTENIDO_SIMILAR"},
    ]
    return doc


async def test_detail_lists_duplicates(client, login_as, db, oci):
    db.queue(_con_duplicados())
    r = await client.get("/api/v1/documents/DOC-A", headers=login_as(UserRole.AUDITOR_CLINICO))

    assert [d["documento_id"] for d in r.json()["duplicados"]] == ["DOC-PROPIO", "DOC-AJENO"]


async def test_detail_shows_operador_only_their_duplicates(client, login_as, db, oci):
    db.queue(_con_duplicados(), ["DOC-PROPIO"])
    r = await client.get("/api/v1/documents/DOC-A", headers=login_as(UserRole.OPERADOR))

    assert r.json()["duplicados"] == [{"documento_id": "DOC-PROPIO", "tipo": "ARCHIVO_IDENTICO"}]


def test_base64_of_test_file_matches_hash():
    """Sanidad del fixture: el archivo de `ingest_body` es el que produce HUELLA."""
    archivo = ingest_body()["archivos"][0]["archivo_base64"]
    assert huella(base64.b64decode(archivo)) == HUELLA
