import type { ChangeEvent } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface AuditActionButtonsProps {
  discardMode: boolean;
  setDiscardMode: (val: boolean) => void;
  motivoDescarte: string;
  handleChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleDiscard: () => void;
  handleCancel: () => void;
  submitting: boolean;
}

const AuditActionButtons = ({
  discardMode,
  setDiscardMode,
  motivoDescarte,
  handleChange,
  handleDiscard,
  handleCancel,
  submitting,
}: AuditActionButtonsProps) => {
  if (discardMode) {
    return (
      <div className="space-y-4 animate-fade-in p-4 sm:p-5 border-t border-rose-500/30 bg-rose-500/5">
        <h4 className="text-sm font-bold text-rose-400">Descartar Documento</h4>
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
            Motivo del descarte
          </label>
          <textarea
            name="motivo_descarte"
            value={motivoDescarte}
            onChange={handleChange}
            placeholder="Ej: Documento borroso, ilegible o no clínico"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white min-h-24"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setDiscardMode(false)}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={submitting}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            Confirmar Descarte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-slate-800/80 bg-slate-900 flex items-center justify-between">
      <button
        type="button"
        onClick={() => setDiscardMode(true)}
        className="px-4 py-2 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
      >
        Descartar Documento
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-800 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          form="audit-form"
          disabled={submitting}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar y Enrutar
        </button>
      </div>
    </div>
  );
};

export default AuditActionButtons;
