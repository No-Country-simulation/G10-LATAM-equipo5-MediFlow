import { FileText, User, Stethoscope, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { DocumentListItemResponse } from '../../types/medical';
import { DESTINATION_LABELS, CATEGORY_LABELS } from '../../types/documents';

interface DocumentRepositoryCardProps {
  doc: DocumentListItemResponse;
}

const PRIORITY_BADGES: Record<string, string> = {
  CRITICA: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  ALTA: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIA: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  BAJA: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const destinationLookup: Record<string, string> = DESTINATION_LABELS;
const categoryLookup: Record<string, string> = CATEGORY_LABELS;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatConfidence(score: number | null | undefined): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return '—';
  return `${(score * 100).toFixed(0)}%`;
}

const DocumentRepositoryCard = ({ doc }: DocumentRepositoryCardProps) => {
  const priorityClass =
    PRIORITY_BADGES[doc.nivel_prioridad] ?? 'bg-slate-800 text-slate-300 border-slate-700';

  const destinationLabel = doc.destino_enrutamiento
    ? (destinationLookup[doc.destino_enrutamiento] ?? doc.destino_enrutamiento)
    : 'Otras Derivaciones';

  const categoryLabel = categoryLookup[doc.tipo_documento] ?? doc.tipo_documento;
  const formattedDate = formatDate(doc.created_at);
  const confidencePercent = formatConfidence(doc.score_confianza);
  const requiresAudit = Boolean(doc.requiere_auditoria || doc.estado === 'PENDIENTE_AUDITORIA');
  const clinicalDiagnosis = doc.diagnostico_principal || doc.estado || 'Sin diagnóstico registrado';

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800/80 text-rose-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-white tracking-tight">
              {doc.documento_id}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">{categoryLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {requiresAudit && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Auditoría Requerida
            </span>
          )}
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${priorityClass}`}>
            {doc.nivel_prioridad}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{formattedDate}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>Paciente</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 truncate">
            {doc.nombre_paciente ?? '—'}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            RUT: {doc.rut_paciente ?? 'S/N'}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 sm:col-span-1 lg:col-span-2">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <Stethoscope className="w-3 h-3 text-rose-400" />
            <span>Hipótesis Diagnóstica</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 truncate">{clinicalDiagnosis}</div>
          <div className="text-[11px] text-slate-400 font-mono">Expediente: {doc.documento_id}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="text-slate-500">Derivación:</span>
          <span className="font-medium text-emerald-400">{destinationLabel}</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Confianza IA:</span>
          <span className="font-mono font-bold text-slate-200">{confidencePercent}</span>
        </div>
      </div>
    </div>
  );
};

export default DocumentRepositoryCard;
