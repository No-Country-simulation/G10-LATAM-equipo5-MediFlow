import { esMultilinea } from './schemaUtils';
import type { FieldProps } from './SchemaField';
import { StringField } from './fields/StringField';
import { NumberField } from './fields/NumberField';
import { BooleanField } from './fields/BooleanField';
import { SelectField } from './fields/SelectField';

export const INPUT =
  'w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-indigo-500/80 focus:outline-none disabled:opacity-60';
export const LABEL = 'block text-[11px] font-semibold text-slate-400 uppercase mb-1';

/**
 * Control escalar sin etiqueta (lo usan las celdas de las tablas de `ArrayFieldCard`).
 * Despacha al renderer apropiado según el tipo o la presencia de `enum`.
 */
export const ScalarInput = (props: FieldProps) => {
  if (props.schema.enum) return <SelectField {...props} />;

  const tipo = props.schema.type;
  const tipoSimple = Array.isArray(tipo) ? tipo.find((t) => t !== 'null') : tipo;

  if (tipoSimple === 'boolean') return <BooleanField {...props} />;
  if (tipoSimple === 'integer' || tipoSimple === 'number') return <NumberField {...props} />;
  return <StringField {...props} />;
};

/** Campo escalar con etiqueta (label + ScalarInput). */
export const ScalarField = (props: FieldProps) => (
  <div className={esMultilinea(props.schema) ? 'sm:col-span-2 min-w-0' : 'min-w-0'}>
    <label htmlFor={props.path} className={LABEL}>
      {props.label}
    </label>
    <ScalarInput {...props} />
  </div>
);

