"""Cambios de una corrección humana, para el historial del documento.

Compara los valores vigentes con los corregidos campo a campo (también dentro de listas y
grupos) y devuelve solo lo que cambió, cada uno con una etiqueta legible tomada del `title` del
esquema: `examenes_y_laboratorio.paneles[0].parametros[1].valor` ->
`Paneles 1 › Parámetros 2 › Valor`.
"""

import re
from functools import cache
from typing import Any

from pydantic import BaseModel, ValidationError

from app.features.documents.models import ClinicalDocument
from app.features.documents.schemas import DatosGeneralesExtract, DetalleClinicoExtract
from app.features.documents.service import normalizar_datos_generales

SEPARADOR_ETIQUETA = " › "

_PARTES_RUTA = re.compile(r"([^.\[\]]+)|\[(\d+)\]")

_ETIQUETAS_CLASIFICACION = {
    "tipo_documento": "Tipo de documento",
    "nivel_prioridad": "Prioridad clínica",
    "destino_enrutamiento": "Destino",
    "especialidad": "Especialidad",
}


# --- Etiquetas desde el esquema ---------------------------------------------


@cache
def _esquema(modelo: type[BaseModel]) -> dict[str, Any]:
    return modelo.model_json_schema()


def _humanizar(nombre: str) -> str:
    return nombre.replace("_", " ").strip().capitalize()


def _resolver(nodo: dict[str, Any], defs: dict[str, Any]) -> dict[str, Any]:
    """Sigue `$ref` y toma la opción no nula de `anyOf` (campos opcionales)."""
    for _ in range(5):  # tope defensivo ante esquemas recursivos
        if "$ref" in nodo:
            nodo = defs.get(nodo["$ref"].rsplit("/", 1)[-1], {})
        elif "anyOf" in nodo:
            opciones = [o for o in nodo["anyOf"] if o.get("type") != "null"]
            nodo = opciones[0] if opciones else {}
        else:
            break
    return nodo


def etiqueta_de_ruta(ruta: str, esquema: dict[str, Any], *, omitir_bloque: bool = False) -> str:
    """Etiqueta legible de una ruta (`a.b[0].c`) usando los `title` de las propiedades del JSON
    Schema (el `title` de un `$def` es el nombre de la clase y no se usa).

    `omitir_bloque`: no nombra el primer nivel cuando es un grupo (el bloque del tipo en el
    detalle clínico, cuyos campos ya se entienden solos); una lista de primer nivel sí se nombra.
    """
    defs = esquema.get("$defs", {})
    partes = _PARTES_RUTA.findall(ruta)
    nodo: dict[str, Any] = esquema
    textos: list[str] = []
    for posicion, (nombre, indice) in enumerate(partes):
        if indice:
            if textos:
                textos[-1] = f"{textos[-1]} {int(indice) + 1}"
            nodo = _resolver(_resolver(nodo, defs).get("items", {}), defs)
            continue
        propiedad = (_resolver(nodo, defs).get("properties") or {}).get(nombre) or {}
        nodo = propiedad
        siguiente_es_indice = posicion + 1 < len(partes) and bool(partes[posicion + 1][1])
        if omitir_bloque and posicion == 0 and len(partes) > 1 and not siguiente_es_indice:
            continue
        textos.append(propiedad.get("title") or _humanizar(nombre))
    return SEPARADOR_ETIQUETA.join(textos)


# --- Comparación -------------------------------------------------------------


def _vacio(valor: Any) -> bool:
    return valor is None or valor in ("", [], {})


def _aplanar(valor: Any, ruta: str, salida: dict[str, Any]) -> None:
    """`{"a": [{"b": 1}]}` -> `{"a[0].b": 1}`. Las listas de valores simples quedan enteras."""
    if isinstance(valor, dict):
        for clave, hijo in valor.items():
            _aplanar(hijo, f"{ruta}.{clave}" if ruta else clave, salida)
    elif isinstance(valor, list) and any(isinstance(item, (dict, list)) for item in valor):
        for indice, hijo in enumerate(valor):
            _aplanar(hijo, f"{ruta}[{indice}]", salida)
    else:
        salida[ruta] = valor


def _diferencias(
    antes: dict[str, Any], despues: dict[str, Any], esquema: dict[str, Any], *, omitir_bloque: bool = False
) -> list[dict[str, Any]]:
    planos_antes: dict[str, Any] = {}
    planos_despues: dict[str, Any] = {}
    _aplanar(antes, "", planos_antes)
    _aplanar(despues, "", planos_despues)

    cambios: list[dict[str, Any]] = []
    for ruta in dict.fromkeys([*planos_antes, *planos_despues]):
        valor_antes, valor_despues = planos_antes.get(ruta), planos_despues.get(ruta)
        if (_vacio(valor_antes) and _vacio(valor_despues)) or valor_antes == valor_despues:
            continue
        cambios.append(
            {
                "campo": ruta,
                "etiqueta": etiqueta_de_ruta(ruta, esquema, omitir_bloque=omitir_bloque),
                "antes": None if _vacio(valor_antes) else valor_antes,
                "despues": None if _vacio(valor_despues) else valor_despues,
            }
        )
    return cambios


def _normalizado(modelo: type[BaseModel], valor: Any) -> dict[str, Any]:
    """Valores vigentes pasados por el mismo modelo (y la misma normalización) que la corrección:
    así una diferencia de formato (clave ausente vs `null`, RUT con puntos, origen del CIE-10
    sin marcar) no aparece como cambio."""
    try:
        validado = modelo.model_validate(valor or {})
    except ValidationError:
        return valor if isinstance(valor, dict) else {}
    if isinstance(validado, DatosGeneralesExtract):
        normalizar_datos_generales(validado)
    return validado.model_dump(mode="json")


def cambios_de_correccion(
    document: ClinicalDocument,
    raw: dict[str, Any],
    nuevos: dict[str, Any],
    datos: DatosGeneralesExtract,
    detalle: DetalleClinicoExtract,
) -> list[dict[str, Any]]:
    """Lista de `{campo, etiqueta, antes, despues}` con todo lo que cambia la corrección.

    `nuevos` trae los campos de clasificación corregidos (tipo, prioridad, destino, especialidad).
    """
    cambios = [
        {
            "campo": campo,
            "etiqueta": etiqueta,
            "antes": getattr(document, campo),
            "despues": nuevos.get(campo),
        }
        for campo, etiqueta in _ETIQUETAS_CLASIFICACION.items()
        if (getattr(document, campo) or None) != (nuevos.get(campo) or None)
    ]
    cambios.extend(
        _diferencias(
            _normalizado(DatosGeneralesExtract, raw.get("datos_generales")),
            datos.model_dump(mode="json"),
            _esquema(DatosGeneralesExtract),
        )
    )
    cambios.extend(
        _diferencias(
            _normalizado(DetalleClinicoExtract, raw.get("detalle_clinico")),
            detalle.model_dump(mode="json"),
            _esquema(DetalleClinicoExtract),
            omitir_bloque=True,
        )
    )
    return cambios
