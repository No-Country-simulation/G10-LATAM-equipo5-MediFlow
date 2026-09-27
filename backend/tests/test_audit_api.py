from datetime import datetime, timezone
from decimal import Decimal

from app.features.auth.enums import UserRole
from app.features.documents.models import ClinicalDocument, ClinicalDocumentAttachment

RESOLVE_BODY = {
    "rut_paciente": "12.345.678-9",
    "nombre_paciente": "Carlos Mendes",
    "tipo_documento": "Receta",
    "nivel_prioridad": "Prioritario",
    "diagnostico_principal": "Hipertensión",
    "destino_enrutamiento": "Farmacia_Hospitalaria",
    "medico_rut": "9.876.543-2",
    "audit_notes": "Corregido manualmente",
}


def _pending(**kwargs) -> ClinicalDocument:
    fields = dict(
        documento_id="DOC-A",
        estado="PENDIENTE_AUDITORIA",
        tipo_documento="Receta",
        nivel_prioridad="Rutina",
        score_confianza=Decimal("0.600"),
        oci_bucket_name="test-bucket",
        oci_json_path="auditoria_humana/DOC-A.json",
        raw_extracted_json={"documento_id": "DOC-A"},
        requiere_auditoria=True,
        created_at=datetime.now(timezone.utc),
        attachments=[
            ClinicalDocumentAttachment(tipo_archivo="PDF", oci_path="recibidos/DOC-A/0.pdf", orden=0)
        ],
    )
    fields.update(kwargs)
    return ClinicalDocument(**fields)


async def test_audit_requires_role(client, login_as):
    headers = login_as(UserRole.GESTOR_USUARIOS)
    assert (await client.get("/api/v1/audit/DOC-A", headers=headers)).status_code == 403


async def test_get_case_404(client, login_as, db):
    db.queue(None)
    headers = login_as(UserRole.AUDITOR_CLINICO)
    assert (await client.get("/api/v1/audit/NOPE", headers=headers)).status_code == 404


async def test_get_case_includes_preview_url(client, login_as, db, oci):
    db.queue(_pending())
    headers = login_as(UserRole.AUDITOR_CLINICO)
    r = await client.get("/api/v1/audit/DOC-A", headers=headers)
    assert r.status_code == 200
    assert r.json()["oci_preview_url"] == "https://oci.example/preview"


async def test_resolve_marks_document_audited(client, login_as, db, oci):
    doc = _pending()
    db.queue(doc)
    headers = login_as(UserRole.AUDITOR_CLINICO, username="auditor1")
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=RESOLVE_BODY, headers=headers)

    assert r.status_code == 200
    assert r.json()["estado"] == "AUDITADO"
    assert doc.medico_rut == "9.876.543-2"
    assert doc.requiere_auditoria is False
    assert doc.oci_json_path == "procesados/auditados/DOC-A.json"
    assert "procesados/auditados/DOC-A.json" in oci.uploaded


async def test_resolve_already_resolved_returns_400(client, login_as, db, oci):
    db.queue(_pending(estado="AUDITADO"))
    headers = login_as(UserRole.ADMIN)
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=RESOLVE_BODY, headers=headers)
    assert r.status_code == 400


async def test_resolve_requires_notes_and_valid_priority(client, login_as):
    headers = login_as(UserRole.ADMIN)
    r = await client.put(
        "/api/v1/audit/DOC-A/resolve", json={**RESOLVE_BODY, "audit_notes": ""}, headers=headers
    )
    assert r.status_code == 422
    r = await client.put(
        "/api/v1/audit/DOC-A/resolve",
        json={**RESOLVE_BODY, "nivel_prioridad": "Inventada"},
        headers=headers,
    )
    assert r.status_code == 422


async def test_resolve_oci_failure_returns_500(client, login_as, db, oci):
    db.queue(_pending())
    oci.fail_on = "auditados"
    headers = login_as(UserRole.ADMIN)
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=RESOLVE_BODY, headers=headers)
    assert r.status_code == 500
