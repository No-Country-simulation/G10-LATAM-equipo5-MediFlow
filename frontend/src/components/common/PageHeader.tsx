import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  badge?: string;
  subtitle: string;
  actions?: ReactNode;
}

/** Encabezado de las páginas de administración: título con ícono, insignia, descripción y acciones. */
export const PageHeader = ({ icon: Icon, title, badge, subtitle, actions }: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
    <div>
      <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
        <Icon className="w-5 h-5 text-indigo-400" />
        <span>{title}</span>
        {badge && (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
            {badge}
          </span>
        )}
      </h1>
      <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
    </div>
    {actions && <div className="flex items-center gap-2.5">{actions}</div>}
  </div>
);
