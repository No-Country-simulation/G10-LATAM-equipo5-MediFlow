import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';

type ModalTone = 'indigo' | 'rose';

const TONE_CLASSES: Record<ModalTone, string> = {
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

interface ModalShellProps {
  titleId: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  tone?: ModalTone;
  maxWidth?: 'max-w-md' | 'max-w-lg' | 'max-w-xl';
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
}

/** Contenedor de modal con el estilo de MediFlow: overlay con blur, tarjeta y encabezado con ícono. */
export const ModalShell = ({
  titleId,
  title,
  subtitle,
  icon: Icon,
  tone = 'indigo',
  maxWidth = 'max-w-md',
  onClose,
  closeDisabled = false,
  children,
}: ModalShellProps) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
  >
    <div
      className={`relative w-full ${maxWidth} max-h-[90vh] overflow-y-auto bg-slate-900/95 border border-slate-700/60 shadow-2xl backdrop-blur-xl rounded-2xl p-6`}
    >
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`p-2.5 rounded-xl border ${TONE_CLASSES[tone]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 id={titleId} className="text-base font-bold text-white tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Cerrar modal"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
