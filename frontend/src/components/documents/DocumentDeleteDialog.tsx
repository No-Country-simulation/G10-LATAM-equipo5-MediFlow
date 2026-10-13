import { useState, type FormEvent } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { ModalShell } from '../common/ModalShell';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_DANGER, BUTTON_GHOST, BUTTON_PRIMARY, HINT, INPUT_BASE, LABEL } from '../common/formStyles';

const MIN_MOTIVO = 5;

interface DocumentDeleteDialogProps {
  documentoId: string;
  /** `eliminar`: pasa a ELIMINADO; `restaurar`: vuelve a su estado anterior. */
  accion: 'eliminar' | 'restaurar';
  onClose: () => void;
  /** Devuelve un mensaje de error, o `null` si se guardó. */
  onConfirm: (motivo: string) => Promise<string | null>;
}

/** Confirma la eliminación lógica (o la restauración) de un documento pidiendo el motivo. */
const DocumentDeleteDialog = ({ documentoId, accion, onClose, onConfirm }: DocumentDeleteDialogProps) => {
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eliminar = accion === 'eliminar';
  const Icono = eliminar ? Trash2 : RotateCcw;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (motivo.trim().length < MIN_MOTIVO) return setError(`El motivo debe tener al menos ${MIN_MOTIVO} caracteres`);
    setSubmitting(true);
    setError(null);
    const failure = await onConfirm(motivo.trim());
    setSubmitting(false);
    if (failure) setError(failure);
  };

  return (
    <ModalShell
      titleId="eliminar-documento-titulo"
      title={eliminar ? 'Eliminar documento' : 'Restaurar documento'}
      subtitle={documentoId}
      icon={Icono}
      tone={eliminar ? 'rose' : 'indigo'}
      onClose={onClose}
      closeDisabled={submitting}
    >
      <p className="mt-4 text-xs text-slate-300 leading-relaxed">
        {eliminar
          ? 'El documento dejará de aparecer en Expedientes, Triaje, Auditoría y el inicio. No se borra: queda registrado quién, cuándo y por qué, y se puede restaurar desde el filtro "Eliminados".'
          : 'El documento vuelve al estado que tenía antes de eliminarlo y reaparece en los listados.'}
      </p>

      <div className="mt-3 empty:hidden">
        <StatusBanner tone="error" message={error} />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-3.5">
        <div>
          <label htmlFor="eliminar-motivo" className={LABEL}>Motivo</label>
          <textarea
            id="eliminar-motivo"
            required
            autoFocus
            rows={3}
            minLength={MIN_MOTIVO}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={eliminar ? 'Ej.: documento de otro paciente subido por error.' : 'Ej.: se eliminó por error.'}
            className={`w-full px-3 resize-y ${INPUT_BASE}`}
          />
          <p className={HINT}>Queda registrado en el historial del documento.</p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={submitting} className={BUTTON_GHOST}>Cancelar</button>
          <button type="submit" disabled={submitting} className={eliminar ? BUTTON_DANGER : BUTTON_PRIMARY}>
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icono className="w-3.5 h-3.5" />}
            <span>{eliminar ? 'Eliminar' : 'Restaurar'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export default DocumentDeleteDialog;
