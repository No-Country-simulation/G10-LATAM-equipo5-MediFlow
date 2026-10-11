"""Esquema de los campos de cada tipo de documento: una sola fuente de verdad.

Para cada tipo activo se publica qué bloque de `detalle_clinico` le corresponde y el JSON Schema
de sus campos (con etiqueta en `title` y largo máximo en `maxLength`):

- tipos semilla con bloque propio: el esquema se genera del modelo Pydantic del bloque;
- tipos con `campos_extraccion` en el catálogo: ese JSON Schema, como `campos_adicionales`;
- RECETA, OTRO o un tipo sin campos: sin bloque propio.

Además van las listas comunes a todos los tipos (`medicamentos`, `examenes_solicitados`).

Lo consumen el **formulario de auditoría** (renderiza los campos según el tipo elegido), el
**detalle del documento** (etiquetas de los campos relevantes) y **n8n** (arma el prompt con
estos mismos campos). Así, agregar o renombrar un campo se hace en un solo lugar.
"""

import copy
from functools import cache
from typing import Any

from pydantic import BaseModel

from app.shared.schema_order import ordenado
from app.features.documents.schemas import (
    LISTAS_COMUNES,
    AnatomiaPatologicaDetail,
    DatosGeneralesExtract,
    ExamenesLaboratorioDetail,
    ExamenSolicitadoItem,
    InformeImagenologicoDetail,
    InterconsultaDetail,
    MedicamentoItem,
    NotaAtencionAmbulatoriaDetail,
    ProcedimientosInternacionDetail,
    ProtocoloOperatorioDetail,
    SolicitudProcedimientoDetail,
)

BLOQUE_CAMPOS_ADICIONALES = "campos_adicionales"

# Bloque propio de `detalle_clinico` de cada `codigo` de tipo semilla, con su modelo. RECETA no
# tiene bloque propio (su contenido son los `medicamentos`, lista común a todos los tipos); OTRO y
# los tipos creados desde el mantenedor tampoco (usan `campos_adicionales` si tienen esquema).
MODELO_POR_BLOQUE: dict[str, type[BaseModel]] = {
    "examenes_y_laboratorio": ExamenesLaboratorioDetail,
    "informe_imagenologico": InformeImagenologicoDetail,
    "solicitud_procedimiento": SolicitudProcedimientoDetail,
    "procedimientos_e_internacion": ProcedimientosInternacionDetail,
    "interconsulta": InterconsultaDetail,
    "anatomia_patologica": AnatomiaPatologicaDetail,
    "protocolo_operatorio": ProtocoloOperatorioDetail,
    "nota_atencion_ambulatoria": NotaAtencionAmbulatoriaDetail,
}
BLOQUE_POR_TIPO: dict[str, str] = {
    "LABORATORIO": "examenes_y_laboratorio",
    "IMAGENES": "informe_imagenologico",
    "SOLICITUD_PROCEDIMIENTO": "solicitud_procedimiento",
    "EPICRISIS": "procedimientos_e_internacion",
    "INTERCONSULTA": "interconsulta",
    "ANATOMIA_PATOLOGICA": "anatomia_patologica",
    "PROTOCOLO_OPERATORIO": "protocolo_operatorio",
    "NOTA_ATENCION": "nota_atencion_ambulatoria",
}
_MODELO_POR_LISTA: dict[str, type[BaseModel]] = {
    "medicamentos": MedicamentoItem,
    "examenes_solicitados": ExamenSolicitadoItem,
}
_TITULO_POR_LISTA = {"medicamentos": "Medicamentos", "examenes_solicitados": "Exámenes solicitados"}

_TIPOS_ESCALARES = {"string", "integer", "number", "boolean"}


def _simplificar(nodo: Any, definiciones: dict[str, Any]) -> Any:
    """Resuelve los `$ref` y reduce `anyOf: [X, null]` (campos opcionales) a `X`.

    Pydantic genera un esquema correcto pero verboso; el formulario y el prompt necesitan uno
    plano y autocontenido.
    """
    if isinstance(nodo, list):
        return [_simplificar(n, definiciones) for n in nodo]
    if not isinstance(nodo, dict):
        return nodo
    if "$ref" in nodo:
        # El `title` de la definición es el nombre de la clase (ruido); el del campo, si lo hay, se
        # conserva porque es la etiqueta legible ("Paciente", "Identificación").
        resuelto = copy.deepcopy(definiciones[nodo["$ref"].rsplit("/", 1)[-1]])
        resuelto.pop("title", None)
        return _simplificar({**resuelto, **{k: v for k, v in nodo.items() if k != "$ref"}}, definiciones)
    if "anyOf" in nodo:
        no_nulos = [o for o in nodo["anyOf"] if o.get("type") != "null"]
        if len(no_nulos) == 1:
            resto = {k: v for k, v in nodo.items() if k != "anyOf"}
            return _simplificar({**no_nulos[0], **resto}, definiciones)
    # Las descripciones son docstrings: ruido para el formulario y tokens extra en el prompt.
    return {
        clave: _simplificar(valor, definiciones)
        for clave, valor in nodo.items()
        if clave not in {"$defs", "default", "description"}
    }


@cache
def esquema_de_modelo(modelo: type[BaseModel]) -> dict[str, Any]:
    """JSON Schema plano (sin `$ref`) del modelo, con títulos en español y `maxLength`."""
    esquema = modelo.model_json_schema()
    esquema.pop("title", None)  # nombre de la clase
    return _simplificar(esquema, esquema.get("$defs", {}))


def esquema_datos_generales() -> dict[str, Any]:
    """Esquema de `datos_generales` (paciente, profesionales, diagnósticos...): común a todos los tipos."""
    return esquema_de_modelo(DatosGeneralesExtract)


def esquemas_listas_comunes() -> dict[str, dict[str, Any]]:
    """Esquema de cada lista común (arreglo de objetos) que admite cualquier tipo."""
    return {
        nombre: {
            "type": "array",
            "title": _TITULO_POR_LISTA[nombre],
            "items": esquema_de_modelo(_MODELO_POR_LISTA[nombre]),
        }
        for nombre in LISTAS_COMUNES
    }


def formulario_de_tipo(codigo: str, campos_extraccion: dict[str, Any] | None) -> tuple[str | None, dict | None]:
    """(nombre del bloque, JSON Schema de sus campos) del tipo; `(None, None)` si no tiene bloque."""
    bloque = BLOQUE_POR_TIPO.get(codigo)
    if bloque:
        return bloque, esquema_de_modelo(MODELO_POR_BLOQUE[bloque])
    if campos_extraccion:
        return BLOQUE_CAMPOS_ADICIONALES, ordenado(copy.deepcopy(campos_extraccion))
    return None, None


def campos_escalares(bloque: str) -> list[tuple[str, str]]:
    """(campo, etiqueta) de los campos de texto, fecha o sí/no del bloque, en orden de declaración.

    Las listas (paneles, procedimientos) no se incluyen: tienen su propia tabla.
    """
    modelo = MODELO_POR_BLOQUE.get(bloque)
    if modelo is None:
        return []
    propiedades = esquema_de_modelo(modelo).get("properties", {})
    return [
        (nombre, definicion.get("title") or nombre)
        for nombre, definicion in propiedades.items()
        if definicion.get("type") in _TIPOS_ESCALARES
    ]
