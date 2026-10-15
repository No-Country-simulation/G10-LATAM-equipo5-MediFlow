import { useState } from 'react';
import { AlertCircle, CheckCheck, Loader2 } from 'lucide-react';
import { normalizePriority, type DocumentListItemResponse } from '../../types/medical';
import PriorityBadge from '../common/PriorityBadge';
import { ModalShell } from '../common/ModalShell';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_GHOST } from '../common/formStyles';
import { formatIdentificacion } from '../../utils/identificacion';

export type TriageCase = DocumentListItemResponse;

export interface ConfirmAttendModalProps {
  isOpen: boolean;
  caseItem: TriageCase | null;
  onConfirm: (caseId: string) => Promise<void> | void;
  onClose: () => void;
  loading?: boolean;
}

const BUTTON_EMERALD =
  'flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-lg shadow-emerald-950/40 border border-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer';

export const ConfirmAttendModal = ({ isOpen, caseItem, onConfirm, onClose, loading = false }: ConfirmAttendModalProps) => {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !caseItem) return null;

  const isUrgent = normalizePriority(caseItem.nivel_prioridad) === 'Urgente';
  const isBusy = loading || internalSubmitting;
  const docCode = caseItem.documento_id.startsWith('DOC-')
    ? caseItem.documento_id
    : `DOC-CLIN-${caseItem.documento_id.slice(0, 8).toUpperCase()}`;
  const clinicalDiagnosis = caseItem.diagnostico_principal || caseItem.tipo_documento || 'Sin diagnóstico especificado';

  const handleConfirm = async () => {
    try {
      setInternalSubmitting(true);
      setError(null);
      await onConfirm(caseItem.documento_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar la atención');
    } finally {
      setInternalSubmitting(false);
    }
  };

  return (
    <ModalShell
      titleId="confirmar-atencion-titulo"
      title="Confirmar Atención de Caso"
      subtitle={`${caseItem.nombre_paciente || 'Paciente sin identificar'} · ${docCode}`}
      icon={isUrgent ? AlertCircle : CheckCheck}
      tone={isUrgent ? 'rose' : 'indigo'}
      onClose={onClose}
      closeDisabled={isBusy}
    >
      <div className="mt-4 space-y-3.5">
        <StatusBanner tone="error" message={error} />

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-sm font-bold text-slate-200 block">
                {caseItem.nombre_paciente || 'Paciente sin identificar'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {formatIdentificacion(caseItem.identificacion_paciente, caseItem.tipo_identificacion)} • {docCode}
              </span>
            </div>
            <PriorityBadge prioridad={caseItem.nivel_prioridad} />
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
              Diagnóstico Clínico
            </span>
            <p className="font-medium text-slate-200 line-clamp-2 mt-0.5">
              {clinicalDiagnosis}
            </p>
          </div>
        </div>

        {isUrgent && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              <strong>Caso Urgente:</strong> Verifica que el equipo médico haya tomado conocimiento efectivo antes de confirmar la atención.
            </span>
          </div>
        )}

        <p className="text-xs text-slate-300 leading-relaxed">
          ¿Confirmas que el equipo asistencial tomó conocimiento y el paciente ingresó a atención médica? El caso saldrá de la bandeja de triaje activo.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={isBusy} className={BUTTON_GHOST}>
            Cancelar
          </button>
          <button type="button" onClick={() => void handleConfirm()} disabled={isBusy} className={BUTTON_EMERALD}>
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            <span>Confirmar atención</span>
          </button>
        </div>
      </div>
    </ModalShell>
  );
};

export default ConfirmAttendModal;
