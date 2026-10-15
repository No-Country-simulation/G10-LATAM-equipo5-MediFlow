import type { JsonSchema, JsonValue } from '../../../types/forms';
import { tipoDe } from './schemaUtils';
import { ScalarField } from './ScalarInput';
import { ArrayFieldCard } from './ArrayFieldCard';
import { ObjectField } from './fields/ObjectField';

/**
 * Campo de formulario dibujado a partir de un JSON Schema del backend. Se usa en auditoría para
 * mostrar los campos de cada tipo de documento (los mismos que extrae la IA).
 */
export interface FieldProps {
  schema: JsonSchema;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  /** Identificador único (ruta del campo), para asociar la etiqueta. */
  path: string;
  label?: string;
}

/**
 * Dispatcher: determina qué renderer específico usar según el `type` del schema.
 * - `object`  → ObjectField  (sub-campos anidados)
 * - `array`   → ArrayFieldCard (filas dinámicas)
 * - cualquier otro → ScalarField (string, number, boolean, enum)
 */
export const SchemaField = (props: FieldProps) => {
  const tipo = tipoDe(props.schema);
  if (tipo === 'object') return <ObjectField {...props} />;
  if (tipo === 'array') return <ArrayFieldCard {...props} />;
  return <ScalarField {...props} />;
};
