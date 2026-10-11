import { Plus, Trash2 } from 'lucide-react';
import type { JsonObject, JsonSchema, JsonValue } from '../../../types/forms';
import {
  comoLista,
  comoObjeto,
  esEscalar,
  esMultilinea,
  etiquetaDe,
  propiedadesDe,
  tipoDe,
  valorInicial,
} from './schemaUtils';

/**
 * Campo de formulario dibujado a partir de un JSON Schema del backend. Se usa en auditoría para
 * mostrar los campos de cada tipo de documento (los mismos que extrae la IA).
 *
 * - texto: una línea o área de texto según `maxLength`; `format: date` -> selector de fecha
 * - `enum` -> lista de opciones; `boolean` -> Sí / No / Sin dato; números
 * - objeto -> grupo de campos; lista de objetos simples -> tabla; lista con sublistas -> tarjetas
 */

const INPUT = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-indigo-500/80 focus:outline-none disabled:opacity-60';
const LABEL = 'block text-[11px] font-semibold text-slate-400 uppercase mb-1';
const BOTON_AGREGAR = 'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition cursor-pointer';
const BOTON_QUITAR = 'p-1 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer';

interface FieldProps {
  schema: JsonSchema;
  value: JsonValue | undefined;
  onChange: (value: JsonValue) => void;
  /** Identificador único (ruta del campo), para asociar la etiqueta. */
  path: string;
  label?: string;
}

const textoONulo = (texto: string): string | null => (texto.trim() === '' ? null : texto);

const numeroONulo = (texto: string): number | null => {
  if (texto.trim() === '') return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
};

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

/** Control sin etiqueta (lo usan las celdas de las tablas). */
const ScalarInput = ({ schema, value, onChange, path, label }: FieldProps) => {
  const tipo = tipoDe(schema);
  const comun = { id: path, 'aria-label': label, disabled: schema.readOnly, className: INPUT };
  const texto = value === null || value === undefined ? '' : String(value);

  if (schema.enum) {
    return (
      <select {...comun} value={texto} onChange={(e) => onChange(textoONulo(e.target.value))}>
        <option value="">—</option>
        {schema.enum
          .filter((opcion) => opcion !== null)
          .map((opcion) => (
            <option key={String(opcion)} value={String(opcion)}>
              {String(opcion)}
            </option>
          ))}
      </select>
    );
  }
  if (tipo === 'boolean') {
    return (
      <select {...comun} value={textoDeBooleano(value)} onChange={(e) => onChange(booleanoDe(e.target.value))}>
        <option value="">Sin dato</option>
        <option value="si">Sí</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (tipo === 'integer' || tipo === 'number') {
    return (
      <input
        {...comun}
        type="number"
        min={schema.minimum}
        step={tipo === 'integer' ? 1 : 'any'}
        value={texto}
        onChange={(e) => onChange(numeroONulo(e.target.value))}
      />
    );
  }
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

const ScalarField = (props: FieldProps) => (
  <div className={esMultilinea(props.schema) ? 'sm:col-span-2' : undefined}>
    <label htmlFor={props.path} className={LABEL}>
      {props.label}
    </label>
    <ScalarInput {...props} />
  </div>
);

const ObjectField = ({ schema, value, onChange, path, label }: FieldProps) => {
  const objeto = comoObjeto(value);
  const cambiar = (campo: string, nuevo: JsonValue) => onChange({ ...objeto, [campo]: nuevo } as JsonObject);
  const campos = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
    <fieldset className="sm:col-span-2 rounded-xl border border-slate-800 p-3">
      <legend className="px-1 text-[11px] font-semibold text-slate-300 uppercase">{label}</legend>
      {campos}
    </fieldset>
  );
};

const TablaDeObjetos = ({ schema, value, onChange, path }: FieldProps & { items: JsonSchema }) => {
  const filas = comoLista(value);
  const columnas = propiedadesDe(schema.items ?? {});
  const cambiar = (indice: number, campo: string, nuevo: JsonValue) =>
    onChange(filas.map((fila, i) => (i === indice ? { ...comoObjeto(fila), [campo]: nuevo } : fila)));

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-xs">
        <thead className="bg-slate-950/70 text-[10px] uppercase text-slate-400">
          <tr>
            {columnas.map(([campo, hijo]) => (
              <th key={campo} className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">
                {etiquetaDe(campo, hijo)}
              </th>
            ))}
            <th className="w-8" aria-label="Acciones" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {filas.map((fila, indice) => (
            // El orden de las filas solo cambia al agregar al final o quitar: el índice es estable.
            <tr key={indice}>
              {columnas.map(([campo, hijo]) => (
                <td key={campo} className="px-1.5 py-1 min-w-28">
                  <ScalarInput
                    schema={hijo}
                    value={comoObjeto(fila)[campo]}
                    onChange={(nuevo) => cambiar(indice, campo, nuevo)}
                    path={`${path}.${indice}.${campo}`}
                    label={`${etiquetaDe(campo, hijo)} (fila ${indice + 1})`}
                  />
                </td>
              ))}
              <td className="px-1">
                <button type="button" onClick={() => onChange(filas.filter((_, i) => i !== indice))} aria-label={`Quitar fila ${indice + 1}`} className={BOTON_QUITAR}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ArrayField = ({ schema, value, onChange, path, label }: FieldProps) => {
  const filas = comoLista(value);
  const items = schema.items ?? { type: 'string' };
  const agregar = () => onChange([...filas, valorInicial(items)]);
  const quitar = (indice: number) => onChange(filas.filter((_, i) => i !== indice));
  const cambiarFila = (indice: number, nuevo: JsonValue) => onChange(filas.map((fila, i) => (i === indice ? nuevo : fila)));
  const filasSimples = tipoDe(items) === 'object' && propiedadesDe(items).every(([, hijo]) => esEscalar(hijo));

  const renderFilas = () => {
    if (filasSimples) return filas.length ? <TablaDeObjetos schema={schema} value={filas} onChange={onChange} path={path} items={items} /> : null;
    return filas.map((fila, indice) => (
      <div key={indice} className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <div className="flex-1">
          {esEscalar(items) ? (
            <ScalarInput schema={items} value={fila} onChange={(nuevo) => cambiarFila(indice, nuevo)} path={`${path}.${indice}`} label={`${label} ${indice + 1}`} />
          ) : (
            <SchemaField schema={items} value={fila} onChange={(nuevo) => cambiarFila(indice, nuevo)} path={`${path}.${indice}`} />
          )}
        </div>
        <button type="button" onClick={() => quitar(indice)} aria-label={`Quitar ${label ?? 'elemento'} ${indice + 1}`} className={BOTON_QUITAR}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ));
  };

  return (
    <div className="sm:col-span-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className={LABEL}>
          {label} {filas.length > 0 && <span className="text-slate-500 normal-case">({filas.length})</span>}
        </span>
        <button type="button" onClick={agregar} className={BOTON_AGREGAR}>
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>
      {filas.length === 0 && <p className="text-[11px] text-slate-500 italic">Sin registros.</p>}
      {renderFilas()}
    </div>
  );
};

export const SchemaField = (props: FieldProps) => {
  const tipo = tipoDe(props.schema);
  if (tipo === 'object') return <ObjectField {...props} />;
  if (tipo === 'array') return <ArrayField {...props} />;
  return <ScalarField {...props} />;
};
