export type DocumentType =
  | 'Receta Médica'
  | 'Informe de Estudio por Imágenes'
  | 'Laboratorio'
  | 'Orden de Solicitud de Procedimiento'
  | 'Epicrisis / Informe de Alta'
  | 'Certificado Médico';

export type { NivelPrioridad } from './medical';
export type PriorityLevel = import('./medical').NivelPrioridad;

export type RoutingDestination =
  | 'Cola_Emergencia_Medica'
  | 'Farmacia_Hospitalaria'
  | 'Gestion_Procedimientos'
  | 'Gestion_Interconsultas'
  | 'Cola_Oncologia'
  | 'Ficha_Clinica'
  | 'Auditoria_Autorizaciones'
  | 'Historia_Clinica_Electronica'
  | 'Cola_Revision_Humana';

export type TriageStatus = 'procesado' | 'error' | 'en_revision';

export interface PatientInfo {
  nombre: string | null;
  edad?: number | null;
  rut?: string | null;
}

export interface DoctorInfo {
  nombre: string | null;
  matricula?: string | null;
}

export interface ExtractedClinicalData {
  paciente: PatientInfo;
  medico_solicitante?: DoctorInfo | null;
  estudio_realizado?: string | null;
  diagnostico_principal: string | null;
  cie10_sugerido: string | null;
  medicamentos?: Array<{ nombre: string; dosis: string }> | null;
}

export interface OciStorageInfo {
  bucket: string;
  ruta_objeto: string;
  status_backup: 'exito' | 'fallo' | 'pendiente';
}

export interface TriageDocument {
  documento_id: string;
  status: TriageStatus;
  estado?: string;
  fecha_ingreso: string;
  nivel_prioridad?: PriorityLevel;
  requiere_auditoria?: boolean;
  clasificacion: {
    tipo_documento: DocumentType;
    especialidad: string | null;
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

export type TriageFilter = 'ALL' | 'URGENT' | 'PRIORITY' | 'AUDIT' | 'ROUTINE';

export function mapDocumentListItemToTriageDoc(
  item: import('./medical').DocumentListItemResponse
): TriageDocument {
  const requiresAudit =
    Boolean(item.requiere_auditoria) ||
    item.estado === 'PENDIENTE_AUDITORIA' ||
    item.score_confianza < 0.85;

  return {
    documento_id: item.documento_id,
    status: item.estado === 'PENDIENTE_AUDITORIA' ? 'en_revision' : 'procesado',
    estado: item.estado,
    nivel_prioridad: item.nivel_prioridad,
    requiere_auditoria: requiresAudit,
    fecha_ingreso: item.created_at,
    clasificacion: {
      tipo_documento: (item.tipo_documento as DocumentType) || 'Informe de Estudio por Imágenes',
      especialidad: null,
      nivel_prioridad: item.nivel_prioridad,
      score_confianza_clasificacion: item.score_confianza,
      score_confianza_extraccion: undefined,
    },
    datos_extraidos: {
      paciente: {
        nombre: item.nombre_paciente ?? null,
        rut: item.rut_paciente || undefined,
        edad: undefined,
      },
      medico_solicitante: {
        nombre: null,
      },
      diagnostico_principal: item.diagnostico_principal ?? null,
      cie10_sugerido: null,
    },
    decision_enrutamiento: {
      destino_principal: (item.destino_enrutamiento as RoutingDestination) || 'Ficha_Clinica',
      requiere_auditoria_humana: requiresAudit,
      justificacion_enrutamiento: requiresAudit
        ? 'Derivado a revisión humana por score de confianza o criterio clínico.'
        : `Enrutado automáticamente a ${item.destino_enrutamiento || 'Ficha Clínica'}.`,
    },
    almacenamiento_oci: {
      bucket: 'mediflow-clinical-docs',
      ruta_objeto: item.oci_json_path || 'procesados/documento.pdf',
      status_backup: 'exito',
    },
  };
}
