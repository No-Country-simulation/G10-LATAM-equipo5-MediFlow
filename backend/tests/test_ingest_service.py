import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.features.documents.schemas import IngestPayload
from app.features.documents.service import (
    DocumentIngestionError,
    InvalidBase64Error,
    _resolve_routing,
    ingest_document,
)
from tests.conftest import ingest_body


def _payload(**kwargs) -> IngestPayload:
    return IngestPayload.model_validate(ingest_body(**kwargs))


def test_routing_high_confidence_is_processed():
    p = _payload(score=0.95)
    result = _resolve_routing(p.clasificacion, p.decision_enrutamiento, "D1")
    assert result == ("PROCESADO", "procesados/urgente/D1.json", False)


def test_routing_low_confidence_goes_to_audit():
    p = _payload(score=0.84)
    result = _resolve_routing(p.clasificacion, p.decision_enrutamiento, "D1")
    assert result == ("PENDIENTE_AUDITORIA", "auditoria_humana/D1.json", True)


def test_routing_threshold_is_inclusive_at_085():
    p = _payload(score=0.85)
    assert _resolve_routing(p.clasificacion, p.decision_enrutamiento, "D1")[0] == "PROCESADO"


def test_routing_explicit_audit_flag_wins():
    p = _payload(score=0.99, requiere_auditoria=True)
    assert _resolve_routing(p.clasificacion, p.decision_enrutamiento, "D1")[0] == "PENDIENTE_AUDITORIA"


def test_medico_uses_rut_not_matricula():
    p = _payload()
    assert p.datos_extraidos.medico_solicitante.rut == "9.876.543-2"
    assert not hasattr(p.datos_extraidos.medico_solicitante, "matricula")


async def test_invalid_base64_raises(db, oci):
    payload = _payload(archivo_base64="###no-es-base64###")
    with pytest.raises(InvalidBase64Error):
        await ingest_document(payload, db)
    assert oci.uploaded == {}


async def test_ingest_uploads_binary_and_json_and_persists(db, oci):
    db.queue(None)  # no existe un documento previo
    doc = await ingest_document(_payload(), db)

    assert set(oci.uploaded) == {"recibidos/DOC-TEST-1.pdf", "procesados/urgente/DOC-TEST-1.json"}
    assert doc.estado == "PROCESADO"
    assert doc.medico_rut == "9.876.543-2"
    assert doc.oci_bucket_name == "test-bucket"
    assert db.commits == 1


async def test_oci_failure_raises_and_compensates(db, oci):
    oci.fail_on = ".json"
    with pytest.raises(DocumentIngestionError):
        await ingest_document(_payload(), db)
    assert oci.deleted == ["recibidos/DOC-TEST-1.pdf"]


async def test_db_failure_rolls_back_and_removes_uploads(db, oci):
    db.queue(None)
    db.fail_commit = SQLAlchemyError("boom")
    with pytest.raises(DocumentIngestionError):
        await ingest_document(_payload(), db)
    assert db.rollbacks == 1
    assert set(oci.deleted) == set(oci.uploaded)
