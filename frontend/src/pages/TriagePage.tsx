import { Stethoscope } from 'lucide-react';
import HeartbeatBackground from '../components/common/HeartbeatBackground';

const TriagePage = () => {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 overflow-hidden">
      <HeartbeatBackground mode="full" />
      <div className="relative z-10 max-w-md w-full p-8 rounded-3xl bg-slate-900/60 backdrop-blur-md border border-slate-800 text-center space-y-4 shadow-2xl shadow-black/60">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
          <Stethoscope className="w-7 h-7 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-white tracking-tight">
            Módulo de Triaje Clínico
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Módulo en fase de integración. Próximamente disponible para el flujo operativo.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TriagePage;
