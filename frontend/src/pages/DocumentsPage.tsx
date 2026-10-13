import { useState, useMemo, useCallback } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
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

const DocumentsPage = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [filters, setFilters] = useState<DocumentFiltersValue>(DEFAULT_FILTERS);

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
    if (filters.estado !== 'TODOS') params.estado = filters.estado;
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
