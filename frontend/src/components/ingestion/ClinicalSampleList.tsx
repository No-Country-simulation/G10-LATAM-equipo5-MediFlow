import { Sparkles } from 'lucide-react';
import { CLINICAL_SAMPLES, type ClinicalSample } from '../../types/ingestion';

interface ClinicalSampleListProps {
  selectedFileName?: string;
  onSelectFile: (sample: ClinicalSample) => void;
  disabled?: boolean;
}

export const ClinicalSampleList = ({
  selectedFileName,
  onSelectFile,
  disabled = false,
}: ClinicalSampleListProps) => {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 mb-2.5 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span>Documentos clínicos de muestra para pruebas rápidas:</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {CLINICAL_SAMPLES.map((sample) => (
          <button
            key={sample.name}
            type="button"
            disabled={disabled}
            onClick={() => onSelectFile(sample)}
            className={`text-left p-3 rounded-xl border transition-all text-xs cursor-pointer disabled:opacity-50 ${
              selectedFileName === sample.name
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-slate-900/50 hover:bg-slate-800 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="font-semibold text-slate-200 truncate">{sample.name}</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">{sample.category}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {sample.format} • {sample.size}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
