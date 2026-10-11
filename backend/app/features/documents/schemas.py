"""Esquemas Pydantic para la feature de ingesta y consulta de documentos clínicos.

El payload de ingesta sigue el patrón *Envelope*:

- `clasificacion`, `evaluacion` y `datos_generales` son comunes a cualquier documento.
  `datos_generales` trae al paciente (con una identificación de cualquier país), los
  profesionales con su rol, la institución, la fecha del documento y la lista de diagnósticos.
- `detalle_clinico` trae las **listas comunes** a todos los tipos (`medicamentos`,
  `examenes_solicitados`) y, como máximo, **un bloque propio** del tipo (RECETA no tiene bloque
  propio: su contenido son los medicamentos; LABORATORIO -> `examenes_y_laboratorio`, etc.; ver
  `BLOQUE_POR_TIPO` en `forms.py`). Los tipos definidos con `campos_extraccion` en el catálogo
  usan `campos_adicionales`.

Los campos de texto son tolerantes (ver `fields.py`): un valor no interpretable queda en `None`
en lugar de rechazar el documento completo.
"""

from datetime import date, datetime
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator, model_serializer

from app.core.config import settings
from app.features.catalogs.schemas import AreaSummary
from app.features.documents.fields import (
    Booleano,
    Edad,
    Fecha,
    TextoCorto,
    TextoLargo,
    TextoMedio,
    lista_acotada,
    opcion,
    texto_de,
)
from app.features.documents.normalization import TIPOS_IDENTIFICACION

NivelPrioridad = Literal["Rutina", "Prioritario", "Urgente"]

# Formatos admitidos: PDF y escaneos/fotos (PNG, JPG, TIFF) más DICOM (DCM) para imágenes
# nativas de un estudio. El navegador y el LLM solo leen PDF/PNG/JPG, por eso el archivo
# principal (vista previa en auditoría) debe ser uno de esos.
TipoArchivo = Literal["PDF", "PNG", "JPG", "TIFF", "DCM"]
TIPOS_ARCHIVO_PRINCIPAL: tuple[str, ...] = ("PDF", "PNG", "JPG")

ROLES_PROFESIONAL = ("SOLICITANTE", "INFORMANTE", "TRATANTE", "DESTINATARIO", "OTRO")
NIVELES_EVALUACION = ("alta", "media", "baja")
ORIGENES_CIE10 = ("DOCUMENTO", "INFERIDO", "AUDITOR")

TipoIdentificacion = Annotated[
    str,
    BeforeValidator(
        opcion(
            TIPOS_IDENTIFICACION,
            {"RUN": "RUT", "CI": "CEDULA", "CC": "CEDULA", "CÉDULA": "CEDULA", "PASSPORT": "PASAPORTE"},
            "OTRO",
        )
    ),
    Field(json_schema_extra={"enum": list(TIPOS_IDENTIFICACION)}),
]
Sexo = Annotated[
    str | None,
    BeforeValidator(
        opcion(("F", "M", "X"), {"FEMENINO": "F", "MUJER": "F", "MASCULINO": "M", "HOMBRE": "M"})
    ),
    Field(json_schema_extra={"enum": ["F", "M", "X"]}),
]
RolProfesional = Annotated[
    str,
    BeforeValidator(
        opcion(ROLES_PROFESIONAL, {"FIRMANTE": "INFORMANTE", "RESPONSABLE": "TRATANTE"}, "OTRO")
    ),
    Field(json_schema_extra={"enum": list(ROLES_PROFESIONAL)}),
]
# Si el LLM no evalúa (o responde algo fuera de la escala), se asume lo conservador.
NivelEvaluacion = Annotated[
    str,
    BeforeValidator(opcion(NIVELES_EVALUACION, {"high": "alta", "medium": "media", "low": "baja"}, "baja")),
]
OrigenCie10 = Annotated[str | None, BeforeValidator(opcion(ORIGENES_CIE10))]


# --- Datos generales (comunes a todo tipo de documento) ---------------------


class IdentificacionExtract(BaseModel):
    """Documento de identidad del paciente: RUT/RUN, DNI, CURP, cédula, CPF, pasaporte u otro."""

    tipo: TipoIdentificacion = Field("OTRO", title="Tipo de identificación")
    numero: texto_de(30) = Field(None, title="Número de identificación")
    pais: texto_de(56) = Field(None, title="País (ISO alfa-2)")


class PacienteExtract(BaseModel):
    """Datos del paciente extraídos del documento."""

    nombre: TextoCorto = Field(None, title="Nombre del paciente")
    identificacion: IdentificacionExtract | None = Field(None, title="Identificación")
    edad: Edad = Field(None, title="Edad (años)")
    fecha_nacimiento: Fecha = Field(None, title="Fecha de nacimiento")
    sexo: Sexo = Field(None, title="Sexo")
    numero_ficha: texto_de(50) = Field(None, title="N° de ficha / historia clínica")


class ProfesionalExtract(BaseModel):
    """Profesional que participa en el documento, con su rol (quién solicita, informa, etc.)."""

    nombre: TextoCorto = Field(None, title="Nombre")
    identificacion: texto_de(30) = Field(None, title="Identificación")
    registro_profesional: texto_de(50) = Field(None, title="Registro / matrícula / cédula profesional")
    especialidad: texto_de(100) = Field(None, title="Especialidad")
    rol: RolProfesional = Field("OTRO", title="Rol")


class DiagnosticoExtract(BaseModel):
    """Diagnóstico del documento. `origen_cie10`: impreso en el DOCUMENTO o INFERIDO por la IA."""

    descripcion: texto_de(300) = Field(None, title="Diagnóstico")
    cie10: texto_de(12) = Field(None, title="CIE-10")
    tipo: Annotated[str, BeforeValidator(opcion(("PRINCIPAL", "SECUNDARIO"), defecto="SECUNDARIO"))] = Field(
        "SECUNDARIO", title="Tipo", json_schema_extra={"enum": ["PRINCIPAL", "SECUNDARIO"]}
    )
    certeza: Annotated[
        str, BeforeValidator(opcion(("CONFIRMADO", "PRESUNTIVO"), {"SOSPECHA": "PRESUNTIVO"}, "PRESUNTIVO"))
    ] = Field("PRESUNTIVO", title="Certeza", json_schema_extra={"enum": ["CONFIRMADO", "PRESUNTIVO"]})
    origen_cie10: OrigenCie10 = Field(
        None, title="Origen del CIE-10", json_schema_extra={"enum": list(ORIGENES_CIE10), "readOnly": True}
    )


class DatosGeneralesExtract(BaseModel):
    """Datos administrativos y clínicos comunes a cualquier tipo de documento."""

    paciente: PacienteExtract = Field(default_factory=PacienteExtract, title="Paciente")
    profesionales: Annotated[list[ProfesionalExtract], BeforeValidator(lista_acotada(10))] = Field(
        [], title="Profesionales"
    )
    institucion_emisora: texto_de(200) = Field(None, title="Institución emisora")
    fecha_documento: Fecha = Field(None, title="Fecha del documento / examen")
    diagnosticos: Annotated[list[DiagnosticoExtract], BeforeValidator(lista_acotada(20))] = Field(
        [], title="Diagnósticos"
    )

    @property
    def diagnostico_principal(self) -> DiagnosticoExtract | None:
        """El marcado como PRINCIPAL o, si ninguno lo está, el primero de la lista."""
        principales = [d for d in self.diagnosticos if d.tipo == "PRINCIPAL"]
        return (principales or self.diagnosticos or [None])[0]


# --- Clasificación, evaluación y enrutamiento -------------------------------


class ClasificacionExtract(BaseModel):
    """Resultado de la clasificación automática del documento.

    `score_confianza_clasificacion` es el que reporta el LLM; cuando viene `evaluacion`, el
    backend calcula el puntaje final con reglas propias (ver `scoring.py`) y conserva este como
    `score_ia`.
    """

    tipo_documento: str  # `codigo` del tipo en la tabla maestra (ej. "RECETA")
    especialidad: TextoCorto = None
    nivel_prioridad: NivelPrioridad
    score_confianza_clasificacion: float | None = Field(None, ge=0, le=1)


class EvaluacionExtract(BaseModel):
    """Autoevaluación del LLM sobre la calidad de la lectura, en categorías (más confiables que un
    número): con ella y con validaciones propias el backend calcula el puntaje de confianza."""

    legibilidad: NivelEvaluacion = "baja"
    certeza_tipo: NivelEvaluacion = "baja"
    evidencia_tipo: TextoMedio = None  # texto del documento que justifica el tipo (título, encabezado)
    campos_dudosos: Annotated[list[str], BeforeValidator(lista_acotada(20))] = []
    documentos_multiples: bool = False
    es_documento_clinico: bool = True
    modelo: texto_de(80) = None  # modelo que produjo la extracción final (lo agrega n8n)
    escalado: bool = False  # True si n8n repitió la extracción con el modelo de mayor precisión


class NotificacionGenerada(BaseModel):
    """Alerta generada por el pipeline para casos críticos."""

    canal: str
    mensaje: str


class DecisionEnrutamientoExtract(BaseModel):
    """Decisión de enrutamiento tomada por el pipeline de triaje."""

    destino_principal: str
    requiere_auditoria_humana: bool
    justificacion_enrutamiento: TextoMedio = None
    notificacion_generada: NotificacionGenerada | None = None


# --- Listas comunes a todos los tipos ----------------------------------------


class MedicamentoItem(BaseModel):
    """Medicamento prescrito (receta, indicaciones de alta o de una atención) o administrado
    (tratamiento en urgencias o en una ambulancia)."""

    nombre: texto_de(200) = Field(None, title="Medicamento")
    dosis: texto_de(100) = Field(None, title="Dosis")
    frecuencia: texto_de(100) = Field(None, title="Frecuencia")
    via: texto_de(50) = Field(None, title="Vía")
    duracion_tratamiento: texto_de(100) = Field(None, title="Duración")
    cantidad: texto_de(100) = Field(None, title="Cantidad")
    tipo: Annotated[str, BeforeValidator(opcion(("PRESCRITO", "ADMINISTRADO"), defecto="PRESCRITO"))] = Field(
        "PRESCRITO", title="Prescrito / administrado", json_schema_extra={"enum": ["PRESCRITO", "ADMINISTRADO"]}
    )


class ExamenSolicitadoItem(BaseModel):
    """Examen o estudio pedido en una orden (aún no realizado)."""

    codigo: texto_de(30) = Field(None, title="Código de prestación")
    nombre: texto_de(300) = Field(None, title="Examen solicitado")
    categoria: Annotated[
        str,
        BeforeValidator(
            opcion(
                ("LABORATORIO", "IMAGENOLOGIA", "PROCEDIMIENTO", "OTRO"),
                {"IMAGEN": "IMAGENOLOGIA", "IMAGENES": "IMAGENOLOGIA", "IMAGENOLOGÍA": "IMAGENOLOGIA"},
                "OTRO",
            )
        ),
    ] = Field(
        "OTRO",
        title="Categoría",
        json_schema_extra={"enum": ["LABORATORIO", "IMAGENOLOGIA", "PROCEDIMIENTO", "OTRO"]},
    )


# --- Bloques propios de cada tipo semilla --------------------------------------


class ParametroLaboratorio(BaseModel):
    """Parámetro individual de un examen de laboratorio. `critico`: el informe lo marca como
    valor crítico o de pánico (ej. `**`), lo que eleva la prioridad a Urgente."""

    nombre: texto_de(150) = Field(None, title="Parámetro")
    valor: texto_de(100) = Field(None, title="Valor")
    unidad: texto_de(50) = Field(None, title="Unidad")
    rango_referencia: texto_de(100) = Field(None, title="Rango de referencia")
    alterado: Booleano = Field(None, title="Fuera de rango")
    critico: Booleano = Field(None, title="Valor crítico")


class PanelLaboratorio(BaseModel):
    """Panel o sección de un informe de laboratorio (ej. 'Hemograma', 'Coagulación')."""

    nombre_panel: texto_de(150) = Field(None, title="Panel")
    muestra: texto_de(50) = Field(None, title="Muestra")
    parametros: Annotated[list[ParametroLaboratorio], BeforeValidator(lista_acotada(150))] = Field(
        [], title="Parámetros"
    )


class ExamenesLaboratorioDetail(BaseModel):
    """Detalle de un informe de resultados de laboratorio (uno o varios paneles)."""

    estudio_solicitado: TextoMedio = Field(None, title="Estudio solicitado")
    conclusiones_o_hallazgos: TextoLargo = Field(None, title="Conclusiones o comentarios")
    paneles: Annotated[list[PanelLaboratorio], BeforeValidator(lista_acotada(40))] = Field([], title="Paneles")


class ProcedimientosInternacionDetail(BaseModel):
    """Detalle de una epicrisis o informe de alta de una hospitalización."""

    fecha_ingreso: Fecha = Field(None, title="Fecha de ingreso")
    fecha_alta: Fecha = Field(None, title="Fecha de alta")
    resumen_evolucion: TextoLargo = Field(None, title="Resumen de la evolución")
    antecedentes_relevantes: TextoLargo = Field(None, title="Antecedentes relevantes")
    condicion_alta: TextoMedio = Field(None, title="Condición al alta")
    indicaciones_alta: TextoLargo = Field(None, title="Indicaciones al alta")
    controles: TextoMedio = Field(None, title="Controles")
    procedimientos_realizados: Annotated[list[str], BeforeValidator(lista_acotada(30))] = Field(
        [], title="Procedimientos realizados"
    )


class InformeImagenologicoDetail(BaseModel):
    """Detalle de un informe de imagenología (Rx, TC, RM, ecografía, mamografía, ...)."""

    estudio_realizado: TextoMedio = Field(None, title="Estudio realizado")
    modalidad: Annotated[
        str | None,
        BeforeValidator(
            opcion(
                ("RX", "TC", "RM", "ECO", "MAMOGRAFIA", "PET", "MEDICINA_NUCLEAR", "OTRA"),
                {"RADIOGRAFIA": "RX", "TAC": "TC", "TOMOGRAFIA": "TC", "RESONANCIA": "RM", "ECOGRAFIA": "ECO"},
                "OTRA",
            )
        ),
    ] = Field(
        None,
        title="Modalidad",
        json_schema_extra={"enum": ["RX", "TC", "RM", "ECO", "MAMOGRAFIA", "PET", "MEDICINA_NUCLEAR", "OTRA"]},
    )
    region_anatomica: TextoCorto = Field(None, title="Región anatómica")
    tecnica: TextoLargo = Field(None, title="Técnica")
    antecedentes: TextoLargo = Field(None, title="Antecedentes / indicación")
    hallazgos: TextoLargo = Field(None, title="Hallazgos")
    impresion_diagnostica: TextoLargo = Field(None, title="Impresión diagnóstica")


class NotaAtencionAmbulatoriaDetail(BaseModel):
    """Registro de una atención o evaluación ambulatoria (consulta, control, evaluación de
    kinesiología o rehabilitación, plan de tratamiento)."""

    motivo_consulta: TextoLargo = Field(None, title="Motivo de consulta")
    antecedentes: TextoLargo = Field(None, title="Antecedentes")
    anamnesis: TextoLargo = Field(None, title="Anamnesis")
    examen_fisico: TextoLargo = Field(None, title="Examen físico")
    diagnostico_referencia: TextoMedio = Field(None, title="Diagnóstico de referencia")
    diagnostico_atencion: TextoMedio = Field(None, title="Diagnóstico de la atención")
    indicaciones: TextoLargo = Field(None, title="Indicaciones / plan")


class SolicitudProcedimientoDetail(BaseModel):
    """Solicitud de un procedimiento aún no realizado (cirugía, endoscopía, biopsia, ...)."""

    procedimiento_solicitado: TextoMedio = Field(None, title="Procedimiento solicitado")
    indicacion_clinica: TextoLargo = Field(None, title="Indicación clínica")
    antecedentes: TextoLargo = Field(None, title="Antecedentes")
    fecha_solicitud: Fecha = Field(None, title="Fecha de solicitud")


class InterconsultaDetail(BaseModel):
    """Interconsulta o derivación a otra especialidad, profesional o centro."""

    especialidad_destino: TextoCorto = Field(None, title="Especialidad de destino")
    establecimiento_destino: TextoCorto = Field(None, title="Establecimiento de destino")
    motivo_interconsulta: TextoLargo = Field(None, title="Motivo de la interconsulta")
    antecedentes_clinicos: TextoLargo = Field(None, title="Antecedentes clínicos")


class AnatomiaPatologicaDetail(BaseModel):
    """Informe de anatomía patológica. `malignidad`: `None` si el patólogo no se pronuncia."""

    tipo_muestra: TextoMedio = Field(None, title="Tipo de muestra")
    descripcion_macroscopica: TextoLargo = Field(None, title="Descripción macroscópica")
    descripcion_microscopica: TextoLargo = Field(None, title="Descripción microscópica")
    diagnostico_histopatologico: TextoLargo = Field(None, title="Diagnóstico histopatológico")
    malignidad: Booleano = Field(None, title="Malignidad")


class ProtocoloOperatorioDetail(BaseModel):
    """Protocolo operatorio de una cirugía ya realizada."""

    fecha_cirugia: Fecha = Field(None, title="Fecha de la cirugía")
    cirugia_realizada: TextoMedio = Field(None, title="Cirugía realizada")
    diagnostico_preoperatorio: TextoMedio = Field(None, title="Diagnóstico preoperatorio")
    tecnica: TextoLargo = Field(None, title="Técnica")
    hallazgos_intraoperatorios: TextoLargo = Field(None, title="Hallazgos intraoperatorios")
    complicaciones: TextoMedio = Field(None, title="Complicaciones")
    muestras_enviadas: TextoMedio = Field(None, title="Muestras enviadas")


class DetalleClinicoExtract(BaseModel):
    """Envelope de detalle clínico: listas comunes + a lo sumo un bloque propio del tipo.

    Bloque por `codigo` de tipo: LABORATORIO -> `examenes_y_laboratorio`, IMAGENES ->
    `informe_imagenologico`, SOLICITUD_PROCEDIMIENTO -> `solicitud_procedimiento`, EPICRISIS ->
    `procedimientos_e_internacion`, INTERCONSULTA -> `interconsulta`, ANATOMIA_PATOLOGICA ->
    `anatomia_patologica`, PROTOCOLO_OPERATORIO -> `protocolo_operatorio`, NOTA_ATENCION ->
    `nota_atencion_ambulatoria`. RECETA y OTRO no tienen bloque propio. Los tipos con
    `campos_extraccion` en el catálogo usan `campos_adicionales` (validado contra ese JSON Schema).
    """

    medicamentos: list[MedicamentoItem] | None = None
    examenes_solicitados: list[ExamenSolicitadoItem] | None = None
    examenes_y_laboratorio: ExamenesLaboratorioDetail | None = None
    procedimientos_e_internacion: ProcedimientosInternacionDetail | None = None
    informe_imagenologico: InformeImagenologicoDetail | None = None
    nota_atencion_ambulatoria: NotaAtencionAmbulatoriaDetail | None = None
    solicitud_procedimiento: SolicitudProcedimientoDetail | None = None
    interconsulta: InterconsultaDetail | None = None
    anatomia_patologica: AnatomiaPatologicaDetail | None = None
    protocolo_operatorio: ProtocoloOperatorioDetail | None = None
    campos_adicionales: dict[str, Any] | None = None

    @field_validator("medicamentos", "examenes_solicitados", mode="before")
    @classmethod
    def _lista_vacia_es_none(cls, value: Any) -> Any:
        """Una lista vacía equivale a "sin datos": no ensucia el JSON ni la validación."""
        return value or None

    @model_serializer(mode="wrap")
    def _omitir_bloques_vacios(self, handler):
        """Serializa solo lo poblado: los bloques en `null` son ruido en la respuesta, en el JSON
        de OCI y en `raw_extracted_json`."""
        return {bloque: valor for bloque, valor in handler(self).items() if valor is not None}


# Listas que cualquier tipo puede traer, además de su bloque propio.
LISTAS_COMUNES: tuple[str, ...] = ("medicamentos", "examenes_solicitados")


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
    evaluacion: EvaluacionExtract | None = None
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

    Repite la información normalizada y agrega `status` (`PROCESADO` o `PENDIENTE_AUDITORIA`),
    `score_confianza` (el puntaje final calculado por el backend), `motivos_auditoria` (por qué
    quedó en auditoría; vacío si quedó procesado) y `almacenamiento_oci`.
    """

    status: Literal["PROCESADO", "PENDIENTE_AUDITORIA"]
    documento_id: str
    score_confianza: float
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
    identificacion_paciente: str | None
    tipo_identificacion: str | None = None
    nombre_paciente: str | None
    numero_ficha: str | None = None
    medico_nombre: str | None = None
    tipo_documento: str
    especialidad: str | None = None
    nivel_prioridad: str
    score_confianza: float
    diagnostico_principal: str | None = None
    cie10_sugerido: str | None = None
    cie10_origen: str | None = None
    institucion_emisora: str | None = None
    fecha_documento: date | None = None
    destino_enrutamiento: str | None
    oci_json_path: str
    uploaded_by_id: UUID | None = None
    area_origen: AreaSummary | None = None
    motivos_auditoria: list[str] = []
    asignado_a_id: UUID | None = None
    asignado_a_username: str | None = None
    asignado_at: datetime | None = None
    created_at: datetime


class ArchivoDocumento(BaseModel):
    """Un archivo original del documento con su URL pre-firmada de solo lectura.

    `visualizable` indica si el navegador puede mostrarlo (PDF/PNG/JPG); TIFF y DICOM se
    ofrecen como descarga. `url` es `None` si OCI no pudo generarla (ver `aviso_archivos`).
    """

    orden: int
    tipo_archivo: str
    rol: str | None
    url: str | None
    visualizable: bool


class ArchivoPreview(ArchivoDocumento):
    """Archivo con URL garantizada: la auditoría no se puede hacer sin ver el original."""

    url: str


class CampoRelevante(BaseModel):
    """Campo del detalle clínico sin tabla propia, listo para mostrarse (`etiqueta`: `valor`)."""

    campo: str
    etiqueta: str
    valor: Any


class TablasClinicas(BaseModel):
    """Datos tabulares del documento, leídos de las tablas hijas normalizadas."""

    diagnosticos: list[DiagnosticoExtract] = []
    profesionales: list[ProfesionalExtract] = []
    medicamentos: list[MedicamentoItem] = []
    examenes_solicitados: list[ExamenSolicitadoItem] = []
    paneles_laboratorio: list[PanelLaboratorio] = []
    procedimientos: list[str] = []


class DetalleDocumento(BaseModel):
    """Detalle clínico para mostrar: las tablas del documento y los campos de texto relevantes."""

    tablas: TablasClinicas = Field(default_factory=TablasClinicas)
    campos_relevantes: list[CampoRelevante] = []


class DocumentDetailResponse(DocumentListItemResponse):
    """Detalle completo de un documento: datos del caso, archivos originales y detalle clínico."""

    pais_identificacion: str | None = None
    edad_paciente: int | None = None
    fecha_nacimiento: date | None = None
    sexo: str | None = None
    medico_identificacion: str | None = None
    requiere_auditoria: bool
    justificacion_enrutamiento: str | None = None
    audited_by_id: UUID | None = None
    audited_at: datetime | None = None
    audit_notes: str | None = None
    updated_at: datetime | None = None
    archivos: list[ArchivoDocumento] = []
    preview_expira_en_minutos: int = settings.DOCUMENT_PREVIEW_URL_EXPIRE_MINUTES
    aviso_archivos: str | None = None
    detalle: DetalleDocumento = Field(default_factory=DetalleDocumento)


class PaginatedDocumentResponse(BaseModel):
    """Página de resultados de la bandeja documental, con metadatos de paginación."""

    items: list[DocumentListItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    message: str | None = None
