"""Puntaje de confianza del documento, calculado por el backend con reglas explicables.

Un LLM es malo calificando su propia certeza con un número (tiende a responder 0.9 a todo). Por
eso n8n pide una **autoevaluación en categorías** (`evaluacion`: legibilidad, certeza del tipo,
campos dudosos, ...) y aquí se combina con validaciones objetivas del contenido:

    base (certeza del tipo) x factor (legibilidad) - descuentos (datos faltantes o inválidos)

Cada descuento deja un motivo legible ("Identificación RUT con dígito verificador inválido"),
que el auditor ve junto al puntaje. Sin `evaluacion` (payloads antiguos) se usa el score que
reportó el LLM.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

from app.features.documents.schemas import DetalleClinicoExtract, EvaluacionExtract

_BASE_POR_CERTEZA = {"alta": 0.95, "media": 0.8, "baja": 0.6}
_FACTOR_POR_LEGIBILIDAD = {"alta": 1.0, "media": 0.92, "baja": 0.75}

TOPE_NO_CLINICO = 0.5
TOPE_DOCUMENTOS_MULTIPLES = 0.6
DESCUENTO_SIN_NOMBRE = 0.15
DESCUENTO_SIN_IDENTIFICACION = 0.10
DESCUENTO_IDENTIFICACION_INVALIDA = 0.15
DESCUENTO_CIE10_INVALIDO = 0.05
DESCUENTO_SIN_CONTENIDO = 0.15
DESCUENTO_POR_CAMPO_DUDOSO = 0.03
DESCUENTO_MAXIMO_DUDOSOS = 0.15


def _tiene_parametros(detalle: DetalleClinicoExtract) -> bool:
    lab = detalle.examenes_y_laboratorio
    return bool(lab and any(panel.parametros for panel in lab.paneles))


def _tiene_informe(detalle: DetalleClinicoExtract) -> bool:
    imagen = detalle.informe_imagenologico
    return bool(imagen and (imagen.hallazgos or imagen.impresion_diagnostica))


# Contenido mínimo esperable por tipo: si falta, la extracción probablemente falló.
_CONTENIDO_MINIMO: dict[str, tuple[str, Callable[[DetalleClinicoExtract], bool]]] = {
    "RECETA": ("ningún medicamento", lambda d: bool(d.medicamentos)),
    "LABORATORIO": ("ningún parámetro de laboratorio", _tiene_parametros),
    "IMAGENES": ("hallazgos ni impresión diagnóstica", _tiene_informe),
    "SOLICITUD_EXAMENES": ("ningún examen solicitado", lambda d: bool(d.examenes_solicitados)),
}


@dataclass(frozen=True)
class HallazgosCalidad:
    """Resultado de las validaciones objetivas del contenido, hechas por el servicio de ingesta."""

    tiene_nombre: bool
    tiene_identificacion: bool  # identificación o N° de ficha
    identificacion_invalida: str | None = None  # descripción del problema, si lo hay
    cie10_descartados: int = 0


@dataclass
class ResultadoScore:
    score: float
    motivos: list[str] = field(default_factory=list)


def _descuentos_contenido(
    tipo: str, detalle: DetalleClinicoExtract, hallazgos: HallazgosCalidad
) -> list[tuple[float, str]]:
    descuentos: list[tuple[float, str]] = []
    if not hallazgos.tiene_nombre:
        descuentos.append((DESCUENTO_SIN_NOMBRE, "No se identificó el nombre del paciente"))
    if not hallazgos.tiene_identificacion:
        descuentos.append(
            (DESCUENTO_SIN_IDENTIFICACION, "No se identificó documento de identidad ni N° de ficha")
        )
    if hallazgos.identificacion_invalida:
        descuentos.append((DESCUENTO_IDENTIFICACION_INVALIDA, hallazgos.identificacion_invalida))
    if hallazgos.cie10_descartados:
        descuentos.append(
            (
                DESCUENTO_CIE10_INVALIDO,
                f"{hallazgos.cie10_descartados} código(s) CIE-10 con formato inválido descartado(s)",
            )
        )
    minimo = _CONTENIDO_MINIMO.get(tipo)
    if minimo and not minimo[1](detalle):
        descuentos.append((DESCUENTO_SIN_CONTENIDO, f"El documento {tipo} no trae {minimo[0]}"))
    return descuentos


def calcular_score(
    tipo: str,
    evaluacion: EvaluacionExtract | None,
    score_ia: float | None,
    detalle: DetalleClinicoExtract,
    hallazgos: HallazgosCalidad,
) -> ResultadoScore:
    """Puntaje final (0-1, tres decimales) y los motivos de cada descuento aplicado."""
    if evaluacion is None:
        # Contrato anterior: sin autoevaluación, solo queda el número del LLM.
        return ResultadoScore(round(score_ia or 0.0, 3))

    motivos: list[str] = []
    score = _BASE_POR_CERTEZA[evaluacion.certeza_tipo] * _FACTOR_POR_LEGIBILIDAD[evaluacion.legibilidad]
    if evaluacion.certeza_tipo != "alta":
        motivos.append(f"Certeza {evaluacion.certeza_tipo} sobre el tipo de documento")
    if evaluacion.legibilidad != "alta":
        motivos.append(f"Legibilidad {evaluacion.legibilidad} del documento")

    for descuento, motivo in _descuentos_contenido(tipo, detalle, hallazgos):
        score -= descuento
        motivos.append(motivo)

    if evaluacion.campos_dudosos:
        score -= min(DESCUENTO_POR_CAMPO_DUDOSO * len(evaluacion.campos_dudosos), DESCUENTO_MAXIMO_DUDOSOS)
        motivos.append(f"Campos de lectura dudosa: {', '.join(evaluacion.campos_dudosos[:5])}")

    if evaluacion.documentos_multiples:
        score = min(score, TOPE_DOCUMENTOS_MULTIPLES)
        motivos.append("El archivo contiene más de un documento")
    if not evaluacion.es_documento_clinico:
        score = min(score, TOPE_NO_CLINICO)
        motivos.append("La IA no lo reconoce como documento clínico")

    return ResultadoScore(round(min(1.0, max(0.0, score)), 3), motivos)
