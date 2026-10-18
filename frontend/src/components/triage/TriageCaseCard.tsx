import { CheckCheck, Loader2, Shuffle } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import PriorityBadge from '../common/PriorityBadge';
import { formatIdentificacion } from '../../utils/identificacion';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import { useCatalogLabels } from '../../hooks/useCatalogLabels';
import { tarjetaClickeable, TARJETA_CLICKEABLE_CLASES } from '../../utils/clickableCard';
import { timeAgo } from '../../utils/timeAgo';

interface TriageCaseCardProps {
  doc: DocumentListItemResponse;
  /** Nombre de la cola según el catálogo. */
  queueName: string;
  /** Sin ellos la tarjeta no ofrece las acciones (el OPERADOR solo consulta). */
  onAttend?: (doc: DocumentListItemResponse) => void;
  onDerive?: (doc: DocumentListItemResponse) => void;
  attending?: boolean;
}

// Color por cola semilla; las colas nuevas del catálogo usan el neutro.
const QUEUE_BADGES: Record<string, string> = {
  Cola_Emergencia_Medica: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Cola_Oncologia: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Gestion_Procedimientos: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Gestion_Interconsultas: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};
const DEFAULT_BADGE = 'bg-slate-800 text-slate-300 border-slate-700';

const ACTION_BUTTON =
  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait';

const TriageCaseCard = ({ doc, queueName, onAttend, onDerive, attending = false }: TriageCaseCardProps) => {
  const destination = {
    label: queueName,
    badge: (doc.destino_enrutamiento && QUEUE_BADGES[doc.destino_enrutamiento]) || DEFAULT_BADGE,
  };

  const docCode = doc.documento_id.startsWith('DOC-')
    ? doc.documento_id
    : `DOC-CLIN-${doc.documento_id.slice(0, 8).toUpperCase()}`;

  const { documentTypeName } = useCatalogLabels();
  const clinicalDiagnosis = doc.diagnostico_principal || documentTypeName(doc.tipo_documento) || 'Sin diagnóstico especificado';
  const { abrirDocumento } = useDocumentDetailModal();

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col shadow-md">
      <div
        {...tarjetaClickeable(() => abrirDocumento(doc.documento_id), `Ver detalle del documento ${doc.documento_id}`)}
        className={`${TARJETA_CLICKEABLE_CLASES} p-4 pb-3 rounded-t-2xl flex flex-col justify-between gap-3 flex-1`}
      >
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-slate-200">
              {doc.nombre_paciente || 'Paciente sin identificar'}
            </span>
            <PriorityBadge prioridad={doc.nivel_prioridad} />
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {formatIdentificacion(doc.identificacion_paciente, doc.tipo_identificacion)} • {docCode}
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Diagnóstico Clínico:
          </span>
          <span className="font-medium text-slate-200 line-clamp-2 mt-0.5 block">
            {clinicalDiagnosis}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/50">
          <span className="text-slate-400">Destino Clínico:</span>
          <span className={`px-2.5 py-0.5 rounded-md border font-medium text-[11px] ${destination.badge}`}>
            {destination.label}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-800/70 text-[11px]">
        <span className="text-slate-500">Ingresó {timeAgo(doc.created_at)}</span>
        <div className="flex items-center gap-1.5">
          {onDerive && (
            <button
              type="button"
              onClick={() => onDerive(doc)}
              disabled={attending}
              className={`${ACTION_BUTTON} bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700/60 hover:text-white`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              Derivar
            </button>
          )}
          {onAttend && (
            <button
              type="button"
              onClick={() => onAttend(doc)}
              disabled={attending}
              aria-haspopup="dialog"
              className={`${ACTION_BUTTON} bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20`}
            >
              {attending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Marcar atendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TriageCaseCard;
