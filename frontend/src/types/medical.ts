export const SCORE_CONFIANZA_THRESHOLD = 0.85;

export type EstadoDocumento = 'PROCESADO' | 'PENDIENTE_AUDITORIA' | 'AUDITADO' | 'DESCARTADO';
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

export interface Paciente {
  nombre: string | null;
  edad: number | null;
  rut: string | null;
}

export interface Medico {
  nombre: string | null;
  rut: string | null;
}

export interface ClasificacionDocumento {
  tipo_documento: string;
  especialidad: string | null;
  nivel_prioridad: NivelPrioridad;
  score_confianza_clasificacion: number;
}

export interface DatosExtraidos {
  paciente: Paciente;
  medico_solicitante: Medico;
  estudio_realizado: string | null;
  diagnostico_principal: string | null;
  cie10_sugerido: string | null;
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
  rut_paciente: string | null;
  nombre_paciente: string | null;
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  score_confianza: number;
  destino_enrutamiento: string | null;
  oci_json_path: string;
  created_at: string;
  diagnostico_principal?: string | null;
  requiere_auditoria?: boolean | null;
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
  estado?: EstadoDocumento;
  destino?: string;
  rut?: string;
  prioridad?: NivelPrioridad;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export interface ArchivoPreview {
  orden: number;
  tipo_archivo: string;
  rol: string | null;
  url: string;
  visualizable: boolean;
}

export interface AuditDetailResponse {
  documento_id: string;
  estado: EstadoDocumento;
  oci_preview_url: string;
  archivos: ArchivoPreview[];
  preview_expira_en_minutos: number;
  motivos_auditoria: string[];
  rut_paciente: string | null;
  nombre_paciente: string | null;
  edad_paciente: number | null;
  medico_nombre: string | null;
  medico_rut: string | null;
  tipo_documento: string;
  especialidad: string | null;
  nivel_prioridad: NivelPrioridad;
  score_confianza: number;
  diagnostico_principal: string | null;
  cie10_sugerido: string | null;
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

export interface AuditResolveRequest {
  rut_paciente: string;
  nombre_paciente: string;
  edad_paciente?: number | null;
  medico_nombre?: string | null;
  medico_rut?: string | null;
  tipo_documento: string;
  nivel_prioridad: NivelPrioridad;
  diagnostico_principal: string;
  cie10_sugerido?: string | null;
  destino_enrutamiento: string;
  especialidad?: string | null;
  detalle_clinico?: Record<string, unknown> | null;
  audit_notes: string;
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
  const clean = val.trim().toLowerCase();
  if (clean === 'urgente' || clean === 'critica' || clean === 'alta') {
    return 'Urgente';
  }
  if (clean === 'prioritario' || clean === 'media') {
    return 'Prioritario';
  }
  return 'Rutina';
};
