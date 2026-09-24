export type DocumentType =
  | 'Receta Médica'
  | 'Informe de Estudio por Imágenes'
  | 'Laboratorio'
  | 'Orden de Solicitud de Procedimiento'
  | 'Epicrisis / Informe de Alta'
  | 'Certificado Médico';

export type PriorityLevel = 'Baja' | 'Media' | 'Alta' | 'Urgente';

export type RoutingDestination =
  | 'Cola_Emergencia_Medica'
  | 'Auditoria_Autorizaciones'
  | 'Farmacia_Hospitalaria'
  | 'Historia_Clinica_Electronica'
  | 'Cola_Revision_Humana';

export type TriageStatus = 'procesado' | 'error' | 'en_revision';

export interface PatientInfo {
  nome: string;
  edad?: number;
  rut?: string;
}

export interface DoctorInfo {
  nombre: string;
  matricula?: string;
}

export interface ExtractedClinicalData {
  paciente: PatientInfo;
  medico_solicitante?: DoctorInfo;
  estudio_realizado?: string;
  diagnostico_principal: string;
  cie10_sugerido: string;
  medicamentos?: Array<{ nombre: string; dosis: string }>;
}

export interface OciStorageInfo {
  bucket: string;
  ruta_objeto: string;
  status_backup: 'exito' | 'fallo' | 'pendiente';
}

export interface TriageDocument {
  documento_id: string;
  status: TriageStatus;
  fecha_ingreso: string;
  clasificacion: {
    tipo_documento: DocumentType;
    especialidad: string;
    nivel_prioridad: PriorityLevel;
    score_confianza_clasificacion: number;
    score_confianza_extraccion?: number;
  };
  datos_extraidos: ExtractedClinicalData;
  decision_enrutamiento: {
    destino_principal: RoutingDestination;
    requiere_auditoria_humana: boolean;
    justificacion_enrutamiento: string;
    notificacion_generada?: { canal: string; mensaje: string };
  };
  almacenamiento_oci: OciStorageInfo;
}

export type TriageFilter = 'ALL' | 'URGENT' | 'AUDIT' | 'ROUTINE';
