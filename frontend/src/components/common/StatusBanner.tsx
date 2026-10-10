import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type BannerTone = 'error' | 'success';

const TONES: Record<BannerTone, { box: string; icon: string; Icon: typeof AlertCircle }> = {
  error: {
    box: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
    icon: 'text-rose-400',
    Icon: AlertCircle,
  },
  success: {
    box: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    icon: 'text-emerald-400',
    Icon: CheckCircle2,
  },
};

interface StatusBannerProps {
  tone: BannerTone;
  message: string | null;
  onDismiss?: () => void;
}

/** Aviso de éxito o error descartable, usado en las páginas de administración. */
export const StatusBanner = ({ tone, message, onDismiss }: StatusBannerProps) => {
  if (!message) return null;
  const { box, icon, Icon } = TONES[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`p-3 border rounded-xl text-xs flex items-center justify-between gap-2 animate-in fade-in ${box}`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 shrink-0 ${icon}`} />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className={`${icon} hover:text-white p-1 cursor-pointer`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
