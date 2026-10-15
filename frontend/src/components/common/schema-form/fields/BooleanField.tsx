import type { JsonValue } from '../../../../types/forms';
import type { FieldProps } from '../SchemaField';
import { INPUT } from '../ScalarInput';

const booleanoDe = (texto: string): boolean | null => {
  if (texto === 'si') return true;
  if (texto === 'no') return false;
  return null;
};

const textoDeBooleano = (valor: JsonValue | undefined): string => {
  if (valor === true) return 'si';
  if (valor === false) return 'no';
  return '';
};

/** Renderiza un campo de tipo `boolean` como selector Sí / No. */
export const BooleanField = ({ schema, value, onChange, path, label }: FieldProps) => (
  <select
    id={path}
    aria-label={label}
    disabled={schema.readOnly}
    className={INPUT}
    value={textoDeBooleano(value)}
    onChange={(e) => onChange(booleanoDe(e.target.value))}
  >
    <option value="">Sin dato</option>
    <option value="si">Sí</option>
    <option value="no">No</option>
  </select>
);
