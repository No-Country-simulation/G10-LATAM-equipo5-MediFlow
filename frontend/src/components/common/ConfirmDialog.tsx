import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { BUTTON_DANGER, BUTTON_GHOST } from './formStyles';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/** Confirmación de una acción destructiva; mantiene el diálogo abierto mientras se ejecuta. */
export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = 'Eliminar',
  onConfirm,
  onClose,
}: ConfirmDialogProps) => {
  const [isRunning, setIsRunning] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsRunning(true);
    try {
      await onConfirm();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <ModalShell
      titleId="confirm-dialog-title"
      title={title}
      icon={Trash2}
      tone="rose"
      onClose={onClose}
      closeDisabled={isRunning}
    >
      <div className="mt-4 space-y-2 text-xs">
        <p className="text-slate-200">{message}</p>
        {detail && <p className="text-slate-400">{detail}</p>}
      </div>
      <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-slate-800/80">
        <button type="button" onClick={onClose} disabled={isRunning} className={BUTTON_GHOST}>
          Cancelar
        </button>
        <button type="button" onClick={() => void handleConfirm()} disabled={isRunning} className={BUTTON_DANGER}>
          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          <span>{isRunning ? 'Procesando...' : confirmLabel}</span>
        </button>
      </div>
    </ModalShell>
  );
};
