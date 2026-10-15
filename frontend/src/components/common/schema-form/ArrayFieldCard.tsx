import { Plus, Trash2 } from 'lucide-react';
import type { JsonSchema, JsonValue } from '../../../types/forms';
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
import { LABEL, ScalarInput } from './ScalarInput';
import { SchemaField, type FieldProps } from './SchemaField';

const BOTON_AGREGAR =
  'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 transition cursor-pointer';
const BOTON_QUITAR =
  'p-1 rounded-md text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer';

/**
 * Filas de una lista de objetos simples (parámetros, medicamentos, diagnósticos...). Cada fila es una
 * tarjeta compacta cuyos campos se reacomodan solos al ancho disponible: nunca hay scroll horizontal.
 */
const FilasCompactas = ({ value, onChange, path, items }: FieldProps & { items: JsonSchema }) => {
  const filas = comoLista(value);
  const campos = propiedadesDe(items);
  const cambiar = (indice: number, campo: string, nuevo: JsonValue) =>
    onChange(filas.map((fila, i) => (i === indice ? { ...comoObjeto(fila), [campo]: nuevo } : fila)));

  return (
    <div className="space-y-2">
      {filas.map((fila, indice) => (
        // El orden de las filas solo cambia al agregar al final o quitar: el índice es estable.
        <div key={indice} className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/40 p-2">
          <span className="mt-6 w-5 shrink-0 text-center text-[10px] font-semibold text-slate-500">{indice + 1}</span>
          <div className="grid flex-1 min-w-0 gap-2 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))]">
            {campos.map(([campo, hijo]) => (
              <div key={campo} className={esMultilinea(hijo) ? 'col-span-full min-w-0' : 'min-w-0'}>
                <label htmlFor={`${path}.${indice}.${campo}`} className="block text-[10px] leading-tight font-semibold text-slate-500 uppercase mb-0.5 break-words">
                  {etiquetaDe(campo, hijo)}
                </label>
                <ScalarInput schema={hijo} value={comoObjeto(fila)[campo]} onChange={(nuevo) => cambiar(indice, campo, nuevo)} path={`${path}.${indice}.${campo}`} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onChange(filas.filter((_, i) => i !== indice))} aria-label={`Quitar fila ${indice + 1}`} className={`${BOTON_QUITAR} mt-5 shrink-0`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const ArrayFieldCard = ({ schema, value, onChange, path, label }: FieldProps) => {
  const filas = comoLista(value);
  const items = schema.items ?? { type: 'string' };
  const agregar = () => onChange([...filas, valorInicial(items)]);
  const quitar = (indice: number) => onChange(filas.filter((_, i) => i !== indice));
  const cambiarFila = (indice: number, nuevo: JsonValue) =>
    onChange(filas.map((fila, i) => (i === indice ? nuevo : fila)));
  const filasSimples = tipoDe(items) === 'object' && propiedadesDe(items).every(([, hijo]) => esEscalar(hijo));

  const renderFilas = () => {
    if (filasSimples) return <FilasCompactas schema={schema} value={filas} onChange={onChange} path={path} items={items} />;
    return filas.map((fila, indice) => (
      <div key={indice} className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <div className="flex-1 min-w-0">
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
    <div className="sm:col-span-2 min-w-0 space-y-2">
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
