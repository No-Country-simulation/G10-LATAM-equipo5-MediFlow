import { useState, useMemo } from 'react';
import { LogOut, Activity, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import type { TriageFilter } from '../../types/triage';
import { MOCK_TRIAGE_DOCUMENTS } from './triageData';
import CriticalAlertBanner from './CriticalAlertBanner';
import TriageKpiCards from './TriageKpiCards';
import TriageFilterTabs from './TriageFilterTabs';
import TriageDocumentList from './TriageDocumentList';
import NewDocumentModal from './NewDocumentModal';

const DashboardPreview = () => {
  const { user, logout } = useAuth();
  const [activeFilter, setActiveFilter] = useState<TriageFilter>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const counts = useMemo(() => {
    const urgent = MOCK_TRIAGE_DOCUMENTS.filter(
      (d) => d.clasificacion.nivel_prioridad === 'Urgente'
    ).length;
    const audit = MOCK_TRIAGE_DOCUMENTS.filter(
      (d) =>
        d.clasificacion.nivel_prioridad !== 'Urgente' &&
        (d.clasificacion.score_confianza_clasificacion < 0.85 ||
          d.decision_enrutamiento.requiere_auditoria_humana)
    ).length;
    const routine = MOCK_TRIAGE_DOCUMENTS.filter(
      (d) =>
        d.clasificacion.nivel_prioridad !== 'Urgente' &&
        d.clasificacion.score_confianza_clasificacion >= 0.85 &&
        !d.decision_enrutamiento.requiere_auditoria_humana
    ).length;

    return {
      all: MOCK_TRIAGE_DOCUMENTS.length,
      urgent,
      audit,
      routine,
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    switch (activeFilter) {
      case 'URGENT':
        return MOCK_TRIAGE_DOCUMENTS.filter(
          (d) => d.clasificacion.nivel_prioridad === 'Urgente'
        );
      case 'AUDIT':
        return MOCK_TRIAGE_DOCUMENTS.filter(
          (d) =>
            d.clasificacion.nivel_prioridad !== 'Urgente' &&
            (d.clasificacion.score_confianza_clasificacion < 0.85 ||
              d.decision_enrutamiento.requiere_auditoria_humana)
        );
      case 'ROUTINE':
        return MOCK_TRIAGE_DOCUMENTS.filter(
          (d) =>
            d.clasificacion.nivel_prioridad !== 'Urgente' &&
            d.clasificacion.score_confianza_clasificacion >= 0.85 &&
            !d.decision_enrutamiento.requiere_auditoria_humana
        );
      default:
        return MOCK_TRIAGE_DOCUMENTS;
    }
  }, [activeFilter]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative pb-12">
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-white tracking-tight">MediFlow</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Sesión Activa
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            title="El documento será clasificado y enrutado automáticamente por el agente de IA"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs shadow-md shadow-emerald-950/40 border border-emerald-400/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-100" />
            <span>Procesar Documento IA</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-right">
            <div>
              <div className="text-xs font-semibold text-slate-200">{user?.full_name}</div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>{user?.role}</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-xs">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
          </div>

          <button
            onClick={() => void logout()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 border border-slate-700/60 hover:border-rose-500/40 text-xs font-medium text-slate-200 hover:text-rose-300 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </header>

      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5">
        <CriticalAlertBanner
          criticalCount={counts.urgent}
          onViewCritical={() => setActiveFilter('URGENT')}
        />

        <TriageKpiCards
          criticalCount={counts.urgent}
          pendingAuditCount={counts.audit}
          processedCount={48}
          totalShiftCount={50}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Bandeja de Documentos Clínicos
            </h2>
            <p className="text-xs text-slate-400">
              Clasificación IA en tiempo real y derivación hospitalaria autónoma
            </p>
          </div>

          <TriageFilterTabs
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            counts={counts}
          />
        </div>

        <TriageDocumentList documents={filteredDocuments} />
      </div>

      <NewDocumentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </main>
  );
};

export default DashboardPreview;
