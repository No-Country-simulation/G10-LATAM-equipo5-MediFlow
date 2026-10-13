import { CheckCircle2, ShieldCheck, AlertTriangle, XCircle, type LucideIcon } from 'lucide-react';
import type { EstadoDocumento } from '../../types/medical';

const ESTADO_LABELS: Record<EstadoDocumento, string> = {
  PROCESADO: 'Procesado',
  AUDITADO: 'Auditado',
  PENDIENTE_AUDITORIA: 'Auditoría Requerida',
  DESCARTADO: 'Descartado',
};

const ESTADO_STYLES: Record<EstadoDocumento, { badge: string; icon: LucideIcon }> = {
  PROCESADO: { badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30', icon: CheckCircle2 },
  AUDITADO: { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: ShieldCheck },
  PENDIENTE_AUDITORIA: { badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: AlertTriangle },
  DESCARTADO: { badge: 'bg-slate-500/15 text-slate-400 border-slate-600/30', icon: XCircle },
};

interface DocumentStatusBadgeProps {
  estado: EstadoDocumento;
  /** Un documento procesado que aún espera revisión humana se muestra como pendiente. */
  requiereAuditoria?: boolean | null;
}

const DocumentStatusBadge = ({ estado, requiereAuditoria }: DocumentStatusBadgeProps) => {
  const efectivo: EstadoDocumento =
    requiereAuditoria && estado === 'PROCESADO' ? 'PENDIENTE_AUDITORIA' : estado;
  const style = ESTADO_STYLES[efectivo] ?? ESTADO_STYLES.PROCESADO;
  const Icon = style.icon;

  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[9px] font-medium border flex items-center gap-1 ${style.badge}`}
      title={`Estado: ${ESTADO_LABELS[efectivo] ?? efectivo}`}
    >
      <Icon className="w-3 h-3" />
      {ESTADO_LABELS[efectivo] ?? efectivo}
    </span>
  );
};

export default DocumentStatusBadge;
