import { useState, useMemo } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { useDocumentList } from '../hooks/useDocumentList';
import DocumentFilters from '../components/documents/DocumentFilters';
import DocumentsListView from '../components/documents/DocumentsListView';
import DocumentsKanbanBoard from '../components/documents/DocumentsKanbanBoard';
import { DocumentsPageHeader } from '../components/documents/DocumentsPageHeader';
import type { DocumentDestinationFilter } from '../types/documents';
import type { NivelPrioridad } from '../types/medical';

const SKELETON_COUNT = 4;

const DocumentsPage = () => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [selectedDestination, setSelectedDestination] = useState<DocumentDestinationFilter>('ALL');
  const [selectedPrioridad, setSelectedPrioridad] = useState<NivelPrioridad | 'ALL'>('ALL');
  const [rutSearch, setRutSearch] = useState('');

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = { page_size: 100 };
    if (selectedDestination !== 'ALL') params.destino = selectedDestination;
    if (selectedPrioridad !== 'ALL') params.prioridad = selectedPrioridad;
    if (rutSearch.trim()) params.rut = rutSearch.trim();
    return params;
  }, [selectedDestination, selectedPrioridad, rutSearch]);

  const { documents, state, error, reload } = useDocumentList(queryParams);

  const authorizedDocuments = useMemo(() => {
    return documents.filter(
      (doc) =>
        !doc.requiere_auditoria &&
        doc.estado !== 'PENDIENTE_AUDITORIA' &&
        doc.estado !== 'DESCARTADO' &&
        (doc.estado === 'PROCESADO' || doc.estado === 'AUDITADO')
    );
  }, [documents]);

  return (
    <div
      className={`w-full mx-auto p-4 sm:p-6 space-y-6 transition-all ${
        viewMode === 'kanban' ? 'max-w-7xl' : 'max-w-5xl'
      }`}
    >
      <DocumentsPageHeader
        totalCount={authorizedDocuments.length}
        isLoading={state === 'loading'}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onReload={reload}
      />

      <DocumentFilters
        selectedDestination={selectedDestination}
        onSelectDestination={setSelectedDestination}
        selectedPrioridad={selectedPrioridad}
        onSelectPrioridad={setSelectedPrioridad}
        rutSearch={rutSearch}
        onRutSearchChange={setRutSearch}
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

      {state === 'success' && authorizedDocuments.length === 0 && (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
          <h2 className="text-sm font-semibold text-white">Sin expedientes registrados</h2>
          <p className="text-xs text-slate-400">
            No hay documentos clínicos que coincidan con los filtros seleccionados.
          </p>
        </div>
      )}

      {state === 'success' && authorizedDocuments.length > 0 &&
        (viewMode === 'kanban' ? (
          <DocumentsKanbanBoard
            key={`${selectedDestination}-${selectedPrioridad}-${rutSearch}`}
            documents={authorizedDocuments}
            selectedDestination={selectedDestination}
          />
        ) : (
          <DocumentsListView documents={authorizedDocuments} />
        ))}
    </div>
  );
};

export default DocumentsPage;
