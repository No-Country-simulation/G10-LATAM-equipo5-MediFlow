"""Esquemas Pydantic para la feature de ingesta y consulta de documentos clínicos.

El payload de ingesta sigue el patrón *Envelope*: `clasificacion` y `datos_generales` son
comunes a cualquier documento, mientras que `detalle_clinico` transporta un único bloque
poblado según `clasificacion.tipo_documento` (Receta -> `medicamentos`, Informe de
Laboratorio -> `examenes_y_laboratorio`, Epicrisis -> `procedimientos_e_internacion`).
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Datos generales (comunes a todo tipo de documento) ---------------------


class PacienteExtract(BaseModel):
    """Datos del paciente extraídos por el pipeline de OCR/LLM."""

    rut: str | None = None
    nombre: str | None = None
    edad: int | None = None


class MedicoExtract(BaseModel):
    """Datos del profesional solicitante extraídos por el pipeline."""

    rut: str | None = None
    nombre: str | None = None
    matricula: str | None = None


class DatosGeneralesExtract(BaseModel):
    """Datos administrativos y clínicos comunes a cualquier tipo de documento."""

    paciente: PacienteExtract
    medico_solicitante: MedicoExtract
    diagnostico_principal: str | None = None
    cie10_sugerido: str | None = None


# --- Clasificación y enrutamiento --------------------------------------------


class ClasificacionExtract(BaseModel):
    """Resultado de la clasificación automática del documento."""

    tipo_documento: str
    especialidad: str | None = None
    nivel_prioridad: str
    score_confianza_clasificacion: float


class NotificacionGenerada(BaseModel):
    """Alerta generada por el pipeline para casos críticos."""

    canal: str
    mensaje: str


class DecisionEnrutamientoExtract(BaseModel):
    """Decisión de enrutamiento tomada por el pipeline de triaje."""

    destino_principal: str
    requiere_auditoria_humana: bool
    justificacion_enrutamiento: str | None = None
    notificacion_generada: NotificacionGenerada | None = None


# --- Detalle clínico (Envelope: un solo bloque poblado por tipo de documento) --


class MedicamentoItem(BaseModel):
    """Ítem de posología dentro de una Receta médica."""

    nombre: str
    dosis: str | None = None
    duracion_tratamiento: str | None = None


class ParametroLaboratorio(BaseModel):
    """Parámetro individual reportado dentro de un examen de laboratorio."""

    nombre: str
    valor: str | None = None
    unidad: str | None = None
    rango_referencia: str | None = None
    alterado: bool | None = None


class PanelLaboratorio(BaseModel):
    """Panel o sección de un informe de laboratorio (ej. 'Hemograma', 'Coagulación').

    Un mismo informe suele traer varios paneles, cada uno con su propia tabla de
    parámetros; por eso `ExamenesLaboratorioDetail.paneles` es una lista de estos.
    """

    nombre_panel: str
    parametros: list[ParametroLaboratorio] = []


class ExamenesLaboratorioDetail(BaseModel):
    """Detalle clínico específico de un Informe de Laboratorio.

    Puede contener uno o varios `paneles` (ej. un informe de "Exámenes de Sangre" trae
    Química en Sangre, Hemograma, Coagulación, Hormonas, etc., cada uno como un panel
    independiente con sus propios parámetros y unidades).
    """

    estudio_solicitado: str | None = None
    conclusiones_o_hallazgos: str | None = None
    paneles: list[PanelLaboratorio] = []


class ProcedimientosInternacionDetail(BaseModel):
    """Detalle clínico específico de una Epicrisis (evolución y antecedentes)."""

    fecha_ingreso: str | None = None
    fecha_alta: str | None = None
    resumen_evolucion: str | None = None
    antecedentes_relevantes: str | None = None
    procedimientos_realizados: list[str] = []


class InformeImagenologicoDetail(BaseModel):
    """Detalle clínico específico de un Informe de Imagenología (TC, RM, Rx, Ecotomografía, etc.).

    `hallazgos` e `impresion_diagnostica` suelen venir como texto libre (a veces con
    subtítulos anatómicos dentro del mismo bloque, ej. "TORAX" / "ABDOMEN Y PELVIS");
    no se estructuran más porque no hay una tabla real detrás, a diferencia de laboratorio.
    """

    tecnica: str | None = None
    antecedentes: str | None = None
    hallazgos: str | None = None
    impresion_diagnostica: str | None = None


class NotaAtencionAmbulatoriaDetail(BaseModel):
    """Detalle clínico específico de una Nota de Atención Ambulatoria (consulta médica).

    A diferencia de un informe de examen, no describe un estudio sino la evolución de una
    consulta: motivo, antecedentes acumulados del paciente, anamnesis, examen físico e
    indicaciones. Todos son texto libre extraído de la ficha electrónica; `diagnostico_atencion`
    puede diferir de `diagnostico_referencia` (el motivo con el que llegó derivado el paciente).
    """

    motivo_consulta: str | None = None
    antecedentes: str | None = None
    anamnesis: str | None = None
    examen_fisico: str | None = None
    diagnostico_referencia: str | None = None
    diagnostico_atencion: str | None = None
    indicaciones: str | None = None


class DetalleClinicoExtract(BaseModel):
    """Envelope de detalle clínico: solo el bloque correspondiente al `tipo_documento` viene poblado."""

    medicamentos: list[MedicamentoItem] | None = None
    examenes_y_laboratorio: ExamenesLaboratorioDetail | None = None
    procedimientos_e_internacion: ProcedimientosInternacionDetail | None = None
    informe_imagenologico: InformeImagenologicoDetail | None = None
    nota_atencion_ambulatoria: NotaAtencionAmbulatoriaDetail | None = None


# --- Payload unificado de ingesta --------------------------------------------


class ArchivoAdjunto(BaseModel):
    """Un archivo binario adjunto al documento.

    Un mismo documento clínico puede traer más de un archivo (ej. una orden de radiografía
    con varias placas AP/Lateral/Oblicua, o una ecotomografía con múltiples capturas más su
    informe). `rol` distingue el archivo principal (el informe/receta en sí) de imágenes de
    respaldo del estudio; el primero de la lista (`orden` más bajo) se usa como vista previa.
    """

    tipo_archivo: str
    archivo_base64: str
    rol: str | None = None


class IngestPayload(BaseModel):
    """Payload enviado por el workflow de n8n tras procesar un documento clínico."""

    documento_id: str
    archivos: list[ArchivoAdjunto] = Field(min_length=1)
    clasificacion: ClasificacionExtract
    datos_generales: DatosGeneralesExtract
    detalle_clinico: DetalleClinicoExtract
    decision_enrutamiento: DecisionEnrutamientoExtract


class AlmacenamientoOci(BaseModel):
    """Resultado del respaldo del documento en OCI Object Storage."""

    bucket: str
    ruta_objeto: str
    rutas_binarios: list[str] = []
    status_backup: str


class IngestResponse(BaseModel):
    """Respuesta final del procesamiento, consumida por el frontend React.

    Repite la información recibida desde n8n y agrega `status` y `almacenamiento_oci`.
    """

    status: str
    documento_id: str
    clasificacion: ClasificacionExtract
    datos_generales: DatosGeneralesExtract
    detalle_clinico: DetalleClinicoExtract
    decision_enrutamiento: DecisionEnrutamientoExtract
    almacenamiento_oci: AlmacenamientoOci


class DocumentListItemResponse(BaseModel):
    """DTO resumido de un documento clínico, usado en el listado paginado y en resoluciones de auditoría."""

    model_config = ConfigDict(from_attributes=True)

    documento_id: str
    estado: str
    rut_paciente: str | None
    nombre_paciente: str | None
    tipo_documento: str
    nivel_prioridad: str
    score_confianza: float
    destino_enrutamiento: str | None
    oci_json_path: str
    created_at: datetime


class PaginatedDocumentResponse(BaseModel):
    """Página de resultados de la bandeja documental, con metadatos de paginación."""

    items: list[DocumentListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    message: str | None = None
