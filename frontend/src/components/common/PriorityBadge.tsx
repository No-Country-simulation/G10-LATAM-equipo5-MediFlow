import { type NivelPrioridad, normalizePriority } from '../../types/medical';

export interface PriorityBadgeProps {
  prioridad: NivelPrioridad | string;
  className?: string;
  showDot?: boolean;
}

const PRIORITY_STYLES: Record<NivelPrioridad, { badge: string; dot: string }> = {
  Urgente: {
    badge: 'bg-rose-950/40 text-rose-400 border-rose-500/30',
    dot: 'bg-rose-500 animate-pulse',
  },
  Prioritario: {
    badge: 'bg-amber-950/40 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-500',
  },
  Rutina: {
    badge: 'bg-teal-950/40 text-teal-400 border-teal-500/30',
    dot: 'bg-teal-500',
  },
};

const PriorityBadge = ({ prioridad, className = '', showDot = true }: PriorityBadgeProps) => {
  const canonicalPriority = normalizePriority(prioridad || 'Rutina');
  const style = PRIORITY_STYLES[canonicalPriority];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${style.badge} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />}
      <span>{canonicalPriority}</span>
    </span>
  );
};

export default PriorityBadge;
