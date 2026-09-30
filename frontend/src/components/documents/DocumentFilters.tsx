import type { DocumentCategoryFilter, DocumentDestinationFilter } from '../../types/documents';

interface FilterOption<T> {
  id: T;
  label: string;
}

interface DocumentFiltersProps {
  selectedCategory: DocumentCategoryFilter;
  onSelectCategory: (cat: DocumentCategoryFilter) => void;
  selectedDestination: DocumentDestinationFilter;
  onSelectDestination: (dest: DocumentDestinationFilter) => void;
}

const CATEGORY_OPTIONS: FilterOption<DocumentCategoryFilter>[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'RECETA', label: 'Recetas Médicas' },
  { id: 'LABORATORIO', label: 'Laboratorio' },
  { id: 'IMAGENES', label: 'Imágenes' },
  { id: 'SOLICITUD_PROCEDIMIENTO', label: 'Procedimientos' },
  { id: 'EPICRISIS', label: 'Epicrisis / Altas' },
  { id: 'INTERCONSULTA', label: 'Interconsultas' },
  { id: 'ANATOMIA_PATOLOGICA', label: 'Anatomía Patológica' },
  { id: 'PROTOCOLO_OPERATORIO', label: 'Protocolo Operatorio' },
  { id: 'OTRO', label: 'Otros' },
];

const DESTINATION_OPTIONS: FilterOption<DocumentDestinationFilter>[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'Cola_Emergencia_Medica', label: 'Urgencias' },
  { id: 'Farmacia_Hospitalaria', label: 'Farmacia' },
  { id: 'Cola_Oncologia', label: 'Oncología' },
  { id: 'Gestion_Procedimientos', label: 'Procedimientos' },
  { id: 'Gestion_Interconsultas', label: 'Interconsultas' },
  { id: 'Ficha_Clinica', label: 'Ficha Clínica' },
  { id: 'OTROS', label: 'Otras Derivaciones' },
];

const DocumentFilters = ({
  selectedCategory,
  onSelectCategory,
  selectedDestination,
  onSelectDestination,
}: DocumentFiltersProps) => {
  return (
    <div className="space-y-3.5 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
      <div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Categoría Documental
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map(({ id, label }) => {
            const isSelected = selectedCategory === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectCategory(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Destino Hospitalario
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DESTINATION_OPTIONS.map(({ id, label }) => {
            const isSelected = selectedDestination === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectDestination(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DocumentFilters;