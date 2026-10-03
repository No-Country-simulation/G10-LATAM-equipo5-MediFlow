import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from app.features.auth.enums import UserRole
from app.features.documents.models import ClinicalDocument, ClinicalDocumentAttachment
from tests.conftest import CATALOGO_COLAS, CATALOGO_TIPOS

RESOLVE_BODY = {
    "rut_paciente": "12.345.678-9",
    "nombre_paciente": "Carlos Mendes",
    "tipo_documento": "RECETA",
    "nivel_prioridad": "Prioritario",
    "diagnostico_principal": "Hipertensión",
    "destino_enrutamiento": "Farmacia_Hospitalaria",
    "medico_rut": "9.876.543-2",
    "audit_notes": "Corregido manualmente",
}

RAW_IA = {
    "documento_id": "DOC-A",
    "clasificacion": {
        "tipo_documento": "RECETA",
        "especialidad": "Medicina Interna",
        "nivel_prioridad": "Rutina",
        "score_confianza_clasificacion": 0.6,
    },
    "datos_generales": {
        "paciente": {"rut": "12.345.678-?", "nombre": "Carlos Mendes", "edad": None},
        "medico_solicitante": {"rut": None, "nombre": None, "matricula": None},
        "diagnostico_principal": "Hipertensión",
        "cie10_sugerido": None,
    },
    "detalle_clinico": {
        "medicamentos": [
            {"nombre": "Losartán 50 mg", "dosis": "1 cada 12 h", "duracion_tratamiento": None}
        ]
    },
    "decision_enrutamiento": {
        "destino_principal": "Farmacia_Hospitalaria",
        "requiere_auditoria_humana": False,
        "justificacion_enrutamiento": "Receta",
        "notificacion_generada": None,
    },
    "archivos": [
        {"tipo_archivo": "PDF", "rol": "documento_principal", "ruta_oci": "recibidos/DOC-A/0.pdf"}
    ],
    "triaje": {
        "estado": "PENDIENTE_AUDITORIA",
        "motivos_auditoria": ["Score de confianza 0.6 menor al umbral 0.85"],
    },
}


def _pending(**kwargs) -> ClinicalDocument:
    fields = dict(
        documento_id="DOC-A",
        estado="PENDIENTE_AUDITORIA",
        rut_paciente="12.345.678-?",
        nombre_paciente="Carlos Mendes",
        tipo_documento="RECETA",
        especialidad="Medicina Interna",
        nivel_prioridad="Rutina",
        diagnostico_principal="Hipertensión",
        destino_enrutamiento="Farmacia_Hospitalaria",
        score_confianza=Decimal("0.600"),
        oci_bucket_name="test-bucket",
        oci_json_path="auditoria_humana/DOC-A.json",
        raw_extracted_json=json.loads(json.dumps(RAW_IA)),
        requiere_auditoria=True,
        created_at=datetime.now(timezone.utc),
        attachments=[
            ClinicalDocumentAttachment(tipo_archivo="PDF", oci_path="recibidos/DOC-A/0.pdf", orden=0)
        ],
    )
    fields.update(kwargs)
    return ClinicalDocument(**fields)


def _queue_resolve(db, doc) -> None:
    """Encola las consultas de la resolución: documento, tipos activos y colas activas."""
    db.queue(doc, [(codigo, None) for codigo in CATALOGO_TIPOS], CATALOGO_COLAS)


# --- Acceso y consulta -------------------------------------------------------


async def test_audit_requires_role(client, login_as):
    for role in (UserRole.GESTOR_USUARIOS, UserRole.OPERADOR):
        headers = login_as(role)
        assert (await client.get("/api/v1/audit/DOC-A", headers=headers)).status_code == 403


async def test_get_case_404(client, login_as, db):
    db.queue(None)
    headers = login_as(UserRole.AUDITOR_CLINICO)
    assert (await client.get("/api/v1/audit/NOPE", headers=headers)).status_code == 404


async def test_get_case_returns_url_per_file_and_reasons(client, login_as, db, oci):
    doc = _pending(
        attachments=[
            ClinicalDocumentAttachment(tipo_archivo="PDF", oci_path="recibidos/DOC-A/0.pdf", orden=0),
            ClinicalDocumentAttachment(
                tipo_archivo="DCM", oci_path="recibidos/DOC-A/1.dcm", rol="imagen_estudio", orden=1
            ),
        ]
    )
    db.queue(doc)
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get("/api/v1/audit/DOC-A", headers=headers)

    assert r.status_code == 200
    data = r.json()
    assert data["oci_preview_url"] == "https://oci.example/preview"
    assert [(a["tipo_archivo"], a["visualizable"]) for a in data["archivos"]] == [
        ("PDF", True),
        ("DCM", False),
    ]
    assert data["motivos_auditoria"] == ["Score de confianza 0.6 menor al umbral 0.85"]
    assert data["preview_expira_en_minutos"] == 15


# --- Resolver ----------------------------------------------------------------


async def test_resolve_marks_audited_with_corrected_values_on_top(client, login_as, db, oci):
    doc = _pending()
    _queue_resolve(db, doc)
    headers = login_as(UserRole.AUDITOR_CLINICO, username="auditor1")
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=RESOLVE_BODY, headers=headers)

    assert r.status_code == 200
    assert r.json()["estado"] == "AUDITADO"
    assert doc.rut_paciente == "12.345.678-9"
    assert doc.requiere_auditoria is False
    assert doc.oci_json_path == "procesados/auditados/DOC-A.json"
    assert oci.deleted == ["auditoria_humana/DOC-A.json"]

    final = json.loads(oci.uploaded["procesados/auditados/DOC-A.json"])
    assert final["datos_generales"]["paciente"]["rut"] == "12.345.678-9"
    assert final["version_ia"]["datos_generales"]["paciente"]["rut"] == "12.345.678-?"
    assert final["triaje"]["estado"] == "AUDITADO"
    assert final["clasificacion"]["nivel_prioridad"] == "Prioritario"
    corregidos = final["auditoria"]["campos_corregidos"]
    assert set(corregidos) == {"rut_paciente", "nivel_prioridad", "medico_rut"}
    assert corregidos["rut_paciente"] == {"antes": "12.345.678-?", "despues": "12.345.678-9"}
    # La BD guarda exactamente el mismo JSON consolidado que OCI.
    assert doc.raw_extracted_json == final


async def test_resolve_can_correct_clinical_detail(client, login_as, db, oci):
    doc = _pending()
    _queue_resolve(db, doc)
    body = {
        **RESOLVE_BODY,
        "detalle_clinico": {"medicamentos": [{"nombre": "Losartán 50 mg", "dosis": "1 cada 24 h"}]},
    }
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=body, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    assert [m.dosis for m in doc.medications] == ["1 cada 24 h"]
    assert "detalle_clinico" in doc.raw_extracted_json["auditoria"]["campos_corregidos"]


async def test_resolve_rejects_values_outside_catalog(client, login_as, db, oci):
    _queue_resolve(db, _pending())
    body = {**RESOLVE_BODY, "tipo_documento": "Receta Médica", "destino_enrutamiento": "Cola_X"}
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=body, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 422
    assert r.json()["detail"] == [
        "El tipo de documento 'Receta Médica' no existe o está inactivo en el catálogo",
        "La cola 'Cola_X' no existe o está inactiva en el catálogo",
    ]
    assert oci.uploaded == {}


async def test_resolve_changing_type_requires_matching_detail(client, login_as, db, oci):
    _queue_resolve(db, _pending())
    body = {**RESOLVE_BODY, "tipo_documento": "INTERCONSULTA"}
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=body, headers=login_as(UserRole.ADMIN))
    assert r.status_code == 422
    assert "espera ['interconsulta']" in r.json()["detail"][0]


async def test_resolve_already_resolved_returns_409(client, login_as, db, oci):
    db.queue(_pending(estado="AUDITADO"))
    headers = login_as(UserRole.ADMIN)
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=RESOLVE_BODY, headers=headers)
    assert r.status_code == 409


async def test_resolve_requires_notes_and_valid_priority(client, login_as):
    headers = login_as(UserRole.ADMIN)
    for override in ({"audit_notes": ""}, {"audit_notes": "   "}, {"nivel_prioridad": "Inventada"}):
        r = await client.put(
            "/api/v1/audit/DOC-A/resolve", json={**RESOLVE_BODY, **override}, headers=headers
        )
        assert r.status_code == 422


async def test_resolve_oci_failure_returns_500(client, login_as, db, oci):
    _queue_resolve(db, _pending())
    oci.fail_on = "auditados"
    headers = login_as(UserRole.ADMIN)
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=RESOLVE_BODY, headers=headers)
    assert r.status_code == 500


# --- Descartar ---------------------------------------------------------------


async def test_discard_moves_json_and_records_reason(client, login_as, db, oci):
    doc = _pending()
    db.queue(doc)
    r = await client.put(
        "/api/v1/audit/DOC-A/discard",
        json={"motivo": "Documento duplicado de DOC-0"},
        headers=login_as(UserRole.AUDITOR_CLINICO),
    )

    assert r.status_code == 200
    assert r.json()["estado"] == "DESCARTADO"
    assert doc.oci_json_path == "descartados/DOC-A.json"
    assert doc.audit_notes == "Documento duplicado de DOC-0"
    final = json.loads(oci.uploaded["descartados/DOC-A.json"])
    assert final["triaje"]["estado"] == "DESCARTADO"
    assert final["auditoria"]["motivo"] == "Documento duplicado de DOC-0"
    assert oci.deleted == ["auditoria_humana/DOC-A.json"]


async def test_discard_requires_reason(client, login_as):
    r = await client.put(
        "/api/v1/audit/DOC-A/discard", json={"motivo": "  "}, headers=login_as(UserRole.ADMIN)
    )
    assert r.status_code == 422


# --- Tomar caso --------------------------------------------------------------


def _claimed_by_other(minutes_ago: int = 5) -> ClinicalDocument:
    return _pending(
        asignado_a_id=uuid4(),
        asignado_a_username="otro_auditor",
        asignado_at=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
    )


async def test_claim_assigns_case(client, login_as, db):
    doc = _pending()
    db.queue(doc)
    r = await client.post(
        "/api/v1/audit/DOC-A/claim", headers=login_as(UserRole.AUDITOR_CLINICO, username="ana")
    )
    assert r.status_code == 200
    assert r.json()["asignado_a_username"] == "ana"
    assert doc.asignado_a_username == "ana"


async def test_case_claimed_by_other_cannot_be_claimed_or_resolved(client, login_as, db, oci):
    headers = login_as(UserRole.AUDITOR_CLINICO, username="ana")
    db.queue(_claimed_by_other())
    r = await client.post("/api/v1/audit/DOC-A/claim", headers=headers)
    assert r.status_code == 409
    assert "otro_auditor" in r.json()["detail"]

    db.queue(_claimed_by_other())
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=RESOLVE_BODY, headers=headers)
    assert r.status_code == 409


async def test_expired_claim_can_be_taken(client, login_as, db):
    db.queue(_claimed_by_other(minutes_ago=31))
    r = await client.post(
        "/api/v1/audit/DOC-A/claim", headers=login_as(UserRole.AUDITOR_CLINICO, username="ana")
    )
    assert r.status_code == 200


async def test_release_only_by_owner_or_admin(client, login_as, db):
    db.queue(_claimed_by_other())
    r = await client.delete("/api/v1/audit/DOC-A/claim", headers=login_as(UserRole.AUDITOR_CLINICO))
    assert r.status_code == 403

    doc = _claimed_by_other()
    db.queue(doc)
    r = await client.delete("/api/v1/audit/DOC-A/claim", headers=login_as(UserRole.ADMIN))
    assert r.status_code == 204
    assert doc.asignado_a_id is None


async def test_document_list_shows_reasons_and_assignment(client, login_as, db):
    db.queue(1, [_claimed_by_other()])
    r = await client.get(
        "/api/v1/documents?estado=PENDIENTE_AUDITORIA", headers=login_as(UserRole.AUDITOR_CLINICO)
    )
    item = r.json()["items"][0]
    assert item["motivos_auditoria"] == ["Score de confianza 0.6 menor al umbral 0.85"]
    assert item["asignado_a_username"] == "otro_auditor"
