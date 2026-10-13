import type { DocumentListItemResponse } from './medical';

export interface DashboardTotales {
  total: number;
  urgente: number;
  prioritario: number;
  rutina: number;
  procesados: number;
  auditados: number;
  descartados: number;
  /** Toda la cola pendiente, sin importar cuándo ingresó. */
  pendientes_auditoria: number;
}

export interface IngresosDia {
  /** `YYYY-MM-DD` en la hora local del usuario. */
  fecha: string;
  urgente: number;
  prioritario: number;
  rutina: number;
}

export interface ConteoDestino {
  destino: string | null;
  total: number;
}

export interface DashboardStatsResponse {
  fecha_desde: string;
  fecha_hasta: string;
  totales: DashboardTotales;
  por_dia: IngresosDia[];
  por_destino: ConteoDestino[];
  /** Últimas cargas (solo OPERADOR). */
  recientes: DocumentListItemResponse[];
  /** Casos que el auditor tiene tomados (ADMIN y AUDITOR_CLINICO). */
  mis_casos: DocumentListItemResponse[];
  /** Pendientes de auditoría, los más antiguos primero (ADMIN y AUDITOR_CLINICO). */
  pendientes_auditoria: DocumentListItemResponse[];
  /** Urgentes ya resueltos del período (ADMIN y AUDITOR_CLINICO). */
  urgentes: DocumentListItemResponse[];
}

export interface DashboardStatsParams {
  fecha_desde: string;
  fecha_hasta: string;
  utc_offset_min: number;
}
