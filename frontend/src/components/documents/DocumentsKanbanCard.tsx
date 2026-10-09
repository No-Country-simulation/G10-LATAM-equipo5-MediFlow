import { User, Stethoscope, ShieldCheck, XCircle } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import { CATEGORY_LABELS } from '../../types/documents';
import PriorityBadge from '../common/PriorityBadge';

interface DocumentsKanbanCardProps {
  doc: DocumentListItemResponse;
}

const categoryLookup: Record<string, string> = CATEGORY_LABELS;

function formatConfidence(score: number | null | undefined): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return '—';
  return `${(score * 100).toFixed(0)}%`;
}

const DocumentsKanbanCard = ({ doc }: DocumentsKanbanCardProps) => {
  const confidencePercent = formatConfidence(doc.score_confianza);
  const categoryLabel = categoryLookup[doc.tipo_documento] ?? doc.tipo_documento;
  const clinicalDiagnosis =
    doc.diagnostico_principal ||
    (doc.estado === 'DESCARTADO' ? 'Expediente descartado en auditoría' : doc.estado) ||
    'Sin diagnóstico registrado';
  const requiresAudit = Boolean(doc.requiere_auditoria || doc.estado === 'PENDIENTE_AUDITORIA');

  return (
    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-slate-200 tracking-tight">
          {doc.documento_id}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {doc.estado === 'DESCARTADO' && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-500/15 text-slate-400 border border-slate-600/30 flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              Descartado
            </span>
          )}
          {requiresAudit && doc.estado !== 'DESCARTADO' && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Auditoría Requerida
            </span>
          )}
          <PriorityBadge prioridad={doc.nivel_prioridad} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-100 truncate">
            {doc.nombre_paciente ?? '—'}
          </span>
          {doc.rut_paciente && (
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              ({doc.rut_paciente})
            </span>
          )}
        </div>

        <div className="flex items-start gap-1.5 text-xs text-slate-300">
          <Stethoscope className="w-3.5 h-3.5 text-rose-400/80 shrink-0 mt-0.5" />
          <p className="line-clamp-2 leading-relaxed">
            {clinicalDiagnosis}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 text-[11px]">
        <div className="font-mono text-[10px] text-slate-400 truncate max-w-[50%]">
          {categoryLabel}
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono font-bold text-slate-200">
            {confidencePercent}
          </span>
        </div>
      </div>
    </div>
  );
};

export default DocumentsKanbanCard;
