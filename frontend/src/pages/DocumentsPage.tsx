import { useState, useMemo } from 'react';
import { Files, List, Columns3 } from 'lucide-react';
import { MOCK_TRIAGE_DOCUMENTS } from '../components/dashboard/triageData';
import DocumentFilters from '../components/documents/DocumentFilters';
import DocumentsListView from '../components/documents/DocumentsListView';
import DocumentsKanbanBoard from '../components/documents/DocumentsKanbanBoard';
import {
  type DocumentCategoryFilter,
  type DocumentDestinationFilter,
  CATEGORY_MAP,
  DESTINATION_MAP,
} from '../types/documents';

const DocumentsPage = () => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [selectedCategory, setSelectedCategory] =
    useState<DocumentCategoryFilter>('ALL');
  const [selectedDestination, setSelectedDestination] =
    useState<DocumentDestinationFilter>('ALL');

  const filteredDocs = useMemo(() => {
    return MOCK_TRIAGE_DOCUMENTS.filter((doc) => {
      if (
        selectedCategory !== 'ALL' &&
        doc.clasificacion.tipo_documento !== CATEGORY_MAP[selectedCategory]
      ) {
        return false;
      }
      if (
        selectedDestination !== 'ALL' &&
        doc.decision_enrutamiento.destino_principal !==
          DESTINATION_MAP[selectedDestination]
      ) {
        return false;
      }
      return true;
    });
  }, [selectedCategory, selectedDestination]);

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
              {filteredDocs.length}
            </span>
          </div>

          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              <span>Tablero</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
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

      {viewMode === 'kanban' ? (
        <DocumentsKanbanBoard documents={filteredDocs} />
      ) : (
        <DocumentsListView documents={filteredDocs} />
      )}
    </div>
  );
};

export default DocumentsPage;
