import type { FieldProps } from '../SchemaField';
import { comoObjeto, etiquetaDe, propiedadesDe } from '../schemaUtils';
import type { JsonObject, JsonValue } from '../../../../types/forms';
import { SchemaField } from '../SchemaField';

/**
 * Renderiza un subesquema de tipo `object` como un grupo de campos anidados.
 * Cuando recibe `label`, lo envuelve en un fieldset con legend para accesibilidad.
 * `min-w-0`: un fieldset tiene por defecto min-width: min-content y desbordaría el panel.
 */
export const ObjectField = ({ schema, value, onChange, path, label }: FieldProps) => {
  const objeto = comoObjeto(value);
  const cambiar = (campo: string, nuevo: JsonValue) =>
    onChange({ ...objeto, [campo]: nuevo } as JsonObject);

  const campos = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
      {propiedadesDe(schema).map(([campo, hijo]) => (
        <SchemaField
          key={campo}
          schema={hijo}
          value={objeto[campo]}
          onChange={(nuevo) => cambiar(campo, nuevo)}
          path={`${path}.${campo}`}
          label={etiquetaDe(campo, hijo)}
        />
      ))}
    </div>
  );

  if (!label) return campos;

  return (
    <fieldset className="sm:col-span-2 min-w-0 rounded-xl border border-slate-800 p-3">
      <legend className="px-1 text-[11px] font-semibold text-slate-300 uppercase">{label}</legend>
      {campos}
    </fieldset>
  );
};
