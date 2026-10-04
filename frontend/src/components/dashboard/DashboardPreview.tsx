import { useState } from 'react';
import CriticalAlertBanner from './CriticalAlertBanner';
import TriageKpiCards from './TriageKpiCards';
import TriageFilterTabs from './TriageFilterTabs';
import TriageDocumentList from './TriageDocumentList';
import NewDocumentModal from './NewDocumentModal';
import { useDashboardTriage } from '../../hooks/useDashboardTriage';

const DashboardPreview = () => {
  const {
    filteredDocuments,
    counts,
    activeFilter,
    setActiveFilter,
    loading,
  } = useDashboardTriage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-5 animate-fade-in">
      <CriticalAlertBanner
        criticalCount={counts.urgent}
        onViewCritical={() => setActiveFilter('URGENT')}
      />

      <TriageKpiCards
        criticalCount={counts.urgent}
        priorityCount={counts.priority}
        pendingAuditCount={counts.audit}
        processedCount={counts.routine}
        totalShiftCount={counts.all}
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <TriageDocumentList documents={filteredDocuments} />
      )}

      <NewDocumentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default DashboardPreview;

