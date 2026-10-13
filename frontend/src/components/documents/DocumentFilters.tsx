import { useMemo } from 'react';
import { Search, CalendarDays, RotateCcw } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useActiveAreas } from '../../hooks/useActiveAreas';
import type { DocumentDestinationFilter, DocumentFiltersValue, DocumentStatusFilter } from '../../types/documents';
import { CANONICAL_QUEUES, DESTINATION_LABELS } from '../../types/documents';
import type { NivelPrioridad } from '../../types/medical';
import { DATE_PRESET_OPTIONS, toInputDate } from '../../utils/dateRange';
import { FilterButtonGroup } from './FilterButtonGroup';
import { INPUT_BASE } from '../common/formStyles';

interface DocumentFiltersProps {
  filters: DocumentFiltersValue;
  onChange: (patch: Partial<DocumentFiltersValue>) => void;
  onReset: () => void;
  isDirty: boolean;
  /** Un operador solo ve sus propios documentos: el filtro por área no le aporta. */
  showAreaFilter: boolean;
  /** Solo el ADMIN puede ver los documentos eliminados. */
  showDeletedFilter: boolean;
}

const SECTION_LABEL = 'text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2';
const FIELD =
  'block w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-xs transition-colors [color-scheme:dark]';

const prioridadOptions: { id: NivelPrioridad | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Todas' },
  { id: 'Urgente', label: 'Urgente' },
  { id: 'Prioritario', label: 'Prioritario' },
  { id: 'Rutina', label: 'Rutina' },
];

const estadoOptions: { id: DocumentStatusFilter; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'PROCESADO', label: 'Procesados' },
  { id: 'AUDITADO', label: 'Auditados' },
  { id: 'PENDIENTE_AUDITORIA', label: 'En auditoría' },
  { id: 'DESCARTADO', label: 'Descartados' },
];

const DocumentFilters = ({ filters, onChange, onReset, isDirty, showAreaFilter, showDeletedFilter }: DocumentFiltersProps) => {
  const { queues } = useCatalogs();
  const { areas } = useActiveAreas(showAreaFilter);
  const today = toInputDate(new Date());

  const destinationOptions = useMemo(() => {
    const queueList = queues.length > 0
      ? queues.map((q) => ({ id: q.codigo as DocumentDestinationFilter, label: q.nombre }))
      : CANONICAL_QUEUES.map((code) => ({ id: code as DocumentDestinationFilter, label: DESTINATION_LABELS[code] ?? code }));

    return [
      { id: 'ALL' as DocumentDestinationFilter, label: 'Todos' },
      ...queueList,
      { id: 'OTROS' as DocumentDestinationFilter, label: 'Otras Derivaciones' },
    ];
  }, [queues]);

  return (
    <div className="space-y-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`${SECTION_LABEL} mb-0 flex items-center gap-1.5`}>
            <CalendarDays className="w-3.5 h-3.5" />
            Fecha de ingreso
          </span>
          {isDirty && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Limpiar filtros
            </button>
          )}
        </div>
        <FilterButtonGroup
          options={DATE_PRESET_OPTIONS}
          selectedValue={filters.datePreset}
          onSelect={(datePreset) => onChange({ datePreset })}
          activeColorClass="bg-sky-500/15 text-sky-300 border border-sky-500/30"
        />
        {filters.datePreset === 'RANGO' && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-[11px] text-slate-400">
              Desde
              <input
                type="date"
                value={filters.fechaDesde}
                max={filters.fechaHasta || today}
                onChange={(e) => e.target.value && onChange({ fechaDesde: e.target.value })}
                className={`${FIELD} mt-1 w-40`}
              />
            </label>
            <label className="text-[11px] text-slate-400">
              Hasta
              <input
                type="date"
                value={filters.fechaHasta}
                min={filters.fechaDesde || undefined}
                max={today}
                onChange={(e) => e.target.value && onChange({ fechaHasta: e.target.value })}
                className={`${FIELD} mt-1 w-40`}
              />
            </label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
        <div>
          <span className={SECTION_LABEL}>Estado</span>
          <FilterButtonGroup
            options={showDeletedFilter ? [...estadoOptions, { id: 'ELIMINADO', label: 'Eliminados' }] : estadoOptions}
            selectedValue={filters.estado}
            onSelect={(estado) => onChange({ estado })}
            activeColorClass="bg-violet-500/15 text-violet-300 border border-violet-500/30"
          />
        </div>

        <div>
          <span className={SECTION_LABEL}>Prioridad Clínica</span>
          <FilterButtonGroup
            options={prioridadOptions}
            selectedValue={filters.prioridad}
            onSelect={(prioridad) => onChange({ prioridad })}
            activeColorClass="bg-amber-500/15 text-amber-300 border border-amber-500/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className={SECTION_LABEL}>Buscar por identificación</span>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="RUT, DNI, cédula... (ej: 12.345.678-5)"
              value={filters.identificacion}
              onChange={(e) => onChange({ identificacion: e.target.value })}
              className={`${FIELD} pl-9`}
            />
          </div>
        </div>

        {showAreaFilter && (
          <div>
            <span className={SECTION_LABEL}>Área de origen</span>
            <select
              value={filters.areaOrigenId}
              onChange={(e) => onChange({ areaOrigenId: e.target.value })}
              className={`w-full px-3 cursor-pointer ${INPUT_BASE}`}
            >
              <option value="" className="bg-slate-900 text-white">Todas las áreas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id} className="bg-slate-900 text-white">
                  {area.nombre}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-800/80">
        <span className={SECTION_LABEL}>Destino Hospitalario</span>
        <FilterButtonGroup
          options={destinationOptions}
          selectedValue={filters.destino}
          onSelect={(destino) => onChange({ destino })}
          activeColorClass="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
        />
      </div>
    </div>
  );
};

export default DocumentFilters;
