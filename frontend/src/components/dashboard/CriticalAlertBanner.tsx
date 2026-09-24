import { AlertOctagon, ArrowRight } from 'lucide-react';
import HeartbeatBackground from '../common/HeartbeatBackground';

interface CriticalAlertBannerProps {
  criticalCount: number;
  onViewCritical: () => void;
}

const CriticalAlertBanner = ({ criticalCount, onViewCritical }: CriticalAlertBannerProps) => {
  if (criticalCount <= 0) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/80 via-slate-900/90 to-rose-950/70 p-4 shadow-xl shadow-rose-950/30 backdrop-blur-md">
      <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
        <HeartbeatBackground mode="compact" />
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
            <AlertOctagon className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
                Alerta de Urgencia Crítica
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {criticalCount} ACTIVA{criticalCount > 1 ? 'S' : ''}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Protocolo TEP Agudo activado: compromiso vital detectado por IA con enrutamiento prioritario.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewCritical}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-950/50 transition-all cursor-pointer shrink-0"
        >
          <span>Atender Urgencias</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CriticalAlertBanner;
