import { useState, useMemo } from 'react';
import { Files, List, Columns3, RefreshCw, AlertCircle, Inbox } from 'lucide-react';
import { useDocumentList } from '../hooks/useDocumentList';
import DocumentFilters from '../components/documents/DocumentFilters';
import DocumentsListView from '../components/documents/DocumentsListView';
import DocumentsKanbanBoard from '../components/documents/DocumentsKanbanBoard';
import {
  type DocumentCategoryFilter,
  type DocumentDestinationFilter,
  CANONICAL_QUEUES,
} from '../types/documents';

const CANONICAL_QUEUE_SET = new Set<string>(CANONICAL_QUEUES);
const SKELETON_COUNT = 4;

const DocumentsPage = () => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategoryFilter>('ALL');
  const [selectedDestination, setSelectedDestination] = useState<DocumentDestinationFilter>('ALL');

  const { documents, total, state, error, reload } = useDocumentList({ page_size: 100 });

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      if (selectedCategory !== 'ALL' && doc.tipo_documento !== selectedCategory) return false;

      if (selectedDestination !== 'ALL') {
        if (selectedDestination === 'OTROS') {
          const isCanonical = Boolean(
            doc.destino_enrutamiento && CANONICAL_QUEUE_SET.has(doc.destino_enrutamiento)
          );
          if (isCanonical) return false;
        } else if (doc.destino_enrutamiento !== selectedDestination) {
          return false;
        }
      }

      return true;
    });
  }, [documents, selectedCategory, selectedDestination]);

  const viewButtonClass = (mode: 'kanban' | 'list') =>
    `flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
      viewMode === mode
        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        : 'text-slate-400 hover:text-slate-200'
    }`;

  return (
    <div
      className={`w-full mx-auto p-4 sm:p-6 space-y-6 transition-all ${
        viewMode === 'kanban' ? 'max-w-7xl' : 'max-w-5xl'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Expedientes y Flujos Documentales</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium">
              Repositorio Clínico
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión centralizada del repositorio clínico, trazabilidad de derivaciones y archivo digital asistencial.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center gap-1.5">
            <Files className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Total listados:</span>
            <span className="font-mono font-bold text-white">
              {state === 'loading' ? '—' : filteredDocs.length}
            </span>
            {total > 0 && state === 'success' && (
              <span className="text-slate-600">/ {total}</span>
            )}
          </div>

          <button
            type="button"
            onClick={reload}
            disabled={state === 'loading'}
            aria-label="Recargar documentos"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${state === 'loading' ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              type="button"
              aria-label="Vista de tablero"
              aria-pressed={viewMode === 'kanban'}
              onClick={() => setViewMode('kanban')}
              className={viewButtonClass('kanban')}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Tablero</span>
            </button>
            <button
              type="button"
              aria-label="Vista de lista"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={viewButtonClass('list')}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>
        </div>
      </div>

      <DocumentFilters
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        selectedDestination={selectedDestination}
        onSelectDestination={setSelectedDestination}
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

      {state === 'success' && filteredDocs.length === 0 && (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
          <Inbox className="w-8 h-8 text-slate-600 mx-auto" />
          <h2 className="text-sm font-semibold text-white">Sin expedientes registrados</h2>
          <p className="text-xs text-slate-400">
            No hay documentos clínicos que coincidan con los filtros seleccionados.
          </p>
        </div>
      )}

      {state === 'success' && filteredDocs.length > 0 &&
        (viewMode === 'kanban' ? (
          <DocumentsKanbanBoard
            key={`${selectedCategory}-${selectedDestination}`}
            documents={filteredDocs}
            selectedDestination={selectedDestination}
          />
        ) : (
          <DocumentsListView documents={filteredDocs} />
        ))}
    </div>
  );
};

export default DocumentsPage;
