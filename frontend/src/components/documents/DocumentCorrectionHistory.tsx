import { useState } from 'react';
import { ArrowRight, ClipboardCheck, PencilLine } from 'lucide-react';
import type { CorreccionHistorial } from '../../types/medical';
import { textoDeValor } from '../../utils/etiquetas';

/** Cambios que se muestran de entrada en cada entrada; el resto, con "Ver todos". */
const CAMBIOS_VISIBLES = 5;

const ORIGEN = {
  AUDITORIA: { texto: 'Auditoría', icono: ClipboardCheck, clase: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  CORRECCION: { texto: 'Corrección', icono: PencilLine, clase: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' },
} as const;

const formatoFecha = (iso: string): string => {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime())
    ? iso
    : fecha.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const EntradaHistorial = ({ entrada }: { entrada: CorreccionHistorial }) => {
  const [verTodos, setVerTodos] = useState(false);
  const origen = ORIGEN[entrada.origen] ?? ORIGEN.CORRECCION;
  const Icono = origen.icono;
  const cambios = verTodos ? entrada.cambios : entrada.cambios.slice(0, CAMBIOS_VISIBLES);
  const ocultos = entrada.cambios.length - cambios.length;

  return (
    <li className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs space-y-2 break-words">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${origen.clase}`}>
          <Icono className="w-3 h-3" />
          {origen.texto}
        </span>
        <span className="font-semibold text-slate-200">{entrada.corrected_by_username}</span>
        <span className="text-slate-500">{formatoFecha(entrada.corrected_at)}</span>
      </div>
      <p className="text-slate-300 whitespace-pre-line">{entrada.justificacion}</p>

      {entrada.cambios.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic">Validado sin cambios en los valores.</p>
      ) : (
        <ul className="space-y-1">
          {cambios.map((cambio) => (
            <li key={cambio.campo} className="text-[11px]">
              <span className="text-slate-400">{cambio.etiqueta}: </span>
              <span className="text-slate-500 line-through decoration-slate-600">{textoDeValor(cambio.antes)}</span>
              <ArrowRight className="inline w-3 h-3 mx-1 text-slate-600" aria-label="cambió a" />
              <span className="text-slate-100">{textoDeValor(cambio.despues)}</span>
            </li>
          ))}
        </ul>
      )}
      {(ocultos > 0 || verTodos) && entrada.cambios.length > CAMBIOS_VISIBLES && (
        <button
          type="button"
          onClick={() => setVerTodos((v) => !v)}
          className="text-[11px] text-indigo-300 hover:underline cursor-pointer"
        >
          {verTodos ? 'Ver menos' : `Ver todos (${entrada.cambios.length})`}
        </button>
      )}
    </li>
  );
};

/** Historial de correcciones humanas del documento, de la más reciente a la más antigua. */
const DocumentCorrectionHistory = ({ historial }: { historial: CorreccionHistorial[] }) => (
  <ul className="space-y-2">
    {historial.map((entrada) => (
      <EntradaHistorial key={`${entrada.corrected_at}-${entrada.origen}`} entrada={entrada} />
    ))}
  </ul>
);

export default DocumentCorrectionHistory;
