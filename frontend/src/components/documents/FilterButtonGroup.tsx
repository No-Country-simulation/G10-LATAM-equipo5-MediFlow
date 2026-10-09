interface FilterOption<T> {
  id: T;
  label: string;
}

interface FilterButtonGroupProps<T extends string> {
  options: FilterOption<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  activeColorClass: string;
}

export function FilterButtonGroup<T extends string>({
  options,
  selectedValue,
  onSelect,
  activeColorClass,
}: FilterButtonGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(({ id, label }) => {
        const isSelected = selectedValue === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isSelected
                ? activeColorClass
                : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
