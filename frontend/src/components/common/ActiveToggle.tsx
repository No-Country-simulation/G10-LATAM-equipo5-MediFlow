interface ActiveToggleProps {
  isActive: boolean;
  isUpdating: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onToggle: () => void;
}

const toggleTitle = (isActive: boolean, disabled: boolean, disabledReason?: string): string | undefined => {
  if (disabled) return disabledReason;
  return isActive ? 'Clic para desactivar' : 'Clic para reactivar';
};

const statusLabel = (isActive: boolean, isUpdating: boolean): string => {
  if (isUpdating) return 'Actualizando...';
  return isActive ? 'Activo' : 'Inactivo';
};

/** Interruptor activo/inactivo con su etiqueta, tal como en el directorio de usuarios. */
export const ActiveToggle = ({ isActive, isUpdating, disabled = false, disabledReason, onToggle }: ActiveToggleProps) => {
  const title = toggleTitle(isActive, disabled, disabledReason);

  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        aria-label={title}
        disabled={disabled || isUpdating}
        onClick={onToggle}
        title={title}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
          isActive ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-slate-700 hover:bg-slate-600'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            isActive ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className={`text-[11px] font-medium ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
        {statusLabel(isActive, isUpdating)}
      </span>
    </div>
  );
};
