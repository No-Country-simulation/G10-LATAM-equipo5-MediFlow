"""Tipos de campo tolerantes para lo que extrae el LLM.

Un documento clínico real trae de todo: "NO DISPONIBLE", "NO APLICA", plantillas sin completar
(`[[F25_op]]`), fechas en formato local (`24/03/2026`), edades como texto ("36 años") o una
categoría escrita distinto ("Masculino"). Si cada caso respondiera `422`, un solo campo raro
haría fallar la ingesta completa. Estos tipos **normalizan** el valor y, si no es interpretable,
lo dejan en `None`; los problemas de calidad se reflejan en el puntaje de confianza.

Los largos máximos coinciden con las columnas de la base de datos: el texto se recorta en vez de
romper el `INSERT`. Se publican como `maxLength` en el JSON Schema, que usa el formulario de
auditoría para elegir entre un campo de una línea y un área de texto.
"""

import re
from collections.abc import Callable, Iterable
from datetime import date, datetime
from typing import Annotated, Any

from pydantic import BeforeValidator, Field

# Textos que en un documento significan "sin dato".
_VALORES_VACIOS = {
    "",
    "-",
    "--",
    "---",
    ".",
    "N/A",
    "NA",
    "N/D",
    "ND",
    "NULL",
    "NONE",
    "S/I",
    "S/D",
    "NO DISPONIBLE",
    "NO APLICA",
    "NO INFORMA",
    "NO REGISTRA",
    "SIN DATO",
    "SIN DATOS",
    "SIN INFORMACION",
    "SIN INFORMACIÓN",
    "DESCONOCIDO",
}
_PLANTILLA = re.compile(r"^\[\[.*\]\]$|^_+$|^\{\{.*\}\}$")
_FORMATOS_FECHA = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y/%m/%d")
_EDAD_MAXIMA = 130


def limpiar_texto(value: Any, max_len: int) -> str | None:
    """Texto recortado a `max_len`; `None` si está vacío o es un marcador de "sin dato"."""
    if value is None or isinstance(value, (dict, list)):
        return None
    texto = re.sub(r"[ \t]+", " ", str(value)).strip()
    if texto.upper() in _VALORES_VACIOS or _PLANTILLA.match(texto):
        return None
    return texto[:max_len]


def _texto(max_len: int) -> Callable[[Any], str | None]:
    return lambda value: limpiar_texto(value, max_len)


def _texto_campo(max_len: int):
    return Annotated[
        str | None,
        BeforeValidator(_texto(max_len)),
        Field(json_schema_extra={"maxLength": max_len}),
    ]


TextoCorto = _texto_campo(150)
TextoMedio = _texto_campo(500)
TextoLargo = _texto_campo(4000)


def texto_de(max_len: int):
    """Texto opcional acotado a `max_len` (para columnas de largo específico)."""
    return _texto_campo(max_len)


def _fecha(value: Any) -> date | None:
    if value is None or isinstance(value, date):
        return value
    texto = limpiar_texto(value, 30)
    if texto is None:
        return None
    for formato in _FORMATOS_FECHA:
        try:
            return datetime.strptime(texto[:10], formato).date()
        except ValueError:
            continue
    return None


Fecha = Annotated[date | None, BeforeValidator(_fecha)]


def _edad(value: Any) -> int | None:
    if value is None or isinstance(value, bool):
        return None
    match = re.search(r"\d+(?:[.,]\d+)?", str(value))
    if not match:
        return None
    edad = int(float(match.group().replace(",", ".")))
    return edad if 0 <= edad <= _EDAD_MAXIMA else None


Edad = Annotated[int | None, BeforeValidator(_edad)]


def _booleano(value: Any) -> bool | None:
    if value is None or isinstance(value, bool):
        return value
    texto = str(value).strip().upper()
    if texto in {"SI", "SÍ", "TRUE", "YES", "1", "X"}:
        return True
    if texto in {"NO", "FALSE", "0"}:
        return False
    return None


Booleano = Annotated[bool | None, BeforeValidator(_booleano)]


def opcion(
    opciones: Iterable[str], sinonimos: dict[str, str] | None = None, defecto: str | None = None
) -> Callable[[Any], str | None]:
    """Valida contra un conjunto cerrado tolerando mayúsculas y sinónimos; si no, `defecto`."""
    validas = {o.upper(): o for o in opciones}
    alias = {k.upper(): v for k, v in (sinonimos or {}).items()}

    def _validar(value: Any) -> str | None:
        if value is None:
            return defecto
        clave = str(value).strip().upper()
        return validas.get(clave) or alias.get(clave) or defecto

    return _validar


def lista_acotada(max_items: int) -> Callable[[Any], list[Any]]:
    """Lista recortada a `max_items` (un `null` del LLM se toma como lista vacía)."""

    def _recortar(value: Any) -> list[Any]:
        if value is None:
            return []
        return list(value)[:max_items] if isinstance(value, (list, tuple)) else value

    return _recortar
