import { User, Stethoscope, ShieldCheck } from 'lucide-react';
import type { TriageDocument } from '../../types/triage';

interface DocumentsKanbanCardProps {
  doc: TriageDocument;
}

const PRIORITY_BADGES: Record<string, string> = {
  Urgente: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  Alta: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Media: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Baja: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const DocumentsKanbanCard = ({ doc }: DocumentsKanbanCardProps) => {
  const priorityClass =
    PRIORITY_BADGES[doc.clasificacion.nivel_prioridad] ||
    'bg-slate-800 text-slate-300 border-slate-700';

  const confidencePercent = (
    doc.clasificacion.score_confianza_clasificacion * 100
  ).toFixed(0);

  return (
    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all shadow-sm space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-bold text-slate-200 tracking-tight">
          {doc.documento_id}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${priorityClass}`}
        >
          {doc.clasificacion.nivel_prioridad}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-100 truncate">
            {doc.datos_extraidos.paciente.nome}
          </span>
          {doc.datos_extraidos.paciente.rut && (
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              ({doc.datos_extraidos.paciente.rut})
            </span>
          )}
        </div>

        <div className="flex items-start gap-1.5 text-xs text-slate-300">
          <Stethoscope className="w-3.5 h-3.5 text-rose-400/80 shrink-0 mt-0.5" />
          <p className="line-clamp-2 leading-relaxed">
            {doc.datos_extraidos.diagnostico_principal}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/70 text-[11px]">
        <div className="flex items-center gap-1 font-mono text-slate-400 bg-slate-950/70 px-2 py-0.5 rounded border border-slate-800/80 text-[10px]">
          <span className="text-slate-500">CIE-10:</span>
          <span className="font-semibold text-slate-300">
            {doc.datos_extraidos.cie10_sugerido}
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono font-bold text-slate-200">
            {confidencePercent}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default DocumentsKanbanCard;
