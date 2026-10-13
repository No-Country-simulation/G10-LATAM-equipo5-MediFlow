import { dashboardPeriod } from '../hooks/useDashboardStats';
import { toInputDate } from './dateRange';

interface ExpedientesLinkOptions {
  prioridad?: string;
  estado?: string;
  destino?: string;
  /** Un día concreto (`YYYY-MM-DD`); sin él se usa el período del inicio. */
  dia?: string;
}

/** Enlace a Expedientes ya filtrado (lo interpreta `DocumentsPage` al cargar). */
export function expedientesUrl({ prioridad, estado, destino, dia }: ExpedientesLinkOptions = {}): string {
  const { desde, hasta } = dashboardPeriod();
  const params = new URLSearchParams({
    desde: dia ?? toInputDate(desde),
    hasta: dia ?? toInputDate(hasta),
  });
  if (prioridad) params.set('prioridad', prioridad);
  if (estado) params.set('estado', estado);
  if (destino) params.set('destino', destino);
  return `/documentos?${params}`;
}
