import type {
  ClasificacionExtract,
  DecisionEnrutamientoExtract,
  AlmacenamientoOci,
} from './document';

// n8n may spell the name key in Portuguese-style (`nome`) or Spanish (`nombre`).
export interface N8nPerson {
  rut?: string | null;
  edad?: number | null;
  nome?: string | null;
  nombre?: string | null;
}

// n8n sends `datos_extraidos`; older payloads used `datos_generales`.
export interface N8nClinicalData {
  paciente?: N8nPerson | null;
  medico_solicitante?: N8nPerson | null;
  diagnostico_principal?: string | null;
}

export interface N8nIngestResponse {
  status?: string;
  documento_id?: string;
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
}

export class IngestionError extends Error {
  readonly etapa: string;

  constructor(etapa: string, detalle: string) {
    super(detalle);
    this.name = 'IngestionError';
    this.etapa = etapa;
  }
}
