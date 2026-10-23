import base64

import pytest
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.features.auth.enums import UserRole
from app.features.documents.schemas import IngestPayload
from app.features.documents.service import (
    DocumentAlreadyExistsError,
    DocumentIngestionError,
    InvalidBase64Error,
    InvalidTextFileError,
    _audit_reasons,
    _resolve_routing,
    ingest_document,
    preparar_extraccion,
)
from tests.conftest import CATALOGO_COLAS, CATALOGO_TIPOS, ingest_body, make_user, queue_ingest


def _payload(**kwargs) -> IngestPayload:
    return IngestPayload.model_validate(ingest_body(**kwargs))


def _triage(p: IngestPayload) -> tuple[tuple[str, str, bool], list[str]]:
    p.documento_id = "D1"
    preparada = preparar_extraccion(p)
    motivos = _audit_reasons(preparada, dict.fromkeys(CATALOGO_TIPOS), set(CATALOGO_COLAS))
    return _resolve_routing(preparada, motivos), motivos


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
        "detalle_clinico trae ['interconsulta'] pero el tipo 'RECETA' espera ningún bloque propio"
    ]


def test_nivel_prioridad_fuera_de_valores_es_rechazado():
    body = ingest_body()
    body["clasificacion"]["nivel_prioridad"] = "Alta"
    with pytest.raises(ValidationError):
        IngestPayload.model_validate(body)


@pytest.mark.parametrize("tipo", ["DCM", "TIFF", "IMAGEN"])
def test_tipo_archivo_no_admitido_es_rechazado(tipo):
    with pytest.raises(ValidationError):
        _payload(tipo_archivo=tipo)


def test_profesional_admite_identificacion_y_registro():
    profesional = _payload().datos_generales.profesionales[0]
    assert profesional.identificacion == "9.876.543-2"
    assert profesional.registro_profesional == "MED-4321"
    assert profesional.rol == "SOLICITANTE"


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


@pytest.mark.parametrize(
    ("tipo", "contenido", "ruta", "content_type"),
    [
        ("TXT", "Epicrisis: paciente con disnea, saturación 88%", "0.txt", "text/plain; charset=utf-8"),
        ("JSON", '{"paciente": "José Peña", "diagnostico": "I26.9"}', "0.json", "application/json; charset=utf-8"),
    ],
)
async def test_ingest_archivo_de_texto(db, oci, tipo, contenido, ruta, content_type):
    queue_ingest(db)
    archivo = base64.b64encode(contenido.encode("utf-8")).decode()
    doc = await ingest_document(_payload(tipo_archivo=tipo, archivo_base64=archivo), db)

    path = f"recibidos/DOC-TEST-1/{ruta}"
    assert oci.uploaded[path] == contenido.encode("utf-8")
    assert oci.content_types[path] == content_type
    assert [(a.tipo_archivo, a.oci_path) for a in doc.attachments] == [(tipo, path)]


@pytest.mark.parametrize(
    ("tipo", "contenido"),
    [
        ("TXT", "Epicrisis de Peña".encode("latin-1")),  # no es UTF-8
        ("JSON", b'{"paciente": '),  # JSON cortado
        ("JSON", "texto suelto".encode("utf-8")),
    ],
)
async def test_ingest_archivo_de_texto_invalido_es_rechazado(db, oci, tipo, contenido):
    payload = _payload(tipo_archivo=tipo, archivo_base64=base64.b64encode(contenido).decode())
    with pytest.raises(InvalidTextFileError):
        await ingest_document(payload, db)
    assert oci.uploaded == {}


async def test_ingest_archivo_de_texto_muy_grande_es_rechazado(db, oci, monkeypatch):
    monkeypatch.setattr(settings, "INGEST_MAX_TEXT_FILE_MB", 0)
    payload = _payload(tipo_archivo="TXT", archivo_base64=base64.b64encode(b"x").decode())
    with pytest.raises(InvalidTextFileError, match="supera el límite"):
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
    assert doc.medico_identificacion == "9.876.543-2"
    assert doc.identificacion_paciente == "12345678-5"  # normalizado
    assert doc.tipo_identificacion == "RUT"
    assert doc.numero_ficha == "43805"
    assert doc.cie10_sugerido == "I26.9"
    assert [d.cie10 for d in doc.diagnoses] == ["I26.9"]
    assert [p.rol for p in doc.professionals] == ["SOLICITANTE"]
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
    assert _audit_reasons(preparar_extraccion(p), tipos, set(CATALOGO_COLAS)) == []


def test_campos_adicionales_que_no_cumplen_el_esquema_van_a_auditoria():
    tipos = {**dict.fromkeys(CATALOGO_TIPOS), "LICENCIA": ESQUEMA_LICENCIA}
    motivos = _audit_reasons(preparar_extraccion(_licencia({"dias_reposo": "siete"})), tipos, set(CATALOGO_COLAS))
    assert motivos == [
        "campos_adicionales no cumple el esquema del tipo 'LICENCIA': "
        "dias_reposo: 'siete' is not of type 'integer'"
    ]


def test_campos_adicionales_en_tipo_sin_esquema_van_a_auditoria():
    tipos = {**dict.fromkeys(CATALOGO_TIPOS), "LICENCIA": None}
    motivos = _audit_reasons(preparar_extraccion(_licencia({"dias_reposo": 7})), tipos, set(CATALOGO_COLAS))
    assert motivos == [
        "detalle_clinico trae ['campos_adicionales'] pero el tipo 'LICENCIA' espera ningún bloque propio"
    ]


# --- Contrato v2: autoevaluación, normalización y score ----------------------

EVALUACION_CLARA = {"legibilidad": "alta", "certeza_tipo": "alta", "evidencia_tipo": "Informe de resultados"}


async def test_score_se_calcula_con_la_autoevaluacion(db, oci):
    queue_ingest(db)
    # El LLM dice 0.5, pero el documento es legible, completo y de tipo claro.
    doc = await ingest_document(_payload(score=0.5, evaluacion=EVALUACION_CLARA), db)

    assert doc.estado == "PROCESADO"
    assert float(doc.score_confianza) == 0.95
    triaje = doc.raw_extracted_json["triaje"]
    assert (triaje["score_confianza"], triaje["score_ia"]) == (0.95, 0.5)


async def test_identificacion_invalida_y_cie10_invalido_van_a_auditoria_con_motivos(db, oci):
    queue_ingest(db)
    body = ingest_body(evaluacion=EVALUACION_CLARA)
    body["datos_generales"]["paciente"]["identificacion"]["numero"] = "12.345.678-9"  # DV incorrecto
    body["datos_generales"]["diagnosticos"][0]["cie10"] = "TEP"
    doc = await ingest_document(IngestPayload.model_validate(body), db)

    assert doc.estado == "PENDIENTE_AUDITORIA"
    assert doc.motivos_auditoria == [
        "Score de confianza 0.75 menor al umbral 0.85",
        "Identificación RUT con formato o dígito verificador inválido",
        "1 código(s) CIE-10 con formato inválido descartado(s)",
    ]
    assert doc.cie10_sugerido is None


async def test_valor_critico_de_laboratorio_eleva_la_prioridad(db, oci):
    queue_ingest(db)
    body = ingest_body(evaluacion=EVALUACION_CLARA)
    body["clasificacion"]["nivel_prioridad"] = "Rutina"
    parametro = body["detalle_clinico"]["examenes_y_laboratorio"]["paneles"][0]["parametros"][0]
    parametro.update(nombre="Potasio", critico=True)
    doc = await ingest_document(IngestPayload.model_validate(body), db)

    assert doc.nivel_prioridad == "Urgente"
    assert doc.oci_json_path == "procesados/urgente/DOC-TEST-1.json"
    assert doc.raw_extracted_json["triaje"]["ajustes"] == [
        "Prioridad elevada a Urgente por valor crítico en: Potasio"
    ]


async def test_medicamentos_de_cualquier_tipo_y_examenes_solicitados_se_normalizan(db, oci):
    queue_ingest(db)
    payload = _payload(
        clasificacion={**_clasificacion("EPICRISIS")},
        detalle_clinico={
            "procedimientos_e_internacion": {"resumen_evolucion": "Circuncisión sin complicaciones"},
            "medicamentos": [
                {"nombre": "Ibuprofeno", "dosis": "10 cc", "frecuencia": "cada 8 horas", "via": "oral"},
                {"nombre": None, "dosis": "sin nombre: se omite"},
            ],
            "examenes_solicitados": [{"codigo": "0301045", "nombre": "Hemograma", "categoria": "laboratorio"}],
        },
    )
    doc = await ingest_document(payload, db)

    assert [(m.nombre, m.frecuencia, m.via) for m in doc.medications] == [("Ibuprofeno", "cada 8 horas", "oral")]
    assert [(e.codigo, e.nombre, e.categoria) for e in doc.requested_exams] == [
        ("0301045", "Hemograma", "LABORATORIO")
    ]


async def test_cie10_impreso_en_el_documento_conserva_su_origen(db, oci):
    queue_ingest(db)
    body = ingest_body()
    body["datos_generales"]["diagnosticos"] = [
        {"descripcion": "Fimosis", "cie10": "n47", "origen_cie10": "DOCUMENTO"},
        {"descripcion": "Control", "cie10": None},
    ]
    doc = await ingest_document(IngestPayload.model_validate(body), db)

    assert (doc.diagnostico_principal, doc.cie10_sugerido, doc.cie10_origen) == ("Fimosis", "N47", "DOCUMENTO")
    assert [(d.tipo, d.origen_cie10) for d in doc.diagnoses] == [("PRINCIPAL", "DOCUMENTO"), ("SECUNDARIO", None)]


async def test_profesional_responsable_prioriza_al_informante(db, oci):
    queue_ingest(db)
    body = ingest_body()
    body["datos_generales"]["profesionales"] = [
        {"nombre": "Dr. Solicitante", "rol": "SOLICITANTE"},
        {"nombre": "Dra. Radióloga", "identificacion": "15.691.648-K", "rol": "INFORMANTE"},
    ]
    doc = await ingest_document(IngestPayload.model_validate(body), db)
    assert (doc.medico_nombre, doc.medico_identificacion) == ("Dra. Radióloga", "15.691.648-K")


async def test_paciente_sin_identificacion_nacional_usa_la_ficha(db, oci):
    queue_ingest(db)
    body = ingest_body(evaluacion=EVALUACION_CLARA)
    body["datos_generales"]["paciente"] = {"nombre": "Paciente de México", "numero_ficha": "EXP-991"}
    doc = await ingest_document(IngestPayload.model_validate(body), db)

    assert doc.estado == "PROCESADO"  # sin cédula pero con N° de expediente: no se descuenta
    assert (doc.identificacion_paciente, doc.numero_ficha) == (None, "EXP-991")
