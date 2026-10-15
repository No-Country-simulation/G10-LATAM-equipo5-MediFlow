import type { FieldProps } from '../SchemaField';
import { esMultilinea } from '../schemaUtils';
import { INPUT } from '../ScalarInput';

const textoONulo = (texto: string): string | null => (texto.trim() === '' ? null : texto);

/** Renderiza un campo de tipo `string`: input de texto, textarea o input de fecha. */
export const StringField = ({ schema, value, onChange, path, label }: FieldProps) => {
  const texto = value === null || value === undefined ? '' : String(value);
  const comun = { id: path, 'aria-label': label, disabled: schema.readOnly, className: INPUT };

  if (esMultilinea(schema)) {
    return (
      <textarea
        {...comun}
        rows={3}
        maxLength={schema.maxLength}
        value={texto}
        onChange={(e) => onChange(textoONulo(e.target.value))}
        className={`${INPUT} resize-y`}
      />
    );
  }

  return (
    <input
      {...comun}
      type={schema.format === 'date' ? 'date' : 'text'}
      maxLength={schema.maxLength}
      value={texto}
      onChange={(e) => onChange(textoONulo(e.target.value))}
    />
  );
};
