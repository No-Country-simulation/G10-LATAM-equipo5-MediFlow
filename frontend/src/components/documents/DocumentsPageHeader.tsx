import { Files, List, Columns3, RefreshCw } from 'lucide-react';

interface DocumentsPageHeaderProps {
  totalCount: number;
  isLoading: boolean;
  viewMode: 'list' | 'kanban';
  onViewModeChange: (mode: 'list' | 'kanban') => void;
  onReload: () => void;
}

export const DocumentsPageHeader = ({
  totalCount,
  isLoading,
  viewMode,
  onViewModeChange,
  onReload,
}: DocumentsPageHeaderProps) => {
  const viewButtonClass = (mode: 'kanban' | 'list') =>
    `flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-colors ${
      viewMode === mode
        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        : 'text-slate-400 hover:text-slate-200'
    }`;

  return (
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
            {isLoading ? '—' : totalCount}
          </span>
        </div>

        <button
          type="button"
          onClick={onReload}
          disabled={isLoading}
          aria-label="Recargar documentos"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            type="button"
            aria-label="Vista de tablero"
            aria-pressed={viewMode === 'kanban'}
            onClick={() => onViewModeChange('kanban')}
            className={viewButtonClass('kanban')}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>Tablero</span>
          </button>
          <button
            type="button"
            aria-label="Vista de lista"
            aria-pressed={viewMode === 'list'}
            onClick={() => onViewModeChange('list')}
            className={viewButtonClass('list')}
          >
            <List className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
        </div>
      </div>
    </div>
  );
};
