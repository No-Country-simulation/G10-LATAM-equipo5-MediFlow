import React, { useState } from 'react';
import { Loader2, Pencil, Plus, Save } from 'lucide-react';
import type { CatalogPayload, CatalogRecord } from '../../types/catalog';
import { ModalShell } from '../common/ModalShell';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_GHOST, BUTTON_PRIMARY } from '../common/formStyles';
import type { CatalogDefinition } from './catalogConfig';
import { buildPayload, initialValues, validateJsonSyntax, type FormValues } from './catalogForm';
import { FieldInput } from './FieldInput';
import { JsonSchemaAccordion } from './JsonSchemaAccordion';

interface CatalogFormModalProps {
  definition: CatalogDefinition;
  /** Registro a editar; sin él, el formulario crea uno nuevo. */
  record?: CatalogRecord;
  onClose: () => void;
  onCreate: (payload: CatalogPayload) => Promise<boolean>;
  onUpdate: (id: string, payload: CatalogPayload) => Promise<boolean>;
}

/** Alta y edición de un registro de cualquier catálogo, con soporte de acordeón para esquemas JSON. */
export const CatalogFormModal: React.FC<CatalogFormModalProps> = ({
  definition,
  record,
  onClose,
  onCreate,
  onUpdate,
}) => {
  const isEdit = record !== undefined;
  const [values, setValues] = useState<FormValues>(() => initialValues(definition.fields, record));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const mainFields = definition.fields.filter((field) => field.kind !== 'json');
  const jsonField = definition.fields.find((field) => field.kind === 'json');

  const jsonValue = jsonField ? String(values[jsonField.name] ?? '') : '';
  const jsonSyntaxError = jsonField ? validateJsonSyntax(jsonValue) : null;
  const isSubmitDisabled = isSubmitting || Boolean(jsonSyntaxError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonSyntaxError) return;

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
        {mainFields.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            value={values[field.name]}
            disabled={isEdit && Boolean(field.createOnly)}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.name]: value }))}
          />
        ))}

        {jsonField && (
          <JsonSchemaAccordion
            field={jsonField}
            value={jsonValue}
            disabled={isSubmitting}
            error={jsonSyntaxError}
            onChange={(value) => setValues((prev) => ({ ...prev, [jsonField.name]: value }))}
          />
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={BUTTON_GHOST}>
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitDisabled} className={BUTTON_PRIMARY}>
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : submitIcon}
            <span>{isEdit ? 'Guardar Cambios' : 'Crear'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
