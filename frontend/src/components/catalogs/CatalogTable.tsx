import type { ReactNode } from 'react';
import { Lock, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import type { CatalogRecord } from '../../types/catalog';
import { ActiveToggle } from '../common/ActiveToggle';
import { ICON_BUTTON } from '../common/formStyles';
import type { CatalogDefinition, RecordBadge } from './catalogConfig';

const BADGE_TONES: Record<RecordBadge['tone'], string> = {
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
};

const SYSTEM_RECORD_HINT = 'Registro de sistema: el pipeline depende de él, no se puede eliminar ni desactivar';

const COLUMNS = ['Código', 'Nombre', 'Descripción', 'Estado / Acción', 'Actualizado'];

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

interface CatalogTableProps {
  definition: CatalogDefinition;
  records: CatalogRecord[];
  isLoading: boolean;
  hasFilters: boolean;
  updatingId: string | null;
  onToggleActive: (record: CatalogRecord) => void;
  onEdit: (record: CatalogRecord) => void;
  onDelete: (record: CatalogRecord) => void;
}

const MessageRow = ({ children }: { children: ReactNode }) => (
  <tr>
    <td colSpan={COLUMNS.length + 1} className="px-5 py-12 text-center text-slate-400">
      {children}
    </td>
  </tr>
);

interface CatalogRowProps extends Omit<CatalogTableProps, 'records' | 'isLoading' | 'hasFilters' | 'updatingId'> {
  record: CatalogRecord;
  isUpdating: boolean;
}

const CatalogRow = ({ definition, record, isUpdating, onToggleActive, onEdit, onDelete }: CatalogRowProps) => {
  const description = String((record as unknown as Record<string, unknown>)[definition.descriptionField] ?? '');
  const badges = definition.badges?.(record) ?? [];
  // Un registro de sistema puede reactivarse, pero no desactivarse.
  const lockToggle = record.es_sistema && record.is_active;

  return (
    <tr className="hover:bg-slate-800/25 transition-colors">
      <td className="px-5 py-3.5 font-mono font-semibold text-white whitespace-nowrap">
        <div className="flex items-center gap-2">
          <span>{record.codigo}</span>
          {record.es_sistema && (
            <span title={SYSTEM_RECORD_HINT} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-sans font-medium">
              <Lock className="w-2.5 h-2.5" />
              Sistema
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 font-medium">
        <div className="flex items-center gap-2">
          <span>{record.nombre}</span>
          {badges.map((badge) => (
            <span
              key={badge.label}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${BADGE_TONES[badge.tone]}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      </td>
      <td className="px-5 py-3.5 text-slate-400 text-[11px] max-w-md">
        <p className="line-clamp-2" title={description}>{description || '—'}</p>
      </td>
      <td className="px-5 py-3.5">
        <ActiveToggle
          isActive={record.is_active}
          isUpdating={isUpdating}
          disabled={lockToggle}
          disabledReason={SYSTEM_RECORD_HINT}
          onToggle={() => onToggleActive(record)}
        />
      </td>
      <td className="px-5 py-3.5 text-slate-400 text-[11px] whitespace-nowrap">{formatDate(record.updated_at ?? record.created_at)}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(record)}
            title={`Editar ${definition.singular}`}
            aria-label={`Editar ${record.codigo}`}
            className={`${ICON_BUTTON} hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(record)}
            disabled={record.es_sistema}
            title={record.es_sistema ? SYSTEM_RECORD_HINT : `Eliminar ${definition.singular}`}
            aria-label={`Eliminar ${record.codigo}`}
            className={`${ICON_BUTTON} hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const CatalogTable = ({ records, isLoading, hasFilters, updatingId, ...rowProps }: CatalogTableProps) => {
  const renderBody = () => {
    if (isLoading) {
      return (
        <MessageRow>
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Cargando {rowProps.definition.label.toLowerCase()}...
        </MessageRow>
      );
    }
    if (records.length === 0) {
      return (
        <MessageRow>
          {hasFilters ? 'Ningún registro coincide con los filtros' : 'Aún no hay registros en este catálogo'}
        </MessageRow>
      );
    }
    return records.map((record) => (
      <CatalogRow key={record.id} record={record} isUpdating={updatingId === record.id} {...rowProps} />
    ));
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} className="px-5 py-3.5 font-semibold">{column}</th>
              ))}
              <th className="px-5 py-3.5 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">{renderBody()}</tbody>
        </table>
      </div>
    </div>
  );
};
