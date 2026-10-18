import type { NivelPrioridad } from './medical';
import type { DatePreset } from '../utils/dateRange';

/**
 * Filtro de destino: `ALL`, `OTROS` (documentos sin cola o con una que ya no está activa) o el
 * código de una cola del catálogo. Las colas y sus nombres vienen siempre de la API.
 */
export type DocumentDestinationFilter = 'ALL' | 'OTROS' | (string & {});

export type DocumentStatusFilter = 'TODOS' | 'PROCESADO' | 'AUDITADO' | 'PENDIENTE_AUDITORIA' | 'DESCARTADO' | 'ELIMINADO';

export interface DocumentFiltersValue {
  destino: DocumentDestinationFilter;
  prioridad: NivelPrioridad | 'ALL';
  estado: DocumentStatusFilter;
  identificacion: string;
  areaOrigenId: string;
  datePreset: DatePreset;
  fechaDesde: string;
  fechaHasta: string;
}
