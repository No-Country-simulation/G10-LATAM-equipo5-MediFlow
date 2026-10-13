import type { ReactNode } from 'react';

interface DashboardPanelProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Contenedor de los paneles del inicio. */
const DashboardPanel = ({ title, subtitle, action, children, className = '' }: DashboardPanelProps) => (
  <section className={`p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3 ${className}`}>
    <header className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-white tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
);

export default DashboardPanel;
