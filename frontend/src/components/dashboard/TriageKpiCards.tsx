import { AlertCircle, Clock, CheckCircle2, Files } from 'lucide-react';
import type { TriageFilter } from '../../types/triage';

interface TriageKpiCardsProps {
  criticalCount?: number;
  pendingAuditCount?: number;
  processedCount?: number;
  totalShiftCount?: number;
  activeFilter: TriageFilter;
  onSelectFilter: (filter: TriageFilter) => void;
}

const TriageKpiCards = ({
  criticalCount = 1,
  pendingAuditCount = 1,
  processedCount = 48,
  totalShiftCount = 50,
  activeFilter,
  onSelectFilter,
}: TriageKpiCardsProps) => {
  const cards = [
    {
      id: 'URGENT' as const,
      label: 'Urgencias Críticas',
      count: `${criticalCount} activa`,
      description: 'Compromiso vital / TEP agudo',
      icon: AlertCircle,
      accentText: 'text-rose-400',
      accentBg: 'bg-rose-500/10',
      accentBorder: 'border-rose-500/20',
      activeRing: 'ring-2 ring-rose-500/80 border-rose-500/50 bg-rose-950/20',
    },
    {
      id: 'AUDIT' as const,
      label: 'Revisión Humana',
      count: `${pendingAuditCount} pendiente`,
      description: 'Score < 0.85 o texto ambiguo',
      icon: Clock,
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-500/10',
      accentBorder: 'border-amber-500/20',
      activeRing: 'ring-2 ring-amber-500/80 border-amber-500/50 bg-amber-950/20',
    },
    {
      id: 'ROUTINE' as const,
      label: 'Automatizados Directos',
      count: `${processedCount} procesados`,
      description: '96% efectividad del agente',
      icon: CheckCircle2,
      accentText: 'text-emerald-400',
      accentBg: 'bg-emerald-500/10',
      accentBorder: 'border-emerald-500/20',
      activeRing: 'ring-2 ring-emerald-500/80 border-emerald-500/50 bg-emerald-950/20',
    },
    {
      id: 'ALL' as const,
      label: 'Total Ingesta Turno',
      count: `${totalShiftCount} recibidos`,
      description: 'Flujo continuo hospitalario',
      icon: Files,
      accentText: 'text-sky-400',
      accentBg: 'bg-sky-500/10',
      accentBorder: 'border-sky-500/20',
      activeRing: 'ring-2 ring-sky-500/80 border-sky-500/50 bg-sky-950/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(card.id)}
            className={`p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 text-left transition-all cursor-pointer hover:bg-slate-900/90 ${
              isActive ? card.activeRing : 'hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.accentBg} ${card.accentText} border ${card.accentBorder}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl font-bold mt-2 ${card.accentText}`}>{card.count}</div>
            <div className="text-[11px] text-slate-400 mt-1">{card.description}</div>
          </button>
        );
      })}
    </div>
  );
};

export default TriageKpiCards;
