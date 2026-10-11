import type {
  ClasificacionExtract,
  DecisionEnrutamientoExtract,
  AlmacenamientoOci,
} from './document';

// Datos generales tal como los devuelve el backend tras normalizarlos (contrato v2).
export interface N8nPerson {
  nombre?: string | null;
  edad?: number | null;
  identificacion?: { tipo?: string | null; numero?: string | null } | null;
  numero_ficha?: string | null;
}

export interface N8nProfesional {
  nombre?: string | null;
  rol?: string | null;
}

export interface N8nDiagnostico {
  descripcion?: string | null;
  cie10?: string | null;
  tipo?: string | null;
}

export interface N8nClinicalData {
  paciente?: N8nPerson | null;
  profesionales?: N8nProfesional[] | null;
  diagnosticos?: N8nDiagnostico[] | null;
  institucion_emisora?: string | null;
  fecha_documento?: string | null;
}

export interface N8nIngestResponse {
  status?: string;
  documento_id?: string;
  score_confianza?: number;
  motivos_auditoria?: string[];
  clasificacion?: Partial<ClasificacionExtract> | null;
  datos_extraidos?: N8nClinicalData | null;
  datos_generales?: N8nClinicalData | null;
  decision_enrutamiento?: Partial<DecisionEnrutamientoExtract> | null;
  almacenamiento_oci?: AlmacenamientoOci | null;
}

export interface N8nErrorResponse {
  status: 'error';
  etapa: string;
  detalle: string;
  /** ID de seguimiento de la ingesta (el mismo que registran el front y el backend). */
  request_id?: string;
}

export class IngestionError extends Error {
  readonly etapa: string;

  constructor(etapa: string, detalle: string) {
    super(detalle);
    this.name = 'IngestionError';
    this.etapa = etapa;
  }
}
