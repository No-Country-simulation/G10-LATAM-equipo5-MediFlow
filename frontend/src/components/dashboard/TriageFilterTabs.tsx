import type { TriageFilter } from '../../types/triage';

interface TriageFilterTabsProps {
  activeFilter: TriageFilter;
  onFilterChange: (filter: TriageFilter) => void;
  counts: {
    all: number;
    urgent: number;
    audit: number;
    routine: number;
  };
}

const TriageFilterTabs = ({ activeFilter, onFilterChange, counts }: TriageFilterTabsProps) => {
  const tabs = [
    { id: 'ALL' as const, label: 'Todos', count: counts.all },
    { id: 'URGENT' as const, label: '🔴 Urgentes', count: counts.urgent },
    { id: 'AUDIT' as const, label: '🟡 Revisión Humana', count: counts.audit },
    { id: 'ROUTINE' as const, label: '🟢 Rutina', count: counts.routine },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onFilterChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              isActive
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isActive ? 'bg-slate-700 text-slate-200' : 'bg-slate-800/80 text-slate-400'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default TriageFilterTabs;
