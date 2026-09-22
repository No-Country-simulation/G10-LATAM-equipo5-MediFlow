export const SCORE_CONFIANZA_THRESHOLD = 0.85;

export type EstadoDocumento = 'PROCESADO' | 'PENDIENTE_AUDITORIA' | 'AUDITADO';
export type NivelPrioridad = 'Rutina' | 'Prioritario' | 'Urgente';
export type TipoArchivo = 'PDF' | 'IMAGEN';

export type DestinoEnrutamiento =
  | 'Cola_Emergencia_Medica'
  | 'Auditoria_Autorizaciones'
  | 'Farmacia_Hospitalaria'
  | 'Historia_Clinica_Electronica'
  | 'Cola_Revision_Humana';

export type TipoDocumentoClinico =
  | 'Receta Médica'
  | 'Informe de Estudio por Imágenes'
  | 'Laboratorio'
  | 'Orden de Solicitud de Procedimiento'
  | 'Epicrisis / Informe de Alta'
  | 'Certificado Médico';

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

export interface AuditDetailResponse {
  documento_id: string;
  estado: EstadoDocumento;
  oci_preview_url: string;
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
  audit_notes: string;
}

// Regla de negocio: Umbral de confianza < 0.85 o flag de auditoría humana explícito
export const requiresHumanAudit = (score: number, requiereAuditoria = false): boolean => {
  return score < SCORE_CONFIANZA_THRESHOLD || requiereAuditoria;
};
