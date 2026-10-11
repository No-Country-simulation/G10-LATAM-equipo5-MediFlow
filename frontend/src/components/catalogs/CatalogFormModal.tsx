import React, { useState } from 'react';
import { Loader2, Pencil, Plus, Save } from 'lucide-react';
import type { CatalogPayload, CatalogRecord } from '../../types/catalog';
import { ModalShell } from '../common/ModalShell';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_GHOST, BUTTON_PRIMARY, HINT, INPUT_BASE, LABEL } from '../common/formStyles';
import type { CatalogDefinition, CatalogField } from './catalogConfig';
import { buildPayload, initialValues, type FormValues } from './catalogForm';

interface CatalogFormModalProps {
  definition: CatalogDefinition;
  /** Registro a editar; sin él, el formulario crea uno nuevo. */
  record?: CatalogRecord;
  onClose: () => void;
  onCreate: (payload: CatalogPayload) => Promise<boolean>;
  onUpdate: (id: string, payload: CatalogPayload) => Promise<boolean>;
}

interface FieldInputProps {
  field: CatalogField;
  value: string | boolean;
  disabled: boolean;
  onChange: (value: string | boolean) => void;
}

const fieldId = (name: string) => `catalog-field-${name}`;

const FieldInput = ({ field, value, disabled, onChange }: FieldInputProps) => {
  const id = fieldId(field.name);

  if (field.kind === 'checkbox') {
    return (
      <label htmlFor={id} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/50 border border-slate-800 cursor-pointer">
        <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-indigo-500 cursor-pointer" />
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

/** Alta y edición de un registro de cualquier catálogo, a partir de su definición. */
export const CatalogFormModal: React.FC<CatalogFormModalProps> = ({ definition, record, onClose, onCreate, onUpdate }) => {
  const isEdit = record !== undefined;
  const [values, setValues] = useState<FormValues>(() => initialValues(definition.fields, record));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { payload, error } = buildPayload(definition.fields, values, isEdit);
    if (error !== undefined) {
      setLocalError(error);
      return;
    }
    setLocalError(null);
    setIsSubmitting(true);
    const success = isEdit ? await onUpdate(record.id, payload) : await onCreate(payload);
    setIsSubmitting(false);
    if (success) onClose();
  };

  const submitIcon = isEdit ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />;

  return (
    <ModalShell
      titleId="catalog-form-modal-title"
      title={isEdit ? `Editar ${definition.singular}` : definition.newLabel}
      subtitle={isEdit ? `Código ${record.codigo}` : definition.label}
      icon={isEdit ? Pencil : definition.icon}
      maxWidth="max-w-lg"
      onClose={onClose}
      closeDisabled={isSubmitting}
    >
      {localError && (
        <div className="mt-4">
          <StatusBanner tone="error" message={localError} />
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} autoComplete="off" className="mt-4 space-y-3.5">
        {definition.fields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={values[field.name]}
            disabled={isEdit && Boolean(field.createOnly)}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
          />
        ))}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={BUTTON_GHOST}>Cancelar</button>
          <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : submitIcon}
            <span>{isEdit ? 'Guardar Cambios' : 'Crear'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
