"""Normalización y validación de identificadores de pacientes y códigos CIE-10.

MediFlow recibe documentos de distintos países: el paciente puede venir identificado con RUT/RUN
(Chile), DNI (Argentina, Perú, España), CURP (México), CPF (Brasil), cédula, pasaporte u otro
número. Aquí se normaliza el formato (sin puntos ni espacios, en mayúsculas) y, cuando el
documento tiene dígito verificador, se valida: un dígito incorrecto suele ser un error de lectura
del LLM (escaneos o manuscritos) y baja el puntaje de confianza.

Funciones puras, sin dependencias: las usan la ingesta y la resolución de auditoría.
"""

import re
import unicodedata
from dataclasses import dataclass

TIPOS_IDENTIFICACION: tuple[str, ...] = ("RUT", "DNI", "CURP", "CEDULA", "CPF", "PASAPORTE", "OTRO")

_RUT = re.compile(r"^(\d{6,8})([0-9K])$")
_CURP = re.compile(r"^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{5}[0-9A-Z]\d$")
_DNI_ESPANA = re.compile(r"^(\d{8})([A-Z])$")
_SOLO_DIGITOS = re.compile(r"^\d+$")
_ALFANUMERICO = re.compile(r"^[A-Z0-9]{4,20}$")
_CIE10 = re.compile(r"^([A-Z]\d{2})(?:\.?([0-9A-Z]{1,4}))?$")

_LETRAS_DNI_ESPANA = "TRWAGMYFPDXBNJZSQVHLCKE"

# Nombres de país que el LLM suele devolver en lugar del código ISO 3166-1 alfa-2.
_PAISES = {
    "CHILE": "CL",
    "ARGENTINA": "AR",
    "PERU": "PE",
    "MEXICO": "MX",
    "COLOMBIA": "CO",
    "ECUADOR": "EC",
    "URUGUAY": "UY",
    "PARAGUAY": "PY",
    "BOLIVIA": "BO",
    "VENEZUELA": "VE",
    "BRASIL": "BR",
    "BRAZIL": "BR",
    "ESPANA": "ES",
    "SPAIN": "ES",
    "COSTA RICA": "CR",
    "PANAMA": "PA",
    "GUATEMALA": "GT",
    "HONDURAS": "HN",
    "EL SALVADOR": "SV",
    "NICARAGUA": "NI",
    "CUBA": "CU",
    "REPUBLICA DOMINICANA": "DO",
    "HAITI": "HT",
    "ESTADOS UNIDOS": "US",
    "USA": "US",
}


@dataclass(frozen=True)
class Identificacion:
    """Identificación normalizada. `valida` es `None` si el tipo no tiene dígito verificador."""

    tipo: str
    numero: str
    valida: bool | None


def _sin_tildes(texto: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def normalizar_pais(pais: str | None) -> str | None:
    """Código ISO 3166-1 alfa-2 (`CL`, `MX`, ...) a partir del código o del nombre del país."""
    if not pais:
        return None
    limpio = _sin_tildes(pais).strip().upper()
    if len(limpio) == 2 and limpio.isalpha():
        return limpio
    return _PAISES.get(limpio)


def _compactar(numero: str) -> str:
    return re.sub(r"[\s.\-_/]", "", numero).upper()


def digito_verificador_rut(cuerpo: str) -> str:
    """Dígito verificador del RUT/RUN chileno (módulo 11)."""
    suma, factor = 0, 2
    for digito in reversed(cuerpo):
        suma += int(digito) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - suma % 11
    return {11: "0", 10: "K"}.get(resto, str(resto))


def _cpf_valido(digitos: str) -> bool:
    if len(digitos) != 11 or len(set(digitos)) == 1:
        return False
    for posicion in (9, 10):
        suma = sum(int(d) * (posicion + 1 - i) for i, d in enumerate(digitos[:posicion]))
        if (suma * 10 % 11) % 10 != int(digitos[posicion]):
            return False
    return True


def _validar_rut(compacto: str) -> Identificacion:
    match = _RUT.match(compacto)
    if not match:
        return Identificacion("RUT", compacto, False)
    cuerpo, dv = match.groups()
    return Identificacion("RUT", f"{cuerpo}-{dv}", digito_verificador_rut(cuerpo) == dv)


def _validar_dni(compacto: str) -> Identificacion:
    espana = _DNI_ESPANA.match(compacto)
    if espana:
        cuerpo, letra = espana.groups()
        return Identificacion("DNI", compacto, _LETRAS_DNI_ESPANA[int(cuerpo) % 23] == letra)
    # Argentina (7-8 dígitos), Perú (8): sin dígito verificador, solo se valida el formato.
    if _SOLO_DIGITOS.match(compacto):
        return Identificacion("DNI", compacto, 6 <= len(compacto) <= 9)
    return Identificacion("DNI", compacto, False)


def _parece_rut_valido(compacto: str) -> bool:
    match = _RUT.match(compacto)
    return bool(match) and digito_verificador_rut(match.group(1)) == match.group(2)


def normalizar_identificacion(tipo: str | None, numero: str | None) -> Identificacion | None:
    """Normaliza el número según su tipo y valida el dígito verificador cuando existe.

    Si el tipo es desconocido (`OTRO` o vacío) pero el número es un RUT con dígito verificador
    correcto, se reconoce como RUT: muchos formularios chilenos lo rotulan "Número de documento".
    """
    if not numero or not numero.strip():
        return None
    compacto = _compactar(numero)
    tipo_normalizado = tipo if tipo in TIPOS_IDENTIFICACION else "OTRO"

    if tipo_normalizado == "OTRO" and _parece_rut_valido(compacto):
        tipo_normalizado = "RUT"

    if tipo_normalizado == "RUT":
        return _validar_rut(compacto)
    if tipo_normalizado == "DNI":
        return _validar_dni(compacto)
    if tipo_normalizado == "CURP":
        return Identificacion("CURP", compacto, bool(_CURP.match(compacto)))
    if tipo_normalizado == "CPF":
        return Identificacion("CPF", compacto, _cpf_valido(compacto))
    # Cédulas de otros países, pasaporte u otro número: sin regla común, solo se acota el formato.
    return Identificacion(tipo_normalizado, compacto, None if _ALFANUMERICO.match(compacto) else False)


def normalizar_cie10(codigo: str | None) -> str | None:
    """Código CIE-10 en formato canónico (`J45.9`, `N47`); `None` si no tiene formato válido.

    Acepta variantes frecuentes del LLM o del documento: minúsculas, sin punto (`J459`),
    con espacios o con las marcas de doble codificación (`†`, `*`).
    """
    if not codigo:
        return None
    limpio = re.sub(r"[\s†*]", "", codigo).upper()
    match = _CIE10.match(limpio)
    if not match:
        return None
    categoria, subcategoria = match.groups()
    return f"{categoria}.{subcategoria}" if subcategoria else categoria
