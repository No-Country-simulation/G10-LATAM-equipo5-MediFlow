import { AlertCircle, RefreshCw } from 'lucide-react';
import DashboardKpiCards from '../components/dashboard/DashboardKpiCards';
import QuickIngestionDropzone from '../components/dashboard/QuickIngestionDropzone';
import AttentionPanel from '../components/dashboard/AttentionPanel';
import RecentUploadsPanel from '../components/dashboard/RecentUploadsPanel';
import DailyIntakeChart from '../components/dashboard/DailyIntakeChart';
import QueueDistributionChart from '../components/dashboard/QueueDistributionChart';
import { useAuth } from '../hooks/useAuth';
import { DASHBOARD_DIAS, useDashboardStats } from '../hooks/useDashboardStats';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { stats, state, error, reload } = useDashboardStats();
  const esOperador = user?.role === 'OPERADOR';
  const cargando = state === 'loading';

  return (
    <div className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Resumen</h1>
          <p className="text-xs text-slate-400">
            {esOperador ? 'Tus documentos y colas' : 'Actividad del hospital'} · últimos {DASHBOARD_DIAS} días
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={cargando}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {state === 'error' && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-rose-500/8 border border-rose-500/20 text-rose-300 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">No se pudo cargar el resumen</p>
            <p className="text-xs text-rose-400/80">{error}</p>
          </div>
        </div>
      )}

      {!stats && state !== 'error' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
        </div>
      )}

      {stats && (
        // Al recargar se mantiene lo anterior atenuado, sin parpadeo ni saltos.
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <DashboardKpiCards
            totales={stats.totales}
            dias={DASHBOARD_DIAS}
            auditLink={esOperador ? '/documentos?estado=PENDIENTE_AUDITORIA' : '/auditoria'}
          />

          <QuickIngestionDropzone onSuccess={reload} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-3">
              {esOperador ? <RecentUploadsPanel docs={stats.recientes} /> : <AttentionPanel stats={stats} />}
            </div>
            <div className="lg:col-span-2">
              <QueueDistributionChart porDestino={stats.por_destino} dias={DASHBOARD_DIAS} />
            </div>
          </div>

          <DailyIntakeChart porDia={stats.por_dia} />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
