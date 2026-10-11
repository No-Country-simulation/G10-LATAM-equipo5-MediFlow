import pytest

from app.features.documents.normalization import (
    digito_verificador_rut,
    normalizar_cie10,
    normalizar_identificacion,
    normalizar_pais,
)


@pytest.mark.parametrize(
    ("tipo", "numero", "esperado"),
    [
        ("RUT", "12.345.678-5", ("RUT", "12345678-5", True)),
        ("RUT", "11.111.111-2", ("RUT", "11111111-2", False)),  # dígito verificador incorrecto
        ("RUT", "7.012.997-k", ("RUT", "7012997-K", digito_verificador_rut("7012997") == "K")),
        ("RUT", "abc", ("RUT", "ABC", False)),
        # Rotulado como "Número de documento" (OTRO) pero con forma y DV de RUT: se reconoce.
        ("OTRO", "12.345.678-5", ("RUT", "12345678-5", True)),
        ("CURP", "gode561231hdfrrn09", ("CURP", "GODE561231HDFRRN09", True)),
        ("CURP", "GODE561231", ("CURP", "GODE561231", False)),
        ("CPF", "111.444.777-35", ("CPF", "11144477735", True)),
        ("CPF", "111.444.777-36", ("CPF", "11144477736", False)),
        ("CPF", "111.111.111-11", ("CPF", "11111111111", False)),  # dígitos repetidos
        ("DNI", "12345678Z", ("DNI", "12345678Z", True)),  # España: letra de control
        ("DNI", "12345678A", ("DNI", "12345678A", False)),
        ("DNI", "30.123.456", ("DNI", "30123456", True)),  # Argentina: sin dígito verificador
        ("DNI", "123", ("DNI", "123", False)),
        ("PASAPORTE", "AB 123456", ("PASAPORTE", "AB123456", None)),
        ("CEDULA", "1-0234-0567", ("CEDULA", "102340567", None)),
        ("INVENTADO", "XY12345", ("OTRO", "XY12345", None)),
    ],
)
def test_normalizar_identificacion(tipo, numero, esperado):
    resultado = normalizar_identificacion(tipo, numero)
    assert (resultado.tipo, resultado.numero, resultado.valida) == esperado


@pytest.mark.parametrize("numero", [None, "", "   "])
def test_identificacion_vacia_es_none(numero):
    assert normalizar_identificacion("RUT", numero) is None


@pytest.mark.parametrize(
    ("codigo", "esperado"),
    [
        ("J45.9", "J45.9"),
        ("j459", "J45.9"),
        ("N47", "N47"),
        (" n47 ", "N47"),
        ("G99.2*", "G99.2"),
        ("A18.0†", "A18.0"),
        ("C30.0", "C30.0"),
        ("S92.42", "S92.42"),
        ("XX1", None),
        ("123", None),
        ("", None),
        (None, None),
    ],
)
def test_normalizar_cie10(codigo, esperado):
    assert normalizar_cie10(codigo) == esperado


@pytest.mark.parametrize(
    ("pais", "esperado"),
    [("cl", "CL"), ("México", "MX"), ("Perú", "PE"), ("ESPAÑA", "ES"), ("Atlántida", None), (None, None)],
)
def test_normalizar_pais(pais, esperado):
    assert normalizar_pais(pais) == esperado
