import { FileText, User, Stethoscope, AlertTriangle, ArrowRight } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import PriorityBadge from '../common/PriorityBadge';

interface AuditDocumentCardProps {
  doc: DocumentListItemResponse;
  onReview?: (doc: DocumentListItemResponse) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const AuditDocumentCard = ({ doc, onReview }: AuditDocumentCardProps) => {
  const formattedDate = formatDate(doc.created_at);
  const diagnosis = doc.diagnostico_principal || 'Diagnóstico preliminar en evaluación clínica';

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-white tracking-tight">
              {doc.documento_id}
            </div>
            <div className="text-[11px] text-slate-400">
              {doc.tipo_documento} • {formattedDate}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>Requiere Validación</span>
          </span>
          <PriorityBadge prioridad={doc.nivel_prioridad} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400" />
            <span>Paciente</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 truncate">
            {doc.nombre_paciente ?? 'Paciente No Identificado'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            RUT: {doc.rut_paciente ?? 'Sin RUT'}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <Stethoscope className="w-3 h-3 text-rose-400" />
            <span>Diagnóstico Preliminar / Hallazgo IA</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 line-clamp-2">
            {diagnosis}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <span className="text-[11px] text-slate-500 font-mono">
          Confianza: {Math.round(doc.score_confianza * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onReview?.(doc)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer hover:border-amber-500/50"
        >
          <span>Revisar</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default AuditDocumentCard;
