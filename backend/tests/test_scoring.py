import pytest

from app.features.documents.schemas import DetalleClinicoExtract, EvaluacionExtract
from app.features.documents.scoring import HallazgosCalidad, calcular_score

COMPLETO = HallazgosCalidad(tiene_nombre=True, tiene_identificacion=True)
LAB = DetalleClinicoExtract.model_validate(
    {"examenes_y_laboratorio": {"paneles": [{"nombre_panel": "Hemograma", "parametros": [{"nombre": "Hb"}]}]}}
)


def _evaluacion(**overrides) -> EvaluacionExtract:
    return EvaluacionExtract.model_validate({"legibilidad": "alta", "certeza_tipo": "alta", **overrides})


def test_sin_evaluacion_usa_el_score_del_llm():
    assert calcular_score("LABORATORIO", None, 0.876, LAB, COMPLETO).score == 0.876
    assert calcular_score("LABORATORIO", None, None, LAB, COMPLETO).score == 0.0


def test_documento_claro_y_completo_supera_el_umbral():
    resultado = calcular_score("LABORATORIO", _evaluacion(), 0.5, LAB, COMPLETO)
    assert resultado.score == 0.95
    assert resultado.motivos == []


@pytest.mark.parametrize(
    ("certeza", "legibilidad", "esperado"),
    [("alta", "media", 0.874), ("media", "alta", 0.8), ("baja", "baja", 0.45)],
)
def test_base_y_legibilidad(certeza, legibilidad, esperado):
    resultado = calcular_score(
        "LABORATORIO", _evaluacion(certeza_tipo=certeza, legibilidad=legibilidad), None, LAB, COMPLETO
    )
    assert resultado.score == esperado


def test_descuentos_por_datos_faltantes_e_invalidos_dejan_motivo():
    hallazgos = HallazgosCalidad(
        tiene_nombre=False,
        tiene_identificacion=True,
        identificacion_invalida="Identificación RUT con formato o dígito verificador inválido",
        cie10_descartados=1,
    )
    resultado = calcular_score("LABORATORIO", _evaluacion(), None, LAB, hallazgos)
    assert resultado.score == round(0.95 - 0.15 - 0.15 - 0.05, 3)
    assert resultado.motivos == [
        "No se identificó el nombre del paciente",
        "Identificación RUT con formato o dígito verificador inválido",
        "1 código(s) CIE-10 con formato inválido descartado(s)",
    ]


def test_contenido_minimo_por_tipo():
    vacio = DetalleClinicoExtract()
    resultado = calcular_score("RECETA", _evaluacion(), None, vacio, COMPLETO)
    assert resultado.score == 0.8
    assert resultado.motivos == ["El documento RECETA no trae ningún medicamento"]
    # Un tipo sin regla de contenido mínimo no se descuenta.
    assert calcular_score("CERTIFICADO_MEDICO", _evaluacion(), None, vacio, COMPLETO).score == 0.95


def test_campos_dudosos_tienen_tope():
    dudosos = [f"campo_{i}" for i in range(10)]
    resultado = calcular_score("LABORATORIO", _evaluacion(campos_dudosos=dudosos), None, LAB, COMPLETO)
    assert resultado.score == 0.8  # 0.95 - tope de 0.15


def test_documentos_multiples_y_no_clinico_limitan_el_score():
    multiples = calcular_score("LABORATORIO", _evaluacion(documentos_multiples=True), None, LAB, COMPLETO)
    assert multiples.score == 0.6
    no_clinico = calcular_score("LABORATORIO", _evaluacion(es_documento_clinico=False), None, LAB, COMPLETO)
    assert no_clinico.score == 0.5


def test_el_score_nunca_es_negativo():
    hallazgos = HallazgosCalidad(tiene_nombre=False, tiene_identificacion=False, identificacion_invalida="x")
    evaluacion = _evaluacion(certeza_tipo="baja", legibilidad="baja", campos_dudosos=["a"] * 5)
    assert calcular_score("RECETA", evaluacion, None, DetalleClinicoExtract(), hallazgos).score == 0.0
