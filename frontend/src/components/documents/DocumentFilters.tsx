import type { DocumentCategoryFilter, DocumentDestinationFilter } from '../../types/documents';

interface DocumentFiltersProps {
  selectedCategory: DocumentCategoryFilter;
  onSelectCategory: (cat: DocumentCategoryFilter) => void;
  selectedDestination: DocumentDestinationFilter;
  onSelectDestination: (dest: DocumentDestinationFilter) => void;
}

const CATEGORY_OPTIONS: Array<{ id: DocumentCategoryFilter; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'RECETAS', label: 'Recetas Médicas' },
  { id: 'IMAGENES', label: 'Estudios por Imágenes' },
  { id: 'LABORATORIO', label: 'Exámenes de Laboratorio' },
  { id: 'PROCEDIMIENTOS', label: 'Solicitudes de Procedimientos' },
  { id: 'EPICRISIS', label: 'Epicrisis / Altas' },
  { id: 'CERTIFICADOS', label: 'Certificados Médicos' },
];

const DESTINATION_OPTIONS: Array<{ id: DocumentDestinationFilter; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'FARMACIA', label: 'Farmacia Hospitalaria' },
  { id: 'URGENCIAS', label: 'Urgencias' },
  { id: 'AUTORIZACIONES', label: 'Autorizaciones' },
  { id: 'FICHA_CLINICA', label: 'Ficha Clínica' },
];

const DocumentFilters = ({
  selectedCategory,
  onSelectCategory,
  selectedDestination,
  onSelectDestination,
}: DocumentFiltersProps) => {
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
      <div>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Categoría Documental
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Destino Hospitalario
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DESTINATION_OPTIONS.map((dest) => (
            <button
              key={dest.id}
              type="button"
              onClick={() => onSelectDestination(dest.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedDestination === dest.id
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-950/60 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {dest.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DocumentFilters;
