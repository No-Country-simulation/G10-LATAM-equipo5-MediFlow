import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Loader2, Clock, Sparkles } from 'lucide-react';
import MediBotRunner from './MediBotRunner';

const STEPS = [
  'Normalizando binario y verificando estructura...',
  'Inferencia multimodal y lectura clínica con IA...',
  'Extrayendo entidades médicas, diagnóstico y CIE-10...',
  'Evaluando reglas clínicas y asignando cola hospitalaria...',
];

const CLINICAL_TIPS = [
  'El triaje automatizado clasifica la urgencia en base a criterios clínicos estandarizados.',
  'Los hallazgos críticos de alto riesgo (ej. TEP) activan alertas prioritarias inmediatas.',
  'Scores de confianza inferiores a 0.85 son derivados a la Cola de Auditoría Humana.',
  'Las entidades extraídas se normalizan contra nomenclaturas CIE-10 y protocolos hospitalarios.',
  'El modelo multimodal procesa simultáneamente texto mecanografiado y manuscritos.',
];

interface ProcessingScannerProps {
  fileName?: string;
}

const ProcessingScanner = ({ fileName }: ProcessingScannerProps) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeStep = Math.min(STEPS.length - 1, [5, 15, 26].filter((t) => seconds >= t).length);
  const currentTip = CLINICAL_TIPS[Math.floor(seconds / 7) % CLINICAL_TIPS.length];
  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="w-full rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl shadow-cyan-950/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 animate-pulse"><Activity className="w-5 h-5" /></div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Analizando documento con IA</h3>
            <p className="text-xs text-slate-400 truncate max-w-sm">{fileName || 'Documento clínico en proceso'}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-cyan-400 font-mono text-xs font-semibold shadow-inner">
          <Clock className="w-3.5 h-3.5" /><span>{formattedTime}</span>
        </div>
      </div>
      <MediBotRunner activeStep={activeStep} />
      <div className="space-y-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < activeStep;
          const isCurrent = idx === activeStep;
          const stepStyle = isCurrent
            ? 'bg-cyan-500/10 border-cyan-500/30 text-white font-medium shadow-sm shadow-cyan-950/40'
            : isDone ? 'bg-slate-900/40 border-emerald-500/20 text-slate-300' : 'bg-slate-950/30 border-slate-800/40 text-slate-500 opacity-60';

          return (
            <div key={step} className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs transition-all duration-300 ${stepStyle}`}>
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 flex items-center justify-center text-[9px] font-mono text-slate-500">{idx + 1}</span>
              )}
              <span className="truncate">{step}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p key={Math.floor(seconds / 7)} className="leading-relaxed animate-fade-in">{currentTip}</p>
      </div>
    </div>
  );
};

export default ProcessingScanner;
