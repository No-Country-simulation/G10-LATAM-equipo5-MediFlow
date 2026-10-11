"""Corrección de documentos ya procesados o auditados (`PUT /documents/{id}`) y su historial."""

import json

from sqlalchemy.exc import SQLAlchemyError

from app.features.audit.changes import cambios_de_correccion, etiqueta_de_ruta
from app.features.auth.enums import UserRole
from app.features.documents.models import ClinicalDocumentCorrection
from app.features.documents.schemas import DatosGeneralesExtract, DetalleClinicoExtract
from tests.test_audit_api import DATOS_CORREGIDOS, RAW_IA, _pending, _queue_resolve

URL = "/api/v1/documents/DOC-A"

DATOS_VIGENTES = {
    **DATOS_CORREGIDOS,
    "paciente": {
        "nombre": "Carlos Mendes",
        "identificacion": {"tipo": "RUT", "numero": "12345678-5", "pais": "CL"},
        "edad": 60,
    },
}

CORRECTION_BODY = {
    "tipo_documento": "RECETA",
    "nivel_prioridad": "Rutina",
    "destino_enrutamiento": "Farmacia_Hospitalaria",
    "especialidad": "Medicina Interna",
    "datos_generales": {**DATOS_VIGENTES, "paciente": {**DATOS_VIGENTES["paciente"], "edad": 61}},
    "justificacion": "La edad estaba mal leída",
}


def _procesado(**kwargs):
    """Documento ya enrutado (sin auditoría), con los valores de `DATOS_VIGENTES`."""
    raw = json.loads(json.dumps(RAW_IA))
    raw["datos_generales"] = json.loads(json.dumps(DATOS_VIGENTES))
    raw["triaje"] = {"estado": "PROCESADO", "motivos_auditoria": []}
    campos = dict(
        estado="PROCESADO",
        requiere_auditoria=False,
        identificacion_paciente="12345678-5",
        edad_paciente=60,
        oci_json_path="procesados/Farmacia_Hospitalaria/DOC-A.json",
        raw_extracted_json=raw,
    )
    campos.update(kwargs)
    return _pending(**campos)


# --- Acceso y estado ---------------------------------------------------------


async def test_correction_requires_admin_or_auditor(client, login_as):
    for role in (UserRole.OPERADOR, UserRole.GESTOR_USUARIOS):
        r = await client.put(URL, json=CORRECTION_BODY, headers=login_as(role))
        assert r.status_code == 403


async def test_correction_of_missing_document_is_404(client, login_as, db, oci):
    db.queue(None)
    r = await client.put(URL, json=CORRECTION_BODY, headers=login_as(UserRole.AUDITOR_CLINICO))
    assert r.status_code == 404


async def test_pending_or_discarded_documents_cannot_be_corrected(client, login_as, db, oci):
    for estado in ("PENDIENTE_AUDITORIA", "DESCARTADO"):
        db.queue(_procesado(estado=estado))
        r = await client.put(URL, json=CORRECTION_BODY, headers=login_as(UserRole.ADMIN))
        assert r.status_code == 409
        assert estado in r.json()["detail"]
    assert oci.uploaded == {}


async def test_justification_is_required(client, login_as, db, oci):
    body = {**CORRECTION_BODY, "justificacion": "   "}
    r = await client.put(URL, json=body, headers=login_as(UserRole.ADMIN))
    assert r.status_code == 422


# --- Validaciones ------------------------------------------------------------


async def test_correction_applies_the_audit_validations(client, login_as, db, oci):
    _queue_resolve(db, _procesado())
    paciente = {**DATOS_VIGENTES["paciente"], "identificacion": {"tipo": "RUT", "numero": "12.345.678-9"}}
    body = {**CORRECTION_BODY, "datos_generales": {**DATOS_VIGENTES, "paciente": paciente}}
    r = await client.put(URL, json=body, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 422
    assert r.json()["detail"] == ["Identificación RUT con formato o dígito verificador inválido"]
    assert oci.uploaded == {}


async def test_correction_without_changes_is_rejected(client, login_as, db, oci):
    _queue_resolve(db, _procesado())
    body = {**CORRECTION_BODY, "datos_generales": DATOS_VIGENTES}
    r = await client.put(URL, json=body, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 422
    assert r.json()["detail"] == ["La corrección no modifica ningún valor del documento"]
    assert db.commits == 0


# --- Corrección exitosa ------------------------------------------------------


async def test_correction_updates_values_keeps_state_and_records_history(client, login_as, db, oci):
    doc = _procesado()
    _queue_resolve(db, doc)
    body = {**CORRECTION_BODY, "nivel_prioridad": "Urgente", "destino_enrutamiento": "Cola_Emergencia_Medica"}
    headers = login_as(UserRole.AUDITOR_CLINICO, username="auditor1")
    r = await client.put(URL, json=body, headers=headers)

    assert r.status_code == 200
    assert r.json()["estado"] == "PROCESADO"  # conserva su estado
    assert doc.edad_paciente == 61
    assert doc.destino_enrutamiento == "Cola_Emergencia_Medica"  # re-enrutado
    assert db.commits == 1

    # El JSON se sobrescribe en la misma ruta y guarda la versión de la IA y la corrección.
    assert oci.deleted == []
    final = json.loads(oci.uploaded["procesados/Farmacia_Hospitalaria/DOC-A.json"])
    assert final["datos_generales"]["paciente"]["edad"] == 61
    assert final["version_ia"]["datos_generales"]["paciente"]["edad"] == 60
    assert final["decision_enrutamiento"]["destino_principal"] == "Cola_Emergencia_Medica"
    assert final["triaje"]["estado"] == "PROCESADO"
    assert [c["justificacion"] for c in final["correcciones"]] == ["La edad estaba mal leída"]
    assert doc.raw_extracted_json == final

    [entrada] = doc.corrections
    assert (entrada.origen, entrada.corrected_by_username) == ("CORRECCION", "auditor1")
    assert entrada.justificacion == "La edad estaba mal leída"
    assert [(c["campo"], c["antes"], c["despues"]) for c in entrada.cambios] == [
        ("nivel_prioridad", "Rutina", "Urgente"),
        ("destino_enrutamiento", "Farmacia_Hospitalaria", "Cola_Emergencia_Medica"),
        ("paciente.edad", 60, 61),
    ]
    assert entrada.cambios[2]["etiqueta"] == "Paciente › Edad (años)"


async def test_second_correction_keeps_original_ai_version(client, login_as, db, oci):
    doc = _procesado()
    doc.raw_extracted_json["version_ia"] = {"datos_generales": {"paciente": {"edad": 59}}}
    doc.raw_extracted_json["correcciones"] = [{"justificacion": "primera"}]
    _queue_resolve(db, doc)
    r = await client.put(URL, json=CORRECTION_BODY, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    assert doc.raw_extracted_json["version_ia"] == {"datos_generales": {"paciente": {"edad": 59}}}
    assert [c["justificacion"] for c in doc.raw_extracted_json["correcciones"]] == [
        "primera",
        "La edad estaba mal leída",
    ]


async def test_audited_documents_can_be_corrected(client, login_as, db, oci):
    doc = _procesado(estado="AUDITADO", oci_json_path="procesados/auditados/DOC-A.json")
    _queue_resolve(db, doc)
    r = await client.put(URL, json=CORRECTION_BODY, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    assert r.json()["estado"] == "AUDITADO"
    assert "procesados/auditados/DOC-A.json" in oci.uploaded


async def test_correction_of_clinical_detail_is_listed_field_by_field(client, login_as, db, oci):
    doc = _procesado()
    _queue_resolve(db, doc)
    body = {
        **CORRECTION_BODY,
        "datos_generales": DATOS_VIGENTES,
        "detalle_clinico": {"medicamentos": [{"nombre": "Losartán 50 mg", "dosis": "1 cada 24 h"}]},
    }
    r = await client.put(URL, json=body, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    assert [m.dosis for m in doc.medications] == ["1 cada 24 h"]
    [entrada] = doc.corrections
    assert [(c["campo"], c["etiqueta"], c["antes"], c["despues"]) for c in entrada.cambios] == [
        ("medicamentos[0].dosis", "Medicamentos 1 › Dosis", "1 cada 12 h", "1 cada 24 h"),
    ]


# --- Fallos de persistencia --------------------------------------------------


async def test_oci_failure_aborts_the_correction(client, login_as, db, oci):
    _queue_resolve(db, _procesado())
    oci.fail_on = "DOC-A.json"
    r = await client.put(URL, json=CORRECTION_BODY, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 500
    assert db.commits == 0


async def test_commit_failure_restores_previous_json_in_oci(client, login_as, db, oci):
    doc = _procesado()
    anterior = json.loads(json.dumps(doc.raw_extracted_json))
    _queue_resolve(db, doc)
    db.fail_commit = SQLAlchemyError("BD caída")
    r = await client.put(URL, json=CORRECTION_BODY, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 500
    assert db.rollbacks == 1
    assert json.loads(oci.uploaded["procesados/Farmacia_Hospitalaria/DOC-A.json"]) == anterior


# --- Historial ---------------------------------------------------------------


async def test_audit_resolution_is_recorded_in_history(client, login_as, db, oci):
    doc = _pending()
    _queue_resolve(db, doc)
    body = {
        "tipo_documento": "RECETA",
        "nivel_prioridad": "Prioritario",
        "destino_enrutamiento": "Farmacia_Hospitalaria",
        "datos_generales": DATOS_CORREGIDOS,
        "audit_notes": "Corregido manualmente",
    }
    r = await client.put("/api/v1/audit/DOC-A/resolve", json=body, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    [entrada] = doc.corrections
    assert (entrada.origen, entrada.justificacion) == ("AUDITORIA", "Corregido manualmente")
    campos = [c["campo"] for c in entrada.cambios]
    assert campos[0] == "nivel_prioridad"
    assert "paciente.identificacion.numero" in campos


async def test_detail_returns_history_and_current_values(client, login_as, db, oci):
    doc = _procesado()
    doc.corrections = [
        ClinicalDocumentCorrection(
            origen="CORRECCION",
            justificacion="La edad estaba mal leída",
            cambios=[{"campo": "paciente.edad", "etiqueta": "Paciente › Edad (años)", "antes": 60, "despues": 61}],
            corrected_by_username="auditor1",
            corrected_at=doc.created_at,
        )
    ]
    db.queue(doc)
    r = await client.get(URL, headers=login_as(UserRole.ADMIN))

    assert r.status_code == 200
    data = r.json()
    assert data["datos_generales"]["paciente"]["edad"] == 60
    assert data["detalle_clinico"]["medicamentos"][0]["nombre"] == "Losartán 50 mg"
    [entrada] = data["historial_correcciones"]
    assert entrada["origen"] == "CORRECCION"
    assert entrada["corrected_by_username"] == "auditor1"
    assert entrada["cambios"][0]["despues"] == 61


# --- Cálculo de cambios ------------------------------------------------------


def test_format_differences_are_not_reported_as_changes():
    """Clave ausente vs `null` o lista vacía no es un cambio: se comparan valores normalizados."""
    doc = _procesado()
    raw = {"datos_generales": {"paciente": {"nombre": "Ana"}, "diagnosticos": []}}
    datos = DatosGeneralesExtract.model_validate({"paciente": {"nombre": "Ana", "edad": None}, "profesionales": []})
    nuevos = {campo: getattr(doc, campo) for campo in ("tipo_documento", "nivel_prioridad", "destino_enrutamiento", "especialidad")}

    assert cambios_de_correccion(doc, raw, nuevos, datos, DetalleClinicoExtract()) == []


def test_route_labels_use_schema_titles():
    esquema = DetalleClinicoExtract.model_json_schema()
    assert (
        etiqueta_de_ruta("examenes_y_laboratorio.paneles[0].parametros[1].valor", esquema, omitir_bloque=True)
        == "Paneles 1 › Parámetros 2 › Valor"
    )
    assert etiqueta_de_ruta("medicamentos[2].via", esquema, omitir_bloque=True) == "Medicamentos 3 › Vía"
    assert etiqueta_de_ruta("bloque_desconocido.algo_nuevo", esquema) == "Bloque desconocido › Algo nuevo"
