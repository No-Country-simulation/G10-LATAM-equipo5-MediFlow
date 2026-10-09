"""Esquemas Pydantic para la feature de ingesta y consulta de documentos clínicos.

El payload de ingesta sigue el patrón *Envelope*: `clasificacion` y `datos_generales` son
comunes a cualquier documento, mientras que `detalle_clinico` transporta un único bloque
poblado según `clasificacion.tipo_documento`, que es el `codigo` del tipo en la tabla maestra
`document_types` (RECETA -> `medicamentos`, LABORATORIO -> `examenes_y_laboratorio`,
EPICRISIS -> `procedimientos_e_internacion`, etc.; ver `DetalleClinicoExtract`).
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_serializer

from app.core.config import settings

NivelPrioridad = Literal["Rutina", "Prioritario", "Urgente"]

# Formatos admitidos: PDF y escaneos/fotos (PNG, JPG, TIFF) más DICOM (DCM) para imágenes
# nativas de un estudio. El navegador y el LLM solo leen PDF/PNG/JPG, por eso el archivo
# principal (vista previa en auditoría) debe ser uno de esos.
TipoArchivo = Literal["PDF", "PNG", "JPG", "TIFF", "DCM"]
TIPOS_ARCHIVO_PRINCIPAL: tuple[str, ...] = ("PDF", "PNG", "JPG")


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

    tipo_documento: str  # `codigo` del tipo en la tabla maestra (ej. "RECETA")
    especialidad: str | None = None
    nivel_prioridad: NivelPrioridad
    score_confianza_clasificacion: float = Field(ge=0, le=1)


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


class SolicitudProcedimientoDetail(BaseModel):
    """Detalle clínico específico de una Solicitud de Procedimiento (aún no realizado)."""

    procedimiento_solicitado: str | None = None
    indicacion_clinica: str | None = None
    antecedentes: str | None = None
    fecha_solicitud: str | None = None


class InterconsultaDetail(BaseModel):
    """Detalle clínico específico de una Interconsulta / Derivación a otra especialidad o centro."""

    especialidad_destino: str | None = None
    establecimiento_destino: str | None = None
    motivo_interconsulta: str | None = None
    antecedentes_clinicos: str | None = None


class AnatomiaPatologicaDetail(BaseModel):
    """Detalle clínico específico de un Informe de Anatomía Patológica (biopsia, citología, pieza).

    `malignidad` explicita si el patólogo informa neoplasia maligna (`None` si no se pronuncia);
    es la señal principal para enrutar a la cola de Oncología.
    """

    tipo_muestra: str | None = None
    descripcion_macroscopica: str | None = None
    descripcion_microscopica: str | None = None
    diagnostico_histopatologico: str | None = None
    malignidad: bool | None = None


class ProtocoloOperatorioDetail(BaseModel):
    """Detalle clínico específico de un Protocolo Operatorio (cirugía ya realizada)."""

    fecha_cirugia: str | None = None
    cirugia_realizada: str | None = None
    diagnostico_preoperatorio: str | None = None
    tecnica: str | None = None
    hallazgos_intraoperatorios: str | None = None
    complicaciones: str | None = None
    muestras_enviadas: str | None = None


class DetalleClinicoExtract(BaseModel):
    """Envelope de detalle clínico: solo el bloque correspondiente al `tipo_documento` viene poblado.

    Mapeo `codigo` del tipo -> bloque: RECETA -> `medicamentos`, LABORATORIO ->
    `examenes_y_laboratorio`, IMAGENES -> `informe_imagenologico`, SOLICITUD_PROCEDIMIENTO ->
    `solicitud_procedimiento`, EPICRISIS -> `procedimientos_e_internacion`, INTERCONSULTA ->
    `interconsulta`, ANATOMIA_PATOLOGICA -> `anatomia_patologica`, PROTOCOLO_OPERATORIO ->
    `protocolo_operatorio`, NOTA_ATENCION -> `nota_atencion_ambulatoria`. OTRO no lleva bloque.

    `campos_adicionales` es el bloque genérico para los tipos que definen `campos_extraccion`
    (JSON Schema) en el catálogo, por ejemplo uno creado desde el mantenedor; el backend lo
    valida contra ese esquema en la ingesta.
    """

    medicamentos: list[MedicamentoItem] | None = None
    examenes_y_laboratorio: ExamenesLaboratorioDetail | None = None
    procedimientos_e_internacion: ProcedimientosInternacionDetail | None = None
    informe_imagenologico: InformeImagenologicoDetail | None = None
    nota_atencion_ambulatoria: NotaAtencionAmbulatoriaDetail | None = None
    solicitud_procedimiento: SolicitudProcedimientoDetail | None = None
    interconsulta: InterconsultaDetail | None = None
    anatomia_patologica: AnatomiaPatologicaDetail | None = None
    protocolo_operatorio: ProtocoloOperatorioDetail | None = None
    campos_adicionales: dict[str, Any] | None = None

    @model_serializer(mode="wrap")
    def _omitir_bloques_vacios(self, handler):
        """Serializa solo el bloque poblado: los otros ocho `null` son ruido en la respuesta,
        en el JSON de OCI y en `raw_extracted_json`."""
        return {bloque: valor for bloque, valor in handler(self).items() if valor is not None}


# --- Payload unificado de ingesta --------------------------------------------


class ArchivoAdjunto(BaseModel):
    """Un archivo binario adjunto al documento.

    Un mismo documento clínico puede traer más de un archivo (ej. una orden de radiografía
    con varias placas AP/Lateral/Oblicua, o una ecotomografía con múltiples capturas más su
    informe). `rol` distingue el archivo principal (el informe/receta en sí) de imágenes de
    respaldo del estudio; el primero de la lista (`orden` más bajo) se usa como vista previa.
    """

    tipo_archivo: TipoArchivo
    # Tope en base64 (4 caracteres por cada 3 bytes): corta payloads gigantes antes de decodificarlos.
    archivo_base64: str = Field(max_length=4 * -(-settings.INGEST_MAX_FILE_MB * 1024 * 1024 // 3))
    rol: str | None = Field(None, max_length=50)


class IngestPayload(BaseModel):
    """Payload enviado por el workflow de n8n tras procesar un documento clínico."""

    # Forma parte de las rutas en OCI: solo caracteres seguros (n8n genera `DOC-<uuid>`).
    documento_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    archivos: list[ArchivoAdjunto] = Field(min_length=1, max_length=settings.INGEST_MAX_FILES)
    clasificacion: ClasificacionExtract
    datos_generales: DatosGeneralesExtract
    detalle_clinico: DetalleClinicoExtract
    decision_enrutamiento: DecisionEnrutamientoExtract

    @field_validator("archivos")
    @classmethod
    def _principal_visualizable(cls, archivos: list[ArchivoAdjunto]) -> list[ArchivoAdjunto]:
        """El primer archivo es la vista previa de auditoría: debe poder abrirse en el navegador."""
        if archivos[0].tipo_archivo not in TIPOS_ARCHIVO_PRINCIPAL:
            raise ValueError(
                "El primer archivo (documento principal) debe ser "
                f"{', '.join(TIPOS_ARCHIVO_PRINCIPAL)}; TIFF y DCM solo como imágenes de respaldo"
            )
        return archivos


class AlmacenamientoOci(BaseModel):
    """Resultado del respaldo del documento en OCI Object Storage."""

    bucket: str
    ruta_objeto: str
    rutas_binarios: list[str] = []
    status_backup: str


class IngestResponse(BaseModel):
    """Respuesta final del procesamiento, consumida por el frontend React.

    Repite la información recibida desde n8n y agrega `status` (`PROCESADO` o
    `PENDIENTE_AUDITORIA`, igual que `estado` en la bandeja), `motivos_auditoria` (por qué el
    backend dejó el documento en auditoría; vacío si quedó procesado) y `almacenamiento_oci`.
    """

    status: Literal["PROCESADO", "PENDIENTE_AUDITORIA"]
    documento_id: str
    motivos_auditoria: list[str] = []
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
    uploaded_by_id: UUID | None = None
    motivos_auditoria: list[str] = []
    asignado_a_id: UUID | None = None
    asignado_a_username: str | None = None
    asignado_at: datetime | None = None
    created_at: datetime


class PaginatedDocumentResponse(BaseModel):
    """Página de resultados de la bandeja documental, con metadatos de paginación."""

    items: list[DocumentListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    message: str | None = None
