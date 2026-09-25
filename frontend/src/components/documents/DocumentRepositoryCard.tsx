import { FileText, User, Stethoscope, ArrowRight, ShieldCheck } from 'lucide-react';
import type { TriageDocument } from '../../types/triage';

interface DocumentRepositoryCardProps {
  doc: TriageDocument;
}

const DESTINATION_LABELS: Record<string, string> = {
  Cola_Emergencia_Medica: 'Urgencias',
  Auditoria_Autorizaciones: 'Autorizaciones y Convenios',
  Farmacia_Hospitalaria: 'Farmacia Hospitalaria',
  Historia_Clinica_Electronica: 'Ficha Clínica Electrónica',
  Cola_Revision_Humana: 'Auditoría Clínica',
};

const PRIORITY_BADGES: Record<string, string> = {
  Urgente: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  Alta: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  Media: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Baja: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const DocumentRepositoryCard = ({ doc }: DocumentRepositoryCardProps) => {
  const priorityClass =
    PRIORITY_BADGES[doc.clasificacion.nivel_prioridad] ||
    'bg-slate-800 text-slate-300 border-slate-700';

  const destinationLabel =
    DESTINATION_LABELS[doc.decision_enrutamiento.destino_principal] ||
    doc.decision_enrutamiento.destino_principal;

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
            <div className="text-[11px] text-slate-400 font-medium">
              {doc.clasificacion.tipo_documento} • {doc.clasificacion.especialidad}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${priorityClass}`}
          >
            {doc.clasificacion.nivel_prioridad}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{doc.fecha_ingreso}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>Paciente</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 truncate">
            {doc.datos_extraidos.paciente.nome}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            RUT: {doc.datos_extraidos.paciente.rut || 'S/N'}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 sm:col-span-1 lg:col-span-2">
          <div className="text-[10px] text-slate-500 uppercase font-mono flex items-center gap-1">
            <Stethoscope className="w-3 h-3 text-rose-400" />
            <span>Diagnóstico Clínico</span>
          </div>
          <div className="font-semibold text-slate-200 mt-1 truncate">
            {doc.datos_extraidos.diagnostico_principal}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            CIE-10: {doc.datos_extraidos.cie10_sugerido}
          </div>
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
          <span className="font-mono font-bold text-slate-200">
            {(doc.clasificacion.score_confianza_clasificacion * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default DocumentRepositoryCard;
