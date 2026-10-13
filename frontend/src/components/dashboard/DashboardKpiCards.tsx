import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Files, type LucideIcon } from 'lucide-react';
import type { DashboardTotales } from '../../types/dashboard';
import { expedientesUrl } from '../../utils/dashboardLinks';

interface DashboardKpiCardsProps {
  totales: DashboardTotales;
  dias: number;
  /** ADMIN y AUDITOR_CLINICO van a la bandeja de auditoría; el OPERADOR, a sus documentos. */
  auditLink: string;
}

interface Kpi {
  id: string;
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  accent: string;
  to: string;
}

const DashboardKpiCards = ({ totales, dias, auditLink }: DashboardKpiCardsProps) => {
  const periodo = `Últimos ${dias} días`;
  const cards: Kpi[] = [
    {
      id: 'urgente',
      label: 'Urgentes',
      value: totales.urgente,
      description: periodo,
      icon: AlertCircle,
      accent: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      to: expedientesUrl({ prioridad: 'Urgente' }),
    },
    {
      id: 'prioritario',
      label: 'Prioritarios',
      value: totales.prioritario,
      description: periodo,
      icon: AlertTriangle,
      accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      to: expedientesUrl({ prioridad: 'Prioritario' }),
    },
    {
      id: 'rutina',
      label: 'Rutina',
      value: totales.rutina,
      description: periodo,
      icon: CheckCircle2,
      accent: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
      to: expedientesUrl({ prioridad: 'Rutina' }),
    },
    {
      id: 'auditoria',
      label: 'Pendientes de auditoría',
      value: totales.pendientes_auditoria,
      description: 'Cola abierta, sin importar la fecha',
      icon: Clock,
      accent: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
      to: auditLink,
    },
    {
      id: 'total',
      label: 'Ingresados',
      value: totales.total,
      description: `${periodo} · ${totales.descartados} descartados`,
      icon: Files,
      accent: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      to: expedientesUrl(),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map(({ id, label, value, description, icon: Icon, accent, to }) => (
        <Link
          key={id}
          to={to}
          className={`p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90 transition-all ${
            id === 'total' ? 'col-span-2 lg:col-span-1' : ''
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">{label}</span>
            <div className={`p-1.5 rounded-lg border ${accent}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-semibold text-white mt-2">{value.toLocaleString('es-CL')}</div>
          <div className="text-[11px] text-slate-500 mt-1">{description}</div>
        </Link>
      ))}
    </div>
  );
};

export default DashboardKpiCards;
