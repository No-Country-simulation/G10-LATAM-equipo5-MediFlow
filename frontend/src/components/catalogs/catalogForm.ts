import type { CatalogPayload, CatalogRecord } from '../../types/catalog';
import type { CatalogField } from './catalogConfig';

export type FormValues = Record<string, string | boolean>;

export type PayloadResult = { payload: CatalogPayload; error?: undefined } | { payload?: undefined; error: string };

const recordValue = (record: CatalogRecord | undefined, name: string): unknown =>
  record ? (record as unknown as Record<string, unknown>)[name] : undefined;

const initialValue = (field: CatalogField, value: unknown): string | boolean => {
  if (field.kind === 'checkbox') return Boolean(value);
  if (field.kind === 'json') return value ? JSON.stringify(value, null, 2) : '';
  return typeof value === 'string' ? value : '';
};

/** Valores del formulario: vacíos al crear, los del registro al editar. */
export const initialValues = (fields: CatalogField[], record?: CatalogRecord): FormValues =>
  Object.fromEntries(fields.map((field) => [field.name, initialValue(field, recordValue(record, field.name))]));

const parseJsonObject = (raw: string, label: string): { value: unknown; error?: string } => {
  if (!raw.trim()) return { value: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { value: null, error: `${label}: debe ser un objeto JSON` };
    }
    return { value: parsed };
  } catch {
    return { value: null, error: `${label}: el JSON no es válido` };
  }
};

const textValue = (field: CatalogField, raw: string): string | null => {
  const trimmed = raw.trim();
  return trimmed || field.required ? trimmed : null;
};

/**
 * Convierte el formulario en el body del backend. En edición omite los campos `createOnly`
 * (el `codigo`); los textos opcionales vacíos se envían como `null`.
 */
export const buildPayload = (fields: CatalogField[], values: FormValues, isEdit: boolean): PayloadResult => {
  const payload: CatalogPayload = {};
  for (const field of fields) {
    if (isEdit && field.createOnly) continue;
    const raw = values[field.name];

    if (field.kind === 'checkbox') {
      payload[field.name] = Boolean(raw);
    } else if (field.kind === 'json') {
      const { value, error } = parseJsonObject(String(raw), field.label);
      if (error) return { error };
      payload[field.name] = value;
    } else {
      payload[field.name] = textValue(field, String(raw));
    }
  }
  return { payload };
};
