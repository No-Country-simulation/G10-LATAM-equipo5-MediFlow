import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { useCatalogs } from '../../hooks/useCatalogs';
import type { DocumentDestinationFilter } from '../../types/documents';
import { CANONICAL_QUEUES, DESTINATION_LABELS } from '../../types/documents';
import type { NivelPrioridad } from '../../types/medical';
import { FilterButtonGroup } from './FilterButtonGroup';

interface DocumentFiltersProps {
  selectedDestination: DocumentDestinationFilter;
  onSelectDestination: (dest: DocumentDestinationFilter) => void;
  selectedPrioridad: NivelPrioridad | 'ALL';
  onSelectPrioridad: (p: NivelPrioridad | 'ALL') => void;
  rutSearch: string;
  onRutSearchChange: (rut: string) => void;
}

const DocumentFilters = ({
  selectedDestination,
  onSelectDestination,
  selectedPrioridad,
  onSelectPrioridad,
  rutSearch,
  onRutSearchChange,
}: DocumentFiltersProps) => {
  const { queues } = useCatalogs();

  const prioridadOptions: { id: NivelPrioridad | 'ALL'; label: string }[] = [
    { id: 'ALL', label: 'Todas' },
    { id: 'Urgente', label: 'Urgente' },
    { id: 'Prioritario', label: 'Prioritario' },
    { id: 'Rutina', label: 'Rutina' },
  ];

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Prioridad Clínica
          </span>
          <FilterButtonGroup
            options={prioridadOptions}
            selectedValue={selectedPrioridad}
            onSelect={onSelectPrioridad}
            activeColorClass="bg-amber-500/15 text-amber-300 border border-amber-500/30"
          />
        </div>

        <div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Buscar por RUT
          </span>
          <div className="relative max-w-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Ej: 12.345.678-9"
              value={rutSearch}
              onChange={(e) => onRutSearchChange(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-slate-700 rounded-lg bg-slate-900/50 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-xs transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Destino Hospitalario
        </span>
        <FilterButtonGroup
          options={destinationOptions}
          selectedValue={selectedDestination}
          onSelect={onSelectDestination}
          activeColorClass="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
        />
      </div>
    </div>
  );
};

export default DocumentFilters;