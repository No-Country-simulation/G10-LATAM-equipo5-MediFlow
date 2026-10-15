import type { FieldProps } from '../SchemaField';
import { tipoDe } from '../schemaUtils';
import { INPUT } from '../ScalarInput';

const numeroONulo = (texto: string): number | null => {
  if (texto.trim() === '') return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
};

/** Renderiza un campo de tipo `integer` o `number`. */
export const NumberField = ({ schema, value, onChange, path, label }: FieldProps) => {
  const tipo = tipoDe(schema);
  const texto = value === null || value === undefined ? '' : String(value);
  return (
    <input
      id={path}
      aria-label={label}
      disabled={schema.readOnly}
      className={INPUT}
      type="number"
      min={schema.minimum}
      step={tipo === 'integer' ? 1 : 'any'}
      value={texto}
      onChange={(e) => onChange(numeroONulo(e.target.value))}
    />
  );
};
