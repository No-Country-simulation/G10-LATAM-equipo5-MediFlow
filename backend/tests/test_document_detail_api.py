from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from oci.exceptions import ServiceError

from app.features.auth.enums import UserRole
from app.features.documents.detail import build_campos_relevantes
from app.features.documents.models import (
    ClinicalDocument,
    ClinicalDocumentAttachment,
    ClinicalDocumentMedication,
    ClinicalDocumentProcedure,
    LabPanel,
    LabParameter,
)
from tests.conftest import ingest_body, make_area, queue_ingest

DETAIL_URL = "/api/v1/documents/DOC-1"


def _document(detalle_clinico: dict[str, Any] | None = None, **kwargs) -> ClinicalDocument:
    fields = dict(
        documento_id="DOC-1",
        estado="PROCESADO",
        identificacion_paciente="1-9",
        nombre_paciente="Ana",
        edad_paciente=40,
        medico_nombre="Dra. Silveira",
        tipo_documento="LABORATORIO",
        especialidad="Hematología",
        nivel_prioridad="Urgente",
        score_confianza=Decimal("0.950"),
        requiere_auditoria=False,
        diagnostico_principal="TEP Agudo",
        cie10_sugerido="I26.9",
        destino_enrutamiento="Cola_Emergencia_Medica",
        oci_bucket_name="test-bucket",
        oci_json_path="procesados/urgente/DOC-1.json",
        raw_extracted_json={"detalle_clinico": detalle_clinico or {}},
        area_origen=make_area(),
        created_at=datetime.now(timezone.utc),
        attachments=[
            ClinicalDocumentAttachment(tipo_archivo="PDF", oci_path="recibidos/DOC-1/0.pdf", orden=0),
            ClinicalDocumentAttachment(tipo_archivo="DCM", oci_path="recibidos/DOC-1/1.dcm", orden=1),
        ],
    )
    fields.update(kwargs)
    return ClinicalDocument(**fields)


# --- Acceso ------------------------------------------------------------------


async def test_detail_requires_token(client):
    assert (await client.get(DETAIL_URL)).status_code == 401


async def test_detail_forbidden_for_gestor_usuarios(client, login_as):
    headers = login_as(UserRole.GESTOR_USUARIOS)
    assert (await client.get(DETAIL_URL, headers=headers)).status_code == 403


async def test_detail_missing_document_returns_404(client, login_as, oci):
    headers = login_as(UserRole.ADMIN)
    r = await client.get(DETAIL_URL, headers=headers)
    assert r.status_code == 404
    assert r.json()["detail"] == "No se encontró el documento DOC-1"


async def test_detail_of_other_users_document_is_404_for_operador(client, login_as, oci):
    # La consulta filtra por `uploaded_by_id`: para un documento ajeno no devuelve fila.
    headers = login_as(UserRole.OPERADOR)
    assert (await client.get(DETAIL_URL, headers=headers)).status_code == 404


async def test_detail_rejects_unsafe_documento_id(client, login_as):
    headers = login_as(UserRole.ADMIN)
    assert (await client.get("/api/v1/documents/DOC%201", headers=headers)).status_code == 422


# --- Contenido ---------------------------------------------------------------


async def test_detail_returns_case_data_files_and_area(client, login_as, db, oci):
    db.queue(_document())
    headers = login_as(UserRole.OPERADOR)
    r = await client.get(DETAIL_URL, headers=headers)

    assert r.status_code == 200
    data = r.json()
    assert data["diagnostico_principal"] == "TEP Agudo"
    assert data["cie10_sugerido"] == "I26.9"
    assert data["edad_paciente"] == 40
    assert data["area_origen"]["codigo"] == "ADMISION"
    assert data["preview_expira_en_minutos"] == 15
    assert data["aviso_archivos"] is None
    assert [(a["tipo_archivo"], a["visualizable"], a["url"]) for a in data["archivos"]] == [
        ("PDF", True, "https://oci.example/preview"),
        ("DCM", False, "https://oci.example/preview"),
    ]


async def test_detail_laboratorio_returns_panels_and_text_fields(client, login_as, db, oci):
    panel = LabPanel(
        nombre_panel="Coagulación",
        orden=0,
        parametros=[
            LabParameter(nombre="Dímero D", valor="1200", unidad="ng/mL", rango_referencia="< 500", alterado=True, orden=0)
        ],
    )
    detalle = {
        "examenes_y_laboratorio": {
            "estudio_solicitado": "Coagulación",
            "conclusiones_o_hallazgos": "",
            "paneles": [{"nombre_panel": "Coagulación"}],
        }
    }
    db.queue(_document(detalle, lab_panels=[panel]))
    headers = login_as(UserRole.AUDITOR_CLINICO)
    detalle_resp = (await client.get(DETAIL_URL, headers=headers)).json()["detalle"]

    assert detalle_resp["tablas"]["paneles_laboratorio"] == [
        {
            "nombre_panel": "Coagulación",
            "muestra": None,
            "parametros": [
                {
                    "nombre": "Dímero D",
                    "valor": "1200",
                    "unidad": "ng/mL",
                    "rango_referencia": "< 500",
                    "alterado": True,
                    "critico": None,
                }
            ],
        }
    ]
    assert detalle_resp["tablas"]["medicamentos"] == []
    # Los campos vacíos se omiten.
    assert detalle_resp["campos_relevantes"] == [
        {"campo": "estudio_solicitado", "etiqueta": "Estudio solicitado", "valor": "Coagulación"}
    ]


async def test_detail_receta_and_epicrisis_tables(client, login_as, db, oci):
    db.queue(
        _document(
            tipo_documento="EPICRISIS",
            medications=[ClinicalDocumentMedication(nombre="Enoxaparina", dosis="60 mg", orden=0)],
            procedures=[ClinicalDocumentProcedure(descripcion="Angio-TAC", orden=0)],
        )
    )
    headers = login_as(UserRole.ADMIN)
    tablas = (await client.get(DETAIL_URL, headers=headers)).json()["detalle"]["tablas"]

    assert tablas["medicamentos"] == [
        {
            "nombre": "Enoxaparina",
            "dosis": "60 mg",
            "frecuencia": None,
            "via": None,
            "duracion_tratamiento": None,
            "cantidad": None,
            "tipo": "PRESCRITO",
        }
    ]
    assert tablas["procedimientos"] == ["Angio-TAC"]


async def test_detail_type_without_tables_returns_relevant_fields(client, login_as, db, oci):
    detalle = {
        "anatomia_patologica": {
            "tipo_muestra": "Biopsia gástrica",
            "diagnostico_histopatologico": "Adenocarcinoma",
            "malignidad": True,
        }
    }
    db.queue(_document(detalle, tipo_documento="ANATOMIA_PATOLOGICA"))
    headers = login_as(UserRole.ADMIN)
    data = (await client.get(DETAIL_URL, headers=headers)).json()["detalle"]

    assert all(filas == [] for filas in data["tablas"].values())
    assert [(c["etiqueta"], c["valor"]) for c in data["campos_relevantes"]] == [
        ("Tipo de muestra", "Biopsia gástrica"),
        ("Diagnóstico histopatológico", "Adenocarcinoma"),
        ("Malignidad", True),
    ]


async def test_detail_custom_type_uses_schema_titles(client, login_as, db, oci):
    detalle = {"campos_adicionales": {"fecha_control": "2026-11-01", "peso_kg": 72, "notas": None}}
    schema = {"type": "object", "properties": {"fecha_control": {"type": "string", "title": "Fecha del control"}}}
    db.queue(_document(detalle, tipo_documento="CONTROL_NUTRICIONAL"), schema)
    headers = login_as(UserRole.ADMIN)
    campos = (await client.get(DETAIL_URL, headers=headers)).json()["detalle"]["campos_relevantes"]

    assert campos == [
        {"campo": "fecha_control", "etiqueta": "Fecha del control", "valor": "2026-11-01"},
        {"campo": "peso_kg", "etiqueta": "Peso kg", "valor": 72},
    ]


async def test_detail_is_returned_even_if_oci_fails(client, login_as, db, oci, monkeypatch):
    async def failing_par(*_args, **_kwargs):
        raise ServiceError(503, "ServiceUnavailable", {}, "OCI no disponible")

    monkeypatch.setattr(oci, "create_preauthenticated_request", failing_par)
    db.queue(_document())
    headers = login_as(UserRole.ADMIN)
    r = await client.get(DETAIL_URL, headers=headers)

    assert r.status_code == 200
    data = r.json()
    assert [a["url"] for a in data["archivos"]] == [None, None]
    assert "2 archivo(s)" in data["aviso_archivos"]
    assert data["diagnostico_principal"] == "TEP Agudo"


def test_campos_relevantes_ignores_unknown_or_malformed_blocks():
    assert build_campos_relevantes({"bloque_desconocido": {"x": 1}, "interconsulta": "no es dict"}) == []


# --- Área de origen en ingesta y listado -------------------------------------


async def test_ingest_stores_uploader_area(client, login_as, db, oci):
    area = make_area("URGENCIAS", "Urgencias")
    queue_ingest(db)
    headers = login_as(UserRole.OPERADOR, username="operador", area=area)
    r = await client.post("/api/v1/documents/ingest", json=ingest_body(), headers=headers)

    assert r.status_code == 201
    document = db.added[0]
    assert document.area_origen_id == area.id
    assert document.raw_extracted_json["triaje"]["area_origen_codigo"] == "URGENCIAS"


async def test_list_documents_includes_area_and_diagnosis(client, login_as, db):
    db.queue(1, [_document()])
    headers = login_as(UserRole.AUDITOR_CLINICO)
    item = (await client.get("/api/v1/documents", headers=headers)).json()["items"][0]

    assert item["area_origen"]["codigo"] == "ADMISION"
    assert item["diagnostico_principal"] == "TEP Agudo"
    assert item["cie10_sugerido"] == "I26.9"
    assert item["especialidad"] == "Hematología"
    assert item["medico_nombre"] == "Dra. Silveira"
    assert "archivos" not in item


async def test_list_documents_accepts_area_filter(client, login_as, db):
    db.queue(0, [])
    headers = login_as(UserRole.ADMIN)
    r = await client.get(f"/api/v1/documents?area_origen_id={make_area().id}", headers=headers)
    assert r.status_code == 200
    assert (await client.get("/api/v1/documents?area_origen_id=no-uuid", headers=headers)).status_code == 422
