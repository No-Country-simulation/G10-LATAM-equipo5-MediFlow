import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { DashboardStatsResponse } from '../../types/dashboard';
import type { DocumentListItemResponse } from '../../types/medical';
import { expedientesUrl } from '../../utils/dashboardLinks';
import { timeAgo } from '../../utils/timeAgo';
import DashboardPanel from './DashboardPanel';
import DashboardDocRow from './DashboardDocRow';

interface AttentionPanelProps {
  stats: DashboardStatsResponse;
}

const LINK = 'flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors';

const Section = ({
  title,
  docs,
  timeLabel,
}: {
  title: string;
  docs: DocumentListItemResponse[];
  timeLabel?: (doc: DocumentListItemResponse) => string;
}) => (
  <div>
    <h3 className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{title}</h3>
    <ul>
      {docs.map((doc) => (
        <DashboardDocRow key={doc.documento_id} doc={doc} timeLabel={timeLabel?.(doc)} />
      ))}
    </ul>
  </div>
);

/** ADMIN y AUDITOR_CLINICO: lo que hay que revisar ahora, sin repetir la bandeja de Expedientes. */
const AttentionPanel = ({ stats }: AttentionPanelProps) => {
  const { mis_casos, pendientes_auditoria, urgentes, totales } = stats;
  const misCasosIds = new Set(mis_casos.map((d) => d.documento_id));
  const pendientes = pendientes_auditoria.filter((d) => !misCasosIds.has(d.documento_id));
  const vacio = mis_casos.length === 0 && pendientes.length === 0 && urgentes.length === 0;

  return (
    <DashboardPanel
      title="Requiere atención"
      subtitle="Casos que tienes tomados, la cola de auditoría más antigua y los urgentes recientes"
      action={
        <Link to="/auditoria" className={LINK}>
          Auditoría ({totales.pendientes_auditoria})
          <ArrowRight className="w-3 h-3" />
        </Link>
      }
    >
      {vacio ? (
        <div className="flex items-center gap-2 px-3 py-6 justify-center text-xs text-slate-400">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Todo al día: no hay casos pendientes.
        </div>
      ) : (
        <div className="space-y-3">
          {mis_casos.length > 0 && (
            <Section
              title="Mis casos en revisión"
              docs={mis_casos}
              timeLabel={(doc) => `tomado ${timeAgo(doc.asignado_at)}`}
            />
          )}
          {pendientes.length > 0 && (
            <Section
              title="Esperando auditoría (más antiguos)"
              docs={pendientes}
              timeLabel={(doc) => `espera ${timeAgo(doc.created_at).replace('hace ', '')}`}
            />
          )}
          {urgentes.length > 0 && <Section title="Urgentes recientes" docs={urgentes} />}
        </div>
      )}
      {urgentes.length > 0 && (
        <div className="pt-2 border-t border-slate-800/70">
          <Link to={expedientesUrl({ prioridad: 'Urgente' })} className={LINK}>
            Ver todos los urgentes en Expedientes
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
};

export default AttentionPanel;
