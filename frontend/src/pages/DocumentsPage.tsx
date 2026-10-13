import { useState, useMemo, useCallback } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useDocumentList } from '../hooks/useDocumentList';
import { useAuth } from '../hooks/useAuth';
import DocumentFilters from '../components/documents/DocumentFilters';
import DocumentsListView from '../components/documents/DocumentsListView';
import DocumentsKanbanBoard from '../components/documents/DocumentsKanbanBoard';
import { DocumentsPageHeader } from '../components/documents/DocumentsPageHeader';
import type { DocumentFiltersValue } from '../types/documents';
import { resolveDateRange, toInputDate } from '../utils/dateRange';

const SKELETON_COUNT = 4;

const DEFAULT_FILTERS: DocumentFiltersValue = {
  destino: 'ALL',
  prioridad: 'ALL',
  estado: 'TODOS',
  identificacion: '',
  areaOrigenId: '',
  datePreset: 'MES_ACTUAL',
  fechaDesde: '',
  fechaHasta: '',
};

const PRIORIDADES = new Set(['Urgente', 'Prioritario', 'Rutina']);
const ESTADOS = new Set(['PROCESADO', 'AUDITADO', 'PENDIENTE_AUDITORIA', 'DESCARTADO']);
const FECHA_INPUT = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros iniciales desde la URL (`?prioridad=Urgente&desde=2026-10-01&hasta=2026-10-13`), para
 * que el inicio pueda enlazar a Expedientes ya filtrado. Lo que no se reconoce se ignora. */
function filtersFromSearchParams(params: URLSearchParams): DocumentFiltersValue {
  const filters = { ...DEFAULT_FILTERS };
  const prioridad = params.get('prioridad');
  const estado = params.get('estado');
  const destino = params.get('destino');
  const desde = params.get('desde');
  const hasta = params.get('hasta');
  if (prioridad && PRIORIDADES.has(prioridad)) filters.prioridad = prioridad as DocumentFiltersValue['prioridad'];
  if (estado && ESTADOS.has(estado)) filters.estado = estado as DocumentFiltersValue['estado'];
  if (destino) filters.destino = destino;
  if (desde && hasta && FECHA_INPUT.test(desde) && FECHA_INPUT.test(hasta) && desde <= hasta) {
    filters.datePreset = 'RANGO';
    filters.fechaDesde = desde;
    filters.fechaHasta = hasta;
  }
  return filters;
}

const DocumentsPage = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<DocumentFiltersValue>(() => filtersFromSearchParams(searchParams));

  const updateFilters = useCallback((patch: Partial<DocumentFiltersValue>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      // Al abrir el rango personalizado se parte del período que se estaba viendo.
      if (patch.datePreset === 'RANGO' && !prev.fechaDesde && !prev.fechaHasta) {
        const { from, to } = resolveDateRange(prev.datePreset, '', '');
        next.fechaDesde = from ? toInputDate(from) : '';
        next.fechaHasta = to ? toInputDate(to) : '';
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page_size: 100 };
    if (filters.destino !== 'ALL') params.destino = filters.destino;
    if (filters.prioridad !== 'ALL') params.prioridad = filters.prioridad;
    // "Todos" = los documentos resueltos; los descartados y los que esperan auditoría se ven con su propio filtro.
    params.estado = filters.estado === 'TODOS' ? 'PROCESADO,AUDITADO' : filters.estado;
    if (filters.identificacion.trim()) params.identificacion = filters.identificacion.trim();
    if (filters.areaOrigenId) params.area_origen_id = filters.areaOrigenId;
    const { from, to } = resolveDateRange(filters.datePreset, filters.fechaDesde, filters.fechaHasta);
    if (from) params.fecha_desde = from.toISOString();
    if (to) params.fecha_hasta = to.toISOString();
    return params;
  }, [filters]);

  const { documents: visibleDocuments, state, error, reload } = useDocumentList(queryParams);

  return (
    <div
      className={`w-full mx-auto p-4 sm:p-6 space-y-6 transition-all ${
        viewMode === 'kanban' ? 'max-w-7xl' : 'max-w-5xl'
      }`}
    >
      <DocumentsPageHeader
        totalCount={visibleDocuments.length}
        isLoading={state === 'loading'}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onReload={reload}
      />

      <DocumentFilters
        filters={filters}
        onChange={updateFilters}
        onReset={resetFilters}
        isDirty={isDirty}
        showAreaFilter={user?.role !== 'OPERADOR'}
      />

      {state === 'error' && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-500/8 border border-rose-500/20 text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">No se pudo cargar el repositorio</p>
            <p className="text-xs text-rose-400/80">{error}</p>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="space-y-3">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {state === 'success' && visibleDocuments.length === 0 && (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
          <h2 className="text-sm font-semibold text-white">Sin expedientes registrados</h2>
          <p className="text-xs text-slate-400">
            No hay documentos clínicos que coincidan con los filtros seleccionados.
          </p>
        </div>
      )}

      {state === 'success' && visibleDocuments.length > 0 &&
        (viewMode === 'kanban' ? (
          <DocumentsKanbanBoard
            key={JSON.stringify(filters)}
            documents={visibleDocuments}
            selectedDestination={filters.destino}
          />
        ) : (
          <DocumentsListView documents={visibleDocuments} />
        ))}
    </div>
  );
};

export default DocumentsPage;
