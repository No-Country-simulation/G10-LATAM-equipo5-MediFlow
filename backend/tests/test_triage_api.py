import json
from datetime import datetime, timezone
from decimal import Decimal

from app.features.auth.enums import UserRole
from app.features.documents.models import ClinicalDocument
from tests.conftest import make_queue

URGENCIAS = "Cola_Emergencia_Medica"
ONCOLOGIA = "Cola_Oncologia"


def _document(**kwargs) -> ClinicalDocument:
    fields = dict(
        documento_id="DOC-1",
        estado="PROCESADO",
        identificacion_paciente="1-9",
        nombre_paciente="Ana",
        tipo_documento="INTERCONSULTA",
        nivel_prioridad="Urgente",
        score_confianza=Decimal("0.950"),
        destino_enrutamiento=URGENCIAS,
        oci_json_path="procesados/urgente/DOC-1.json",
        raw_extracted_json={"decision_enrutamiento": {"destino_principal": URGENCIAS}},
        created_at=datetime.now(timezone.utc),
    )
    fields.update(kwargs)
    return ClinicalDocument(**fields)


def _auditor(login_as, *codigos, username="ana"):
    return login_as(UserRole.AUDITOR_CLINICO, username=username, colas=[make_queue(c, c) for c in codigos])


def _capturar_sentencias(db) -> list:
    sentencias = []
    original = db.execute

    async def execute(stmt, *args, **kwargs):
        sentencias.append(stmt)
        return await original(stmt, *args, **kwargs)

    db.execute = execute
    return sentencias


def _sql(stmt) -> str:
    return str(stmt.compile(compile_kwargs={"literal_binds": True}))


# --- Consola ------------------------------------------------------------------


async def test_admin_ve_todas_las_colas_asistenciales(client, login_as, db):
    db.queue([make_queue(URGENCIAS, "Urgencias"), make_queue(ONCOLOGIA, "Oncología")], [_document()])
    r = await client.get("/api/v1/documents/triage", headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    assert [c["codigo"] for c in r.json()["colas"]] == [URGENCIAS, ONCOLOGIA]
    assert [d["documento_id"] for d in r.json()["items"]] == ["DOC-1"]


async def test_auditor_solo_ve_sus_colas_asistenciales(client, login_as, db):
    sentencias = _capturar_sentencias(db)
    db.queue([_document()])
    farmacia = make_queue("Farmacia_Hospitalaria", "Farmacia", es_asistencial=False)
    headers = login_as(UserRole.AUDITOR_CLINICO, colas=[make_queue(URGENCIAS, "Urgencias"), farmacia])
    r = await client.get("/api/v1/documents/triage", headers=headers)

    assert r.status_code == 200
    assert [c["codigo"] for c in r.json()["colas"]] == [URGENCIAS]
    sql = _sql(sentencias[0])
    assert f"clinical_documents.destino_enrutamiento IN ('{URGENCIAS}')" in sql
    assert "clinical_documents.atendido_at IS NULL" in sql
    assert "clinical_documents.estado IN ('PROCESADO', 'AUDITADO')" in sql


async def test_usuario_sin_colas_ve_la_consola_vacia(client, login_as, db):
    r = await client.get("/api/v1/documents/triage", headers=login_as(UserRole.OPERADOR))
    assert r.status_code == 200
    assert r.json() == {"colas": [], "items": []}


# --- Atendido -----------------------------------------------------------------


async def test_marcar_atendido_registra_quien_y_cuando(client, login_as, db):
    db.queue(_document())
    r = await client.post("/api/v1/documents/DOC-1/attend", headers=_auditor(login_as, URGENCIAS))

    assert r.status_code == 200
    assert r.json()["atendido_por_username"] == "ana"
    assert r.json()["atendido_at"] is not None
    assert r.json()["estado"] == "PROCESADO"  # no cambia el estado
    assert db.commits == 1


async def test_auditor_no_puede_marcar_casos_de_otra_cola(client, login_as, db):
    db.queue(_document())
    r = await client.post("/api/v1/documents/DOC-1/attend", headers=_auditor(login_as, ONCOLOGIA))
    assert r.status_code == 403
    assert db.commits == 0


async def test_marcar_atendido_dos_veces_conserva_el_primero(client, login_as, db):
    db.queue(_document(atendido_por_username="ana", atendido_at=datetime(2026, 10, 1, tzinfo=timezone.utc)))
    r = await client.post("/api/v1/documents/DOC-1/attend", headers=login_as(UserRole.ADMIN, username="admin"))

    assert r.status_code == 200
    assert r.json()["atendido_por_username"] == "ana"
    assert db.commits == 0


async def test_no_se_puede_atender_un_descartado_ni_pendiente(client, login_as, db):
    headers = login_as(UserRole.ADMIN)
    for estado in ("DESCARTADO", "PENDIENTE_AUDITORIA"):
        db.queue(_document(estado=estado))
        r = await client.post("/api/v1/documents/DOC-1/attend", headers=headers)
        assert r.status_code == 409


async def test_atender_documento_inexistente_404(client, login_as, db):
    db.queue(None)
    r = await client.post("/api/v1/documents/NO-EXISTE/attend", headers=login_as(UserRole.ADMIN))
    assert r.status_code == 404


async def test_operador_no_puede_marcar_atendido(client, login_as):
    r = await client.post("/api/v1/documents/DOC-1/attend", headers=login_as(UserRole.OPERADOR))
    assert r.status_code == 403


async def test_desmarcar_atendido_lo_devuelve_a_la_consola(client, login_as, db):
    db.queue(_document(atendido_por_username="ana", atendido_at=datetime.now(timezone.utc)))
    r = await client.delete("/api/v1/documents/DOC-1/attend", headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    assert r.json()["atendido_at"] is None
    assert db.commits == 1


# --- Derivar ------------------------------------------------------------------


async def test_derivar_cambia_la_cola_y_queda_en_el_historial(client, login_as, db, oci):
    doc = _document(atendido_por_username="ana", atendido_at=datetime.now(timezone.utc))
    db.queue(doc, [make_queue(URGENCIAS, "Urgencias"), make_queue(ONCOLOGIA, "Oncología")])
    r = await client.post(
        "/api/v1/documents/DOC-1/derive",
        json={"destino": ONCOLOGIA, "motivo": "  Biopsia con sospecha de malignidad  "},
        headers=_auditor(login_as, URGENCIAS),
    )

    assert r.status_code == 200
    assert r.json()["destino_enrutamiento"] == ONCOLOGIA
    assert r.json()["atendido_at"] is None  # en la nueva cola vuelve a estar activo
    entrada = doc.corrections[0]
    assert entrada.origen == "DERIVACION"
    assert entrada.justificacion == "Biopsia con sospecha de malignidad"
    assert entrada.cambios == [
        {"campo": "destino_enrutamiento", "etiqueta": "Destino", "antes": "Urgencias", "despues": "Oncología"}
    ]
    subido = json.loads(oci.uploaded["procesados/urgente/DOC-1.json"])
    assert subido["decision_enrutamiento"]["destino_principal"] == ONCOLOGIA
    assert subido["derivaciones"][0]["motivo"] == "Biopsia con sospecha de malignidad"
    assert db.commits == 1


async def test_derivar_a_la_misma_cola_422(client, login_as, db):
    db.queue(_document())
    r = await client.post(
        "/api/v1/documents/DOC-1/derive",
        json={"destino": URGENCIAS, "motivo": "Motivo suficiente"},
        headers=login_as(UserRole.ADMIN),
    )
    assert r.status_code == 422


async def test_derivar_a_cola_inactiva_422(client, login_as, db):
    db.queue(_document(), [make_queue(ONCOLOGIA, "Oncología", is_active=False)])
    r = await client.post(
        "/api/v1/documents/DOC-1/derive",
        json={"destino": ONCOLOGIA, "motivo": "Motivo suficiente"},
        headers=login_as(UserRole.ADMIN),
    )
    assert r.status_code == 422


async def test_derivar_exige_motivo(client, login_as):
    r = await client.post(
        "/api/v1/documents/DOC-1/derive",
        json={"destino": ONCOLOGIA, "motivo": "   ok "},
        headers=login_as(UserRole.ADMIN),
    )
    assert r.status_code == 422


async def test_auditor_no_puede_derivar_casos_de_otra_cola(client, login_as, db):
    db.queue(_document())
    r = await client.post(
        "/api/v1/documents/DOC-1/derive",
        json={"destino": ONCOLOGIA, "motivo": "Motivo suficiente"},
        headers=_auditor(login_as, ONCOLOGIA),
    )
    assert r.status_code == 403


async def test_operador_no_puede_derivar(client, login_as):
    r = await client.post(
        "/api/v1/documents/DOC-1/derive",
        json={"destino": ONCOLOGIA, "motivo": "Motivo suficiente"},
        headers=login_as(UserRole.OPERADOR),
    )
    assert r.status_code == 403


# --- Detalle y listado --------------------------------------------------------


async def test_operador_abre_el_detalle_de_los_casos_de_su_cola(client, login_as, db):
    sentencias = _capturar_sentencias(db)
    db.queue(None)
    headers = login_as(UserRole.OPERADOR, colas=[make_queue(URGENCIAS, "Urgencias")])
    await client.get("/api/v1/documents/DOC-1", headers=headers)

    sql = _sql(sentencias[0])
    assert "clinical_documents.uploaded_by_id =" in sql
    assert f"OR clinical_documents.destino_enrutamiento IN ('{URGENCIAS}')" in sql


async def test_listado_filtra_por_atendido_y_varias_colas(client, login_as, db):
    sentencias = _capturar_sentencias(db)
    db.queue(0, [])
    r = await client.get(
        f"/api/v1/documents?atendido=false&destino={URGENCIAS},{ONCOLOGIA}",
        headers=login_as(UserRole.ADMIN),
    )

    assert r.status_code == 200
    sql = _sql(sentencias[0])
    assert f"clinical_documents.destino_enrutamiento IN ('{URGENCIAS}', '{ONCOLOGIA}')" in sql
    assert "clinical_documents.atendido_at IS NULL" in sql
