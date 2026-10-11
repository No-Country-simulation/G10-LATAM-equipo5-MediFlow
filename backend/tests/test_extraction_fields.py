"""Los campos tolerantes evitan que un dato raro del LLM haga fallar toda la ingesta."""

from datetime import date

import pytest

from app.features.documents.schemas import (
    DatosGeneralesExtract,
    DetalleClinicoExtract,
    EvaluacionExtract,
    PacienteExtract,
)


@pytest.mark.parametrize("vacio", ["NO DISPONIBLE", "no aplica", "N/A", "-", "[[F25_op]]", "____", "   "])
def test_marcadores_de_sin_dato_quedan_en_none(vacio):
    assert PacienteExtract.model_validate({"nombre": vacio, "numero_ficha": vacio}).nombre is None


def test_no_es_un_dato_valido():
    """"No" (ej. complicaciones: No) es información clínica y no debe perderse."""
    detalle = DetalleClinicoExtract.model_validate({"protocolo_operatorio": {"complicaciones": "No"}})
    assert detalle.protocolo_operatorio.complicaciones == "No"


def test_texto_largo_se_recorta_en_vez_de_rechazar():
    paciente = PacienteExtract.model_validate({"nombre": "x" * 500})
    assert len(paciente.nombre) == 150


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [("36 años", 36), ("5", 5), (58.0, 58), ("3a 5m 20d", 3), ("ciento", None), (250, None), (True, None)],
)
def test_edad(valor, esperado):
    assert PacienteExtract.model_validate({"edad": valor}).edad == esperado


@pytest.mark.parametrize(
    ("valor", "esperado"),
    [
        ("2026-03-24", date(2026, 3, 24)),
        ("24/03/2026", date(2026, 3, 24)),
        ("24-03-2026", date(2026, 3, 24)),
        ("2026-03-24T10:00:00", date(2026, 3, 24)),
        ("9.9.26", None),  # año corto: ambiguo, mejor sin dato
        ("mañana", None),
    ],
)
def test_fechas(valor, esperado):
    assert DatosGeneralesExtract.model_validate({"fecha_documento": valor}).fecha_documento == esperado


def test_categorias_con_sinonimos_y_valor_por_defecto():
    datos = DatosGeneralesExtract.model_validate(
        {
            "paciente": {"sexo": "Masculino", "identificacion": {"tipo": "run", "numero": "1"}},
            "profesionales": [{"nombre": "Dra. X", "rol": "firmante"}, {"nombre": "Dr. Y", "rol": "???"}],
            "diagnosticos": [{"descripcion": "Asma", "tipo": "principal", "certeza": "sospecha"}],
        }
    )
    assert datos.paciente.sexo == "M"
    assert datos.paciente.identificacion.tipo == "RUT"
    assert [p.rol for p in datos.profesionales] == ["INFORMANTE", "OTRO"]
    assert (datos.diagnosticos[0].tipo, datos.diagnosticos[0].certeza) == ("PRINCIPAL", "PRESUNTIVO")


def test_listas_nulas_o_excesivas():
    datos = DatosGeneralesExtract.model_validate({"profesionales": None, "diagnosticos": [{}] * 50})
    assert datos.profesionales == []
    assert len(datos.diagnosticos) == 20


def test_evaluacion_desconocida_es_conservadora():
    evaluacion = EvaluacionExtract.model_validate({"legibilidad": "MEDIA", "certeza_tipo": "quizás"})
    assert (evaluacion.legibilidad, evaluacion.certeza_tipo) == ("media", "baja")


def test_diagnostico_principal_por_defecto_es_el_primero():
    datos = DatosGeneralesExtract.model_validate({"diagnosticos": [{"descripcion": "A"}, {"descripcion": "B"}]})
    assert datos.diagnostico_principal.descripcion == "A"
    assert DatosGeneralesExtract().diagnostico_principal is None


def test_parametro_de_laboratorio_acepta_si_no():
    detalle = DetalleClinicoExtract.model_validate(
        {"examenes_y_laboratorio": {"paneles": [{"parametros": [{"nombre": "K", "alterado": "Sí", "critico": "no"}]}]}}
    )
    parametro = detalle.examenes_y_laboratorio.paneles[0].parametros[0]
    assert (parametro.alterado, parametro.critico) == (True, False)
