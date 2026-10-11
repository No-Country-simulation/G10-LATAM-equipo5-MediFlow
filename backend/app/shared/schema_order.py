"""Orden de las propiedades de un JSON Schema guardado en PostgreSQL.

JSONB no conserva el orden de las claves de un objeto (las reordena por largo), pero sí el de los
arreglos. Para que el formulario de auditoría y el prompt de n8n muestren los campos en el orden en
que se definieron, cada objeto lleva su orden en `propertyOrdering` (la misma palabra clave que
entiende Gemini para el orden de salida).
"""

from typing import Any

ORDEN = "propertyOrdering"


def _hijos(nodo: dict[str, Any]) -> list[dict[str, Any]]:
    hijos = [v for v in (nodo.get("properties") or {}).values() if isinstance(v, dict)]
    if isinstance(nodo.get("items"), dict):
        hijos.append(nodo["items"])
    return hijos


def con_orden(esquema: Any) -> Any:
    """Agrega `propertyOrdering` (orden de definición) a cada objeto que no lo traiga."""
    if not isinstance(esquema, dict):
        return esquema
    propiedades = esquema.get("properties")
    if isinstance(propiedades, dict) and ORDEN not in esquema:
        esquema[ORDEN] = list(propiedades)
    for hijo in _hijos(esquema):
        con_orden(hijo)
    return esquema


def ordenado(esquema: Any) -> Any:
    """Reconstruye cada `properties` en el orden de `propertyOrdering` (las que falten, al final)."""
    if not isinstance(esquema, dict):
        return esquema
    propiedades = esquema.get("properties")
    if isinstance(propiedades, dict):
        orden = [p for p in esquema.get(ORDEN) or [] if p in propiedades]
        orden += [p for p in propiedades if p not in orden]
        esquema["properties"] = {p: propiedades[p] for p in orden}
    for hijo in _hijos(esquema):
        ordenado(hijo)
    return esquema
