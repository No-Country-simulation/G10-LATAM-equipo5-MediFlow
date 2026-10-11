import { useMemo, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { useCatalogManagement } from '../../hooks/useCatalogManagement';
import type { CatalogRecord } from '../../types/catalog';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_CREATE, BUTTON_SECONDARY, INPUT_BASE } from '../common/formStyles';
import type { CatalogDefinition } from './catalogConfig';
import { CatalogFormModal } from './CatalogFormModal';
import { CatalogTable } from './CatalogTable';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'ACTIVE', label: 'Activos' },
  { id: 'INACTIVE', label: 'Inactivos' },
];

const matchesStatus = (record: CatalogRecord, filter: StatusFilter) =>
  filter === 'ALL' || record.is_active === (filter === 'ACTIVE');

const matchesSearch = (record: CatalogRecord, term: string) =>
  !term || `${record.codigo} ${record.nombre}`.toLowerCase().includes(term);

/** `null`: cerrado; `'new'`: alta; un registro: edición. */
type FormTarget = CatalogRecord | 'new' | null;

interface CatalogManagerProps {
  definition: CatalogDefinition;
}

/** CRUD completo de un catálogo: filtros, tabla, formulario y Smart Delete. */
export const CatalogManager = ({ definition }: CatalogManagerProps) => {
  const catalog = useCatalogManagement(definition.api, definition.singular);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [recordToDelete, setRecordToDelete] = useState<CatalogRecord | null>(null);

  const term = search.trim().toLowerCase();
  const visibleRecords = useMemo(
    () => catalog.records.filter((r) => matchesStatus(r, statusFilter) && matchesSearch(r, term)),
    [catalog.records, statusFilter, term]
  );
  const countByStatus = (filter: StatusFilter) => catalog.records.filter((r) => matchesStatus(r, filter)).length;

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    await catalog.remove(recordToDelete);
    setRecordToDelete(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">{definition.subtitle}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código o nombre"
              aria-label={`Buscar en ${definition.label}`}
              className={`w-56 pl-9 pr-3 ${INPUT_BASE}`}
            />
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className={`px-1.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-800/80 text-slate-400'}`}>
                    {countByStatus(filter.id)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => void catalog.refresh()} disabled={catalog.isLoading} className={BUTTON_SECONDARY}>
            <RefreshCw className={`w-3.5 h-3.5 ${catalog.isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button type="button" onClick={() => setFormTarget('new')} className={BUTTON_CREATE}>
            <Plus className="w-4 h-4" />
            <span>{definition.newLabel}</span>
          </button>
        </div>
      </div>

      <StatusBanner tone="error" message={catalog.error} onDismiss={catalog.dismissMessages} />
      <StatusBanner tone="success" message={catalog.successMessage} onDismiss={catalog.dismissMessages} />

      <CatalogTable
        definition={definition}
        records={visibleRecords}
        isLoading={catalog.isLoading}
        hasFilters={Boolean(term) || statusFilter !== 'ALL'}
        updatingId={catalog.updatingId}
        onToggleActive={(record) => void catalog.toggleActive(record)}
        onEdit={setFormTarget}
        onDelete={setRecordToDelete}
      />

      {formTarget !== null && (
        <CatalogFormModal
          key={formTarget === 'new' ? 'new' : formTarget.id}
          definition={definition}
          record={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
          onCreate={catalog.create}
          onUpdate={catalog.update}
        />
      )}

      <ConfirmDialog
        isOpen={recordToDelete !== null}
        title={`Eliminar ${definition.singular}`}
        message={`¿Eliminar ${recordToDelete?.codigo ?? ''} (${recordToDelete?.nombre ?? ''})?`}
        detail="Si está en uso por documentos o usuarios, solo se desactivará para no dejar registros huérfanos."
        onConfirm={handleConfirmDelete}
        onClose={() => setRecordToDelete(null)}
      />
    </div>
  );
};
