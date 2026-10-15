import type { FieldProps } from '../SchemaField';
import { INPUT } from '../ScalarInput';
import { etiquetaDeCodigo } from '../../../../utils/etiquetas';

const textoONulo = (texto: string): string | null => (texto.trim() === '' ? null : texto);

/**
 * Renderiza un campo con `enum` definido como selector desplegable.
 * Filtra valores `null` del catálogo y aplica etiquetas legibles.
 */
export const SelectField = ({ schema, value, onChange, path, label }: FieldProps) => {
  const texto = value === null || value === undefined ? '' : String(value);
  return (
    <select
      id={path}
      aria-label={label}
      disabled={schema.readOnly}
      className={INPUT}
      value={texto}
      onChange={(e) => onChange(textoONulo(e.target.value))}
    >
      <option value="">—</option>
      {(schema.enum ?? [])
        .filter((opcion) => opcion !== null)
        .map((opcion) => (
          <option key={String(opcion)} value={String(opcion)}>
            {etiquetaDeCodigo(opcion)}
          </option>
        ))}
    </select>
  );
};
