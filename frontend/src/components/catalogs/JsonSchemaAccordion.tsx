import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { HINT, INPUT_BASE, LABEL } from '../common/formStyles';
import type { CatalogField } from './catalogConfig';
import { hasConfiguredSchema } from './catalogForm';

interface JsonSchemaAccordionProps {
  field: CatalogField;
  value: string;
  disabled: boolean;
  error: string | null;
  onChange: (value: string) => void;
}

export const JsonSchemaAccordion: React.FC<JsonSchemaAccordionProps> = ({
  field,
  value,
  disabled,
  error,
  onChange,
}) => {
  const hasActiveSchema = hasConfiguredSchema(value);
  // Se inicializa abierto solo si ya cuenta con un esquema JSON configurado; de lo contrario inicia cerrado por defecto.
  const [isOpen, setIsOpen] = useState(() => hasConfiguredSchema(value));
  const id = `catalog-field-${field.name}`;

  return (
    <div className="pt-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700/80 text-sm text-slate-400 hover:text-slate-200 transition-all cursor-pointer group text-left disabled:opacity-50 disabled:cursor-not-allowed"
        aria-expanded={isOpen}
      >
        <span className="text-xs sm:text-sm font-medium">
          {isOpen
            ? '▾ Ocultar opciones avanzadas (JSON Schema)'
            : '▸ Opciones avanzadas: Campos adicionales estructurados (JSON Schema - Opcional)'}
        </span>
        {error ? (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 shrink-0">
            JSON inválido
          </span>
        ) : hasActiveSchema ? (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0">
            Esquema activo
          </span>
        ) : null}
      </button>

      {isOpen && (
        <div className="mt-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/70 space-y-2">
          <label htmlFor={id} className={LABEL}>
            {field.label}
          </label>
          <textarea
            id={id}
            rows={7}
            disabled={disabled}
            placeholder={field.placeholder}
            value={value}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full px-3 resize-y font-mono text-[11px] ${INPUT_BASE} ${
              error ? 'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/40' : ''
            }`}
          />
          {error && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {field.hint && <p className={HINT}>{field.hint}</p>}
        </div>
      )}
    </div>
  );
};
