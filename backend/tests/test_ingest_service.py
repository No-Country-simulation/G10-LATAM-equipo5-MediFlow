import pytest
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.features.auth.enums import UserRole
from app.features.documents.schemas import IngestPayload
from app.features.documents.service import (
    DocumentAlreadyExistsError,
    DocumentIngestionError,
    InvalidBase64Error,
    _audit_reasons,
    _resolve_routing,
    ingest_document,
)
from tests.conftest import CATALOGO_COLAS, CATALOGO_TIPOS, ingest_body, make_user, queue_ingest


def _payload(**kwargs) -> IngestPayload:
    return IngestPayload.model_validate(ingest_body(**kwargs))


def _triage(p: IngestPayload) -> tuple[tuple[str, str, bool], list[str]]:
    motivos = _audit_reasons(p, dict.fromkeys(CATALOGO_TIPOS), set(CATALOGO_COLAS))
    p.documento_id = "D1"
    return _resolve_routing(p, motivos), motivos


def _clasificacion(tipo: str) -> dict:
    return {
        "tipo_documento": tipo,
        "nivel_prioridad": "Rutina",
        "score_confianza_clasificacion": 0.95,
    }


def test_routing_high_confidence_is_processed():
    result, motivos = _triage(_payload(score=0.95))
    assert result == ("PROCESADO", "procesados/urgente/D1.json", False)
    assert motivos == []


def test_routing_low_confidence_goes_to_audit():
    result, motivos = _triage(_payload(score=0.84))
    assert result == ("PENDIENTE_AUDITORIA", "auditoria_humana/D1.json", True)
    assert "menor al umbral" in motivos[0]


def test_routing_threshold_is_inclusive_at_085():
    assert _triage(_payload(score=0.85))[0][0] == "PROCESADO"


def test_routing_explicit_audit_flag_wins():
    result, motivos = _triage(_payload(score=0.99, requiere_auditoria=True))
    assert result[0] == "PENDIENTE_AUDITORIA"
    assert motivos == ["El workflow solicitó auditoría humana"]


def test_tipo_otro_siempre_va_a_auditoria():
    result, motivos = _triage(_payload(clasificacion=_clasificacion("OTRO"), detalle_clinico={}))
    assert result[0] == "PENDIENTE_AUDITORIA"
    assert motivos == ["Documento no clasificable (tipo OTRO)"]


def test_tipo_fuera_de_catalogo_va_a_auditoria():
    p = _payload(clasificacion=_clasificacion("Receta Médica"), detalle_clinico={})
    result, motivos = _triage(p)
    assert result[0] == "PENDIENTE_AUDITORIA"
    assert "'Receta Médica' no existe o está inactivo" in motivos[0]


def test_cola_fuera_de_catalogo_va_a_auditoria():
    body = ingest_body()
    body["decision_enrutamiento"]["destino_principal"] = "Cola_Inventada"
    result, motivos = _triage(IngestPayload.model_validate(body))
    assert result[0] == "PENDIENTE_AUDITORIA"
    assert motivos == ["La cola 'Cola_Inventada' no existe o está inactiva en el catálogo"]


def test_bloque_que_no_corresponde_al_tipo_va_a_auditoria():
    p = _payload(
        clasificacion=_clasificacion("RECETA"),
        detalle_clinico={"interconsulta": {"especialidad_destino": "Cardiología"}},
    )
    result, motivos = _triage(p)
    assert result[0] == "PENDIENTE_AUDITORIA"
    assert motivos == [
        "detalle_clinico trae ['interconsulta'] pero el tipo 'RECETA' espera ['medicamentos']"
    ]


def test_nivel_prioridad_fuera_de_valores_es_rechazado():
    body = ingest_body()
    body["clasificacion"]["nivel_prioridad"] = "Alta"
    with pytest.raises(ValidationError):
        IngestPayload.model_validate(body)


@pytest.mark.parametrize("tipo", ["DCM", "TIFF", "IMAGEN"])
def test_archivo_principal_debe_ser_visualizable(tipo):
    with pytest.raises(ValidationError):
        _payload(tipo_archivo=tipo)


def test_medico_admite_rut_y_matricula():
    p = _payload()
    assert p.datos_generales.medico_solicitante.rut == "9.876.543-2"
    assert p.datos_generales.medico_solicitante.matricula == "MED-4321"


@pytest.mark.parametrize("estado", ["PROCESADO", "PENDIENTE_AUDITORIA", "AUDITADO"])
async def test_documento_id_repetido_es_rechazado(db, oci, estado):
    queue_ingest(db, existing=estado)
    with pytest.raises(DocumentAlreadyExistsError):
        await ingest_document(_payload(), db)
    assert oci.uploaded == {}


async def test_ingest_registra_quien_subio_el_documento(db, oci):
    queue_ingest(db)
    user = make_user(UserRole.OPERADOR, username="operador")
    doc = await ingest_document(_payload(), db, uploaded_by=user)

    assert doc.uploaded_by_id == user.id
    assert doc.raw_extracted_json["triaje"]["uploaded_by_username"] == "operador"
    assert doc.raw_extracted_json["triaje"]["motivos_auditoria"] == []

async def test_invalid_base64_raises(db, oci):
    payload = _payload(archivo_base64="###no-es-base64###")
    with pytest.raises(InvalidBase64Error):
        await ingest_document(payload, db)
    assert oci.uploaded == {}


async def test_ingest_uploads_binary_and_json_and_persists(db, oci):
    queue_ingest(db)  # no existe un documento previo
    doc = await ingest_document(_payload(), db)

    assert set(oci.uploaded) == {
        "recibidos/DOC-TEST-1/0.pdf",
        "procesados/urgente/DOC-TEST-1.json",
    }
    assert doc.estado == "PROCESADO"
    assert doc.medico_rut == "9.876.543-2"
    assert doc.oci_bucket_name == "test-bucket"
    assert db.commits == 1

    # El detalle clínico del payload por defecto (examenes_y_laboratorio con un panel
    # "Coagulacion" y un parámetro "Dimero D") queda normalizado en las tablas hijas.
    assert [a.oci_path for a in doc.attachments] == ["recibidos/DOC-TEST-1/0.pdf"]
    assert doc.medications == []
    assert [p.nombre_panel for p in doc.lab_panels] == ["Coagulacion"]
    assert [p.nombre for p in doc.lab_panels[0].parametros] == ["Dimero D"]
    assert doc.lab_panels[0].parametros[0].alterado is True
    assert doc.procedures == []


async def test_ingest_normaliza_medicamentos_y_procedimientos(db, oci):
    queue_ingest(db)
    payload = _payload(
        detalle_clinico={
            "medicamentos": [
                {"nombre": "Paracetamol", "dosis": "500mg", "duracion_tratamiento": "5 dias"},
                {"nombre": "Ibuprofeno", "dosis": "400mg"},
            ],
            "procedimientos_e_internacion": {
                "fecha_ingreso": "2026-03-10",
                "procedimientos_realizados": ["Drenaje pleural", "Toracocentesis"],
            },
        }
    )
    doc = await ingest_document(payload, db)

    assert [m.nombre for m in doc.medications] == ["Paracetamol", "Ibuprofeno"]
    assert doc.medications[0].dosis == "500mg"
    assert doc.lab_panels == []
    assert [p.descripcion for p in doc.procedures] == ["Drenaje pleural", "Toracocentesis"]


async def test_ingest_acepta_nota_atencion_ambulatoria(db, oci):
    queue_ingest(db)
    payload = _payload(
        detalle_clinico={
            "nota_atencion_ambulatoria": {
                "motivo_consulta": "Tumor de base de craneo y fosas nasales.",
                "anamnesis": "Paciente con obstruccion nasal bilateral progresiva.",
                "examen_fisico": "OD ok, OI tapon de cerumen se limpia, control ok.",
                "diagnostico_referencia": "Tumor Maligno De La Fosa Nasal",
                "diagnostico_atencion": "Tumor Maligno De La Fosa Nasal",
                "indicaciones": "Espera de informe de RMN, control con ORL con biopsia.",
            }
        }
    )
    doc = await ingest_document(payload, db)

    # No tiene tabla relacional propia (es texto libre 1:1): queda solo en raw_extracted_json.
    assert doc.medications == []
    assert doc.lab_panels == []
    assert doc.procedures == []
    assert (
        doc.raw_extracted_json["detalle_clinico"]["nota_atencion_ambulatoria"]["diagnostico_atencion"]
        == "Tumor Maligno De La Fosa Nasal"
    )


async def test_ingest_acepta_anatomia_patologica(db, oci):
    queue_ingest(db)
    payload = _payload(
        detalle_clinico={
            "anatomia_patologica": {
                "tipo_muestra": "Biopsia core mama izquierda",
                "diagnostico_histopatologico": "Carcinoma ductal infiltrante, grado histologico 2",
                "malignidad": True,
            }
        }
    )
    doc = await ingest_document(payload, db)

    # Texto libre 1:1, sin tabla relacional propia: queda solo en raw_extracted_json.
    assert doc.medications == []
    assert doc.lab_panels == []
    assert doc.procedures == []
    assert doc.raw_extracted_json["detalle_clinico"]["anatomia_patologica"]["malignidad"] is True


async def test_oci_failure_raises_and_compensates(db, oci):
    queue_ingest(db)
    oci.fail_on = ".json"
    with pytest.raises(DocumentIngestionError):
        await ingest_document(_payload(), db)
    assert oci.deleted == ["recibidos/DOC-TEST-1/0.pdf"]


async def test_db_failure_rolls_back_and_removes_uploads(db, oci):
    queue_ingest(db)
    db.fail_commit = SQLAlchemyError("boom")
    with pytest.raises(DocumentIngestionError):
        await ingest_document(_payload(), db)
    assert db.rollbacks == 1
    assert set(oci.deleted) == set(oci.uploaded)


async def test_json_guardado_referencia_binarios_sin_base64(db, oci):
    queue_ingest(db)
    doc = await ingest_document(_payload(), db)

    archivos = doc.raw_extracted_json["archivos"]
    assert archivos == [
        {"tipo_archivo": "PDF", "rol": "documento_principal", "ruta_oci": "recibidos/DOC-TEST-1/0.pdf"}
    ]
    assert b"archivo_base64" not in oci.uploaded["procesados/urgente/DOC-TEST-1.json"]


ESQUEMA_LICENCIA = {
    "type": "object",
    "properties": {
        "dias_reposo": {"type": "integer", "minimum": 1},
        "fecha_inicio": {"type": "string"},
    },
    "required": ["dias_reposo"],
}


def _licencia(campos: dict) -> IngestPayload:
    return _payload(
        clasificacion=_clasificacion("LICENCIA"),
        detalle_clinico={"campos_adicionales": campos},
    )


def test_campos_adicionales_validos_para_tipo_con_esquema():
    tipos = {**dict.fromkeys(CATALOGO_TIPOS), "LICENCIA": ESQUEMA_LICENCIA}
    p = _licencia({"dias_reposo": 7, "fecha_inicio": "2026-10-01"})
    assert _audit_reasons(p, tipos, set(CATALOGO_COLAS)) == []


def test_campos_adicionales_que_no_cumplen_el_esquema_van_a_auditoria():
    tipos = {**dict.fromkeys(CATALOGO_TIPOS), "LICENCIA": ESQUEMA_LICENCIA}
    motivos = _audit_reasons(_licencia({"dias_reposo": "siete"}), tipos, set(CATALOGO_COLAS))
    assert motivos == [
        "campos_adicionales no cumple el esquema del tipo 'LICENCIA': "
        "dias_reposo: 'siete' is not of type 'integer'"
    ]


def test_campos_adicionales_en_tipo_sin_esquema_van_a_auditoria():
    tipos = {**dict.fromkeys(CATALOGO_TIPOS), "LICENCIA": None}
    motivos = _audit_reasons(_licencia({"dias_reposo": 7}), tipos, set(CATALOGO_COLAS))
    assert motivos == [
        "detalle_clinico trae ['campos_adicionales'] pero el tipo 'LICENCIA' espera ningún bloque"
    ]
