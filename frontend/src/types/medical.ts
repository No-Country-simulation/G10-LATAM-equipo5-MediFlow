import type { QueueSummary } from './auth';

export const SCORE_CONFIANZA_THRESHOLD = 0.85;

export type EstadoDocumento = 'PROCESADO' | 'PENDIENTE_AUDITORIA' | 'AUDITADO' | 'DESCARTADO' | 'ELIMINADO';
export type NivelPrioridad = 'Urgente' | 'Prioritario' | 'Rutina';
export type TipoArchivo = 'PDF' | 'IMAGEN';

export type DestinoEnrutamiento =
  | 'Cola_Emergencia_Medica'
  | 'Farmacia_Hospitalaria'
  | 'Gestion_Procedimientos'
  | 'Gestion_Interconsultas'
  | 'Cola_Oncologia'
  | 'Ficha_Clinica'
  | 'OTRO';

export type TipoDocumentoClinico =
  | 'RECETA'
  | 'LABORATORIO'
  | 'IMAGENES'
  | 'SOLICITUD_PROCEDIMIENTO'
  | 'EPICRISIS'
  | 'INTERCONSULTA'
  | 'ANATOMIA_PATOLOGICA'
  | 'PROTOCOLO_OPERATORIO'
  | 'OTRO';

export interface ClasificacionDocumento {
  tipo_documento: string;
  especialidad: string | null;
  nivel_prioridad: NivelPrioridad;
  score_confianza_clasificacion: number;
}

export interface DecisionEnrutamiento {
  destino_principal: string;
  requiere_auditoria_humana: boolean;
  justificacion_enrutamiento: string | null;
  notificacion_generada: { canal: string; mensaje: string } | null;
}

export interface DocumentListItemResponse {
  documento_id: string;
  estado: EstadoDocumento;
  identificacion_paciente: string | null;
  tipo_identificacion?: string | null;
  nombre_paciente: string | null;
  numero_ficha?: string | null;
  medico_nombre?: string | null;
  cie10_sugerido?: string | null;
  institucion_emisora?: string | null;
  fecha_documento?: string | null;
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  score_confianza: number;
  destino_enrutamiento: string | null;
  oci_json_path: string;
  created_at: string;
  diagnostico_principal?: string | null;
  requiere_auditoria?: boolean | null;
  asignado_a_username?: string | null;
  asignado_at?: string | null;
  atendido_por_username?: string | null;
  atendido_at?: string | null;
  eliminado_por_username?: string | null;
  eliminado_at?: string | null;
  motivo_eliminacion?: string | null;
}

export interface PaginatedDocumentResponse {
  items: DocumentListItemResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  message: string | null;
}

export interface DocumentFilterParams {
  page?: number;
  page_size?: number;
  /** Uno o varios estados separados por coma (`PROCESADO,AUDITADO`). */
  estado?: EstadoDocumento | (string & {});
  /** Una o varias colas separadas por coma. */
  destino?: string;
  identificacion?: string;
  numero_ficha?: string;
  prioridad?: NivelPrioridad;
  fecha_desde?: string;
  fecha_hasta?: string;
  area_origen_id?: string;
  /** `false` = casos aún no marcados como atendidos en la Consola de Triaje. */
  atendido?: boolean;
}

export interface ArchivoPreview {
  orden: number;
  tipo_archivo: string;
  rol: string | null;
  url: string;
  visualizable: boolean;
}

/** Archivo original con su URL pre-firmada; `url` es `null` si OCI no pudo generarla. */
export interface ArchivoDocumento extends Omit<ArchivoPreview, 'url'> {
  url: string | null;
}

export interface DiagnosticoDetalle {
  descripcion: string | null;
  cie10: string | null;
  tipo: string;
  certeza: string;
  origen_cie10: string | null;
}

export interface ProfesionalDetalle {
  nombre: string | null;
  identificacion: string | null;
  registro_profesional: string | null;
  especialidad: string | null;
  rol: string;
}

export interface MedicamentoDetalle {
  nombre: string | null;
  dosis: string | null;
  frecuencia: string | null;
  via: string | null;
  duracion_tratamiento: string | null;
  cantidad: string | null;
  tipo: string;
}

export interface ExamenSolicitadoDetalle {
  codigo: string | null;
  nombre: string | null;
  categoria: string;
}

export interface ParametroLaboratorioDetalle {
  nombre: string | null;
  valor: string | null;
  unidad: string | null;
  rango_referencia: string | null;
  alterado: boolean | null;
  critico: boolean | null;
}

export interface PanelLaboratorioDetalle {
  nombre_panel: string | null;
  muestra: string | null;
  parametros: ParametroLaboratorioDetalle[];
}

/** Campo de texto del detalle clínico sin tabla propia, listo para mostrar. */
export interface CampoRelevante {
  campo: string;
  etiqueta: string;
  valor: unknown;
}

/** Otro documento que podría ser el mismo (detectado al ingerir). */
export interface DuplicadoDocumento {
  documento_id: string;
  tipo: 'ARCHIVO_IDENTICO' | 'CONTENIDO_SIMILAR';
}

/** Documento ya registrado con un archivo idéntico. Para un OPERADOR, de los documentos ajenos
 * solo se informa el área y la fecha (`documento_id` y `estado` vienen en `null`). */
export interface CoincidenciaArchivo {
  sha256: string;
  documento_id: string | null;
  estado: EstadoDocumento | null;
  created_at: string;
  area_origen: string | null;
  propio: boolean;
}

/** Un valor modificado por una corrección (`campo` es la ruta; `etiqueta`, su texto legible). */
export interface CambioCorreccion {
  campo: string;
  etiqueta: string;
  antes: unknown;
  despues: unknown;
}

/** Entrada del historial: la resolución de la auditoría o una corrección posterior. */
export interface CorreccionHistorial {
  origen: 'AUDITORIA' | 'CORRECCION' | 'DERIVACION' | 'ELIMINACION' | 'RESTAURACION';
  justificacion: string;
  cambios: CambioCorreccion[];
  corrected_by_username: string;
  corrected_at: string;
}

/** Respuesta de `GET /documents/{id}`: datos del caso, archivos originales y detalle clínico. */
export interface DocumentDetailResponse extends DocumentListItemResponse {
  especialidad: string | null;
  cie10_origen: string | null;
  pais_identificacion: string | null;
  edad_paciente: number | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  medico_identificacion: string | null;
  requiere_auditoria: boolean;
  justificacion_enrutamiento: string | null;
  area_origen: { id: string; codigo: string; nombre: string } | null;
  motivos_auditoria: string[];
  audited_at: string | null;
  audit_notes: string | null;
  archivos: ArchivoDocumento[];
  preview_expira_en_minutos: number;
  aviso_archivos: string | null;
  detalle: {
    tablas: {
      diagnosticos: DiagnosticoDetalle[];
      profesionales: ProfesionalDetalle[];
      medicamentos: MedicamentoDetalle[];
      examenes_solicitados: ExamenSolicitadoDetalle[];
      paneles_laboratorio: PanelLaboratorioDetalle[];
      procedimientos: string[];
    };
    campos_relevantes: CampoRelevante[];
  };
  /** Valores vigentes en el formato de la ingesta (precargan el formulario de corrección). */
  datos_generales: Record<string, unknown>;
  detalle_clinico: Record<string, unknown>;
  historial_correcciones: CorreccionHistorial[];
  duplicados: DuplicadoDocumento[];
}

export interface AuditDetailResponse {
  documento_id: string;
  estado: EstadoDocumento;
  oci_preview_url: string;
  archivos: ArchivoPreview[];
  preview_expira_en_minutos: number;
  motivos_auditoria: string[];
  identificacion_paciente: string | null;
  tipo_identificacion: string | null;
  pais_identificacion: string | null;
  nombre_paciente: string | null;
  edad_paciente: number | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  numero_ficha: string | null;
  medico_nombre: string | null;
  medico_identificacion: string | null;
  institucion_emisora: string | null;
  fecha_documento: string | null;
  tipo_documento: string;
  especialidad: string | null;
  nivel_prioridad: NivelPrioridad;
  score_confianza: number;
  diagnostico_principal: string | null;
  cie10_sugerido: string | null;
  cie10_origen: string | null;
  destino_enrutamiento: string | null;
  raw_extracted_json: Record<string, unknown>;
  uploaded_by_id: string | null;
  asignado_a_id: string | null;
  asignado_a_username: string | null;
  asignado_at: string | null;
  audited_by_id: string | null;
  audited_at: string | null;
  audit_notes: string | null;
  created_at: string;
}

/** Datos generales de un documento (mismo contrato que la ingesta de n8n). */
export interface DatosGenerales {
  paciente: {
    nombre: string | null;
    identificacion: { tipo: string | null; numero: string | null; pais: string | null } | null;
    edad: number | null;
    fecha_nacimiento: string | null;
    sexo: string | null;
    numero_ficha: string | null;
  };
  profesionales: Record<string, unknown>[];
  institucion_emisora: string | null;
  fecha_documento: string | null;
  diagnosticos: Record<string, unknown>[];
}

/** Valores corregidos por una persona (auditoría y corrección de documentos). */
export interface CorreccionClinica {
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  destino_enrutamiento: string;
  especialidad?: string | null;
  datos_generales: DatosGenerales;
  detalle_clinico?: Record<string, unknown> | null;
}

export interface AuditResolveRequest extends CorreccionClinica {
  audit_notes: string;
}

/** `PUT /documents/{id}`: corrección de un documento PROCESADO o AUDITADO. */
export interface DocumentCorrectionRequest extends CorreccionClinica {
  justificacion: string;
}

export interface AuditDiscardRequest {
  motivo: string;
}

export interface AuditClaimResponse {
  documento_id: string;
  asignado_a_id: string;
  asignado_a_username: string;
  asignado_at: string;
  expira_at: string;
}

// Score < SCORE_CONFIANZA_THRESHOLD or explicit human-audit flag
export const requiresHumanAudit = (score: number, requiereAuditoria = false): boolean =>
  score < SCORE_CONFIANZA_THRESHOLD || requiereAuditoria;

export const normalizePriority = (val?: string | null): NivelPrioridad => {
  if (!val) return 'Rutina';
  const clean = val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (clean === 'urgente' || clean === 'critica' || clean === 'alta') {
    return 'Urgente';
  }
  if (clean === 'prioritario' || clean === 'media') {
    return 'Prioritario';
  }
  return 'Rutina';
};

/** Respuesta de `GET /documents/triage`: colas que ve el usuario y sus casos activos. */
export interface TriageResponse {
  colas: QueueSummary[];
  items: DocumentListItemResponse[];
}

export interface DeriveRequest {
  destino: string;
  motivo: string;
}
