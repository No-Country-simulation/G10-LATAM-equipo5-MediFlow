import { CheckCheck, Loader2 } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import PriorityBadge from '../common/PriorityBadge';
import { formatIdentificacion } from '../../utils/identificacion';
import { useDocumentDetailModal } from '../../context/documentDetailContext';
import { tarjetaClickeable, TARJETA_CLICKEABLE_CLASES } from '../../utils/clickableCard';
import { timeAgo } from '../../utils/timeAgo';

interface TriageCaseCardProps {
  doc: DocumentListItemResponse;
  /** Sin él la tarjeta no ofrece "Marcar atendido" (el OPERADOR solo consulta). */
  onAttend?: (doc: DocumentListItemResponse) => void;
  attending?: boolean;
}

interface DestinationConfig {
  label: string;
  badge: string;
}

const DESTINATION_CONFIG: Record<string, DestinationConfig> = {
  Cola_Emergencia_Medica: {
    label: 'Urgencias Médicas',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  Cola_Oncologia: {
    label: 'Comité Oncológico',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  Gestion_Procedimientos: {
    label: 'Quirófano / Procedimientos',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  Gestion_Interconsultas: {
    label: 'Interconsultas y Derivaciones',
    badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  },
};

const TriageCaseCard = ({ doc, onAttend, attending = false }: TriageCaseCardProps) => {
  const destination = doc.destino_enrutamiento
    ? (DESTINATION_CONFIG[doc.destino_enrutamiento] ?? {
        label: doc.destino_enrutamiento,
        badge: 'bg-slate-800 text-slate-300 border-slate-700',
      })
    : { label: 'Derivación Asistencial', badge: 'bg-slate-800 text-slate-300 border-slate-700' };

  const docCode = doc.documento_id.startsWith('DOC-')
    ? doc.documento_id
    : `DOC-CLIN-${doc.documento_id.slice(0, 8).toUpperCase()}`;

  const clinicalDiagnosis = doc.diagnostico_principal || doc.tipo_documento || 'Sin diagnóstico especificado';
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
        {onAttend && (
          <button
            type="button"
            onClick={() => onAttend(doc)}
            disabled={attending}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {attending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Marcar atendido
          </button>
        )}
      </div>
    </div>
  );
};

export default TriageCaseCard;
