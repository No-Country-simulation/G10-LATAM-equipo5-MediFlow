export type { 
  DocumentListItemResponse,
  PaginatedDocumentResponse,
  DocumentFilterParams,
  AuditDetailResponse,
  AuditResolveRequest,
  EstadoDocumento,
  NivelPrioridad,
  DestinoEnrutamiento,
  TipoDocumentoClinico,
} from './medical';

export interface PacienteExtract {
  rut: string | null;
  nombre: string | null;
  edad: number | null;
}

export interface MedicoExtract {
  rut: string | null;
  nombre: string | null;
  matricula: string | null;
}

export interface DatosGeneralesExtract {
  paciente: PacienteExtract;
  medico_solicitante: MedicoExtract;
  diagnostico_principal: string | null;
  cie10_sugerido: string | null;
}

export interface ClasificacionExtract {
  tipo_documento: string;
  especialidad: string | null;
  nivel_prioridad: string;
  score_confianza_clasificacion: number;
}

export interface NotificacionGenerada {
  canal: string;
  mensaje: string;
}

export interface DecisionEnrutamientoExtract {
  destino_principal: string;
  requiere_auditoria_humana: boolean;
  justificacion_enrutamiento: string | null;
  notificacion_generada: NotificacionGenerada | null;
}

export interface MedicamentoItem {
  nombre: string;
  dosis: string | null;
  duracion_tratamiento: string | null;
}

export interface ParametroLaboratorio {
  nombre: string;
  valor: string | null;
  unidad: string | null;
  rango_referencia: string | null;
  alterado: boolean | null;
}

export interface PanelLaboratorio {
  nombre_panel: string;
  parametros: ParametroLaboratorio[];
}

export interface ExamenesLaboratorioDetail {
  estudio_solicitado: string | null;
  conclusiones_o_hallazgos: string | null;
  paneles: PanelLaboratorio[];
}

export interface ProcedimientosInternacionDetail {
  fecha_ingreso: string | null;
  fecha_alta: string | null;
  resumen_evolucion: string | null;
  antecedentes_relevantes: string | null;
  procedimientos_realizados: string[];
}

export interface InformeImagenologicoDetail {
  tecnica: string | null;
  antecedentes: string | null;
  hallazgos: string | null;
  impresion_diagnostica: string | null;
}

export interface NotaAtencionAmbulatoriaDetail {
  motivo_consulta: string | null;
  antecedentes: string | null;
  anamnesis: string | null;
  examen_fisico: string | null;
  diagnostico_referencia: string | null;
  diagnostico_atencion: string | null;
  indicaciones: string | null;
}

export interface DetalleClinicoExtract {
  medicamentos: MedicamentoItem[] | null;
  examenes_y_laboratorio: ExamenesLaboratorioDetail | null;
  procedimientos_e_internacion: ProcedimientosInternacionDetail | null;
  informe_imagenologico: InformeImagenologicoDetail | null;
  nota_atencion_ambulatoria: NotaAtencionAmbulatoriaDetail | null;
}

export interface ArchivoAdjunto {
  tipo_archivo: string;
  archivo_base64: string;
  rol: string | null;
}

export interface IngestPayload {
  documento_id: string;
  archivos: ArchivoAdjunto[];
  clasificacion: ClasificacionExtract;
  datos_generales: DatosGeneralesExtract;
  detalle_clinico: DetalleClinicoExtract;
  decision_enrutamiento: DecisionEnrutamientoExtract;
}

export interface AlmacenamientoOci {
  bucket: string;
  ruta_objeto: string;
  rutas_binarios: string[];
  status_backup: string;
}

export interface IngestResponse {
  status: string;
  documento_id: string;
  clasificacion: ClasificacionExtract;
  datos_generales: DatosGeneralesExtract;
  detalle_clinico: DetalleClinicoExtract;
  decision_enrutamiento: DecisionEnrutamientoExtract;
  almacenamiento_oci: AlmacenamientoOci;
}
