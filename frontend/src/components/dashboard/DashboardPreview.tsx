import { useState, useMemo } from 'react';
import type { TriageFilter } from '../../types/triage';
import { MOCK_TRIAGE_DOCUMENTS } from './triageData';
import CriticalAlertBanner from './CriticalAlertBanner';
import TriageKpiCards from './TriageKpiCards';
import TriageFilterTabs from './TriageFilterTabs';
import TriageDocumentList from './TriageDocumentList';
import NewDocumentModal from './NewDocumentModal';

const DashboardPreview = () => {
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

      <NewDocumentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default DashboardPreview;
