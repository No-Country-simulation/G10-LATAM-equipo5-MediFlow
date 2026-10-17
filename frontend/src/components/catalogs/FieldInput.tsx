import React from 'react';
import { HINT, INPUT_BASE, LABEL } from '../common/formStyles';
import type { CatalogField } from './catalogConfig';

interface FieldInputProps {
  field: CatalogField;
  value: string | boolean;
  disabled: boolean;
  onChange: (value: string | boolean) => void;
}

const fieldId = (name: string) => `catalog-field-${name}`;

export const FieldInput: React.FC<FieldInputProps> = ({ field, value, disabled, onChange }) => {
  const id = fieldId(field.name);

  if (field.kind === 'checkbox') {
    return (
      <label htmlFor={id} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/50 border border-slate-800 cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 accent-indigo-500 cursor-pointer"
        />
        <span>
          <span className="block text-xs font-medium text-slate-200">{field.label}</span>
          {field.hint && <span className={HINT}>{field.hint}</span>}
        </span>
      </label>
    );
  }

  const common = {
    id,
    required: field.required,
    disabled,
    maxLength: field.maxLength,
    placeholder: field.placeholder,
    value: String(value),
  };
  const isMultiline = field.kind === 'textarea' || field.kind === 'json';

  return (
    <div>
      <label htmlFor={id} className={LABEL}>{field.label}</label>
      {isMultiline ? (
        <textarea
          {...common}
          rows={field.kind === 'json' ? 7 : 3}
          spellCheck={field.kind !== 'json'}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 resize-y ${field.kind === 'json' ? 'font-mono text-[11px]' : ''} ${INPUT_BASE}`}
        />
      ) : (
        <input
          {...common}
          type="text"
          autoComplete="off"
          pattern={field.pattern}
          title={field.patternTitle}
          onChange={(e) => onChange(field.uppercase ? e.target.value.toUpperCase() : e.target.value)}
          className={`w-full px-3 ${field.name === 'codigo' ? 'font-mono' : ''} ${INPUT_BASE}`}
        />
      )}
      {field.hint && <p className={HINT}>{field.hint}</p>}
    </div>
  );
};
