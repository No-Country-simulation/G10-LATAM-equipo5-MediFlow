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

/** Detecta si un valor corresponde a un JSON Schema configurado con propiedades o claves. */
export const hasConfiguredSchema = (value: unknown): boolean => {
  if (!value) return false;
  if (typeof value === 'object') {
    return !Array.isArray(value) && Object.keys(value).length > 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === '{}') return false;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && Object.keys(parsed).length > 0;
    } catch {
      return false;
    }
  }
  return false;
};

/** Validación sintáctica en tiempo real del JSON Schema para advertir al usuario antes de enviar. */
export const validateJsonSyntax = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return 'Formato JSON inválido: revise comillas, llaves y comas.';
    }
    return null;
  } catch {
    return 'Formato JSON inválido: revise comillas, llaves y comas.';
  }
};

const parseJsonObject = (raw: string, label: string): { value: unknown; error?: string } => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '{}') return { value: null };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { value: null, error: `${label}: debe ser un objeto JSON` };
    }
    if (Object.keys(parsed).length === 0) {
      return { value: null };
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
 * (el `codigo`); esquemas JSON vacíos y textos opcionales vacíos se envían como `null` para evitar 422.
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
