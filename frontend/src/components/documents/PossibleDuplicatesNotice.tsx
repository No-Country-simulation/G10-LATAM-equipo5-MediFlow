import { Copy, Eye } from 'lucide-react';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import type { DuplicadoDocumento } from '../../types/medical';

const TIPO: Record<DuplicadoDocumento['tipo'], string> = {
  ARCHIVO_IDENTICO: 'archivo idéntico',
  CONTENIDO_SIMILAR: 'mismo paciente, tipo y fecha',
};

/**
 * Aviso de que el documento podría ser el mismo que otro ya registrado, con un enlace para
 * compararlo. Si es un duplicado, en auditoría se descarta con ese motivo.
 */
const PossibleDuplicatesNotice = ({ duplicados }: { duplicados: DuplicadoDocumento[] }) => {
  const { abrirDocumento } = useDocumentDetailModal();
  if (duplicados.length === 0) return null;

  return (
    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs space-y-1.5">
      <p className="font-bold text-orange-300 flex items-center gap-1.5">
        <Copy className="w-3.5 h-3.5 shrink-0" />
        Posible duplicado de otro documento
      </p>
      <ul className="space-y-1">
        {duplicados.map((d) => (
          <li key={`${d.documento_id}-${d.tipo}`} className="flex flex-wrap items-center gap-x-2 text-orange-200/90">
            <span className="font-mono font-semibold">{d.documento_id}</span>
            <span className="text-orange-300/70">({TIPO[d.tipo] ?? d.tipo})</span>
            <button
              type="button"
              onClick={() => abrirDocumento(d.documento_id)}
              className="inline-flex items-center gap-1 text-orange-200 underline-offset-2 hover:underline cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Ver
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PossibleDuplicatesNotice;
