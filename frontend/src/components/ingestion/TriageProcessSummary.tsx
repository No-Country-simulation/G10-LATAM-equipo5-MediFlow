import { CheckCircle2, ShieldCheck, Stethoscope, ArrowRight } from 'lucide-react';
import type { ClinicalSample } from '../../types/ingestion';

interface TriageProcessSummaryProps {
  file: ClinicalSample;
  onReset: () => void;
}

const TriageProcessSummary = ({ file, onReset }: TriageProcessSummaryProps) => {
  return (
    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Triaje Clínico Completado con Éxito</h3>
            <p className="text-xs text-slate-300">
              El documento fue analizado y clasificado para atención asistencial inmediata.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
        >
          Procesar otro documento
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Documento</span>
          <div className="font-semibold text-slate-200 mt-1 truncate">{file.name}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{file.category}</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">Estado de Triaje</span>
          <div className="font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Clasificación Aprobada</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Prioridad Asignada</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase font-semibold">
            Derivación Hospitalaria
          </span>
          <div className="font-semibold text-white mt-1 flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5 text-rose-400" />
            <span>Área Asistencial</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Bandeja de atención médica</div>
        </div>
      </div>
    </div>
  );
};

export default TriageProcessSummary;
