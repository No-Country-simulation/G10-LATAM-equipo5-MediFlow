import { useState } from 'react';
import { Sparkles, UploadCloud, X, FileText, CheckCircle2 } from 'lucide-react';

interface NewDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentIngested?: () => void;
}

const DEMO_CASES = [
  { label: 'TAC Urgente TEP', title: 'Simular TAC Urgente', sub: 'TEP / Derivación Inmediata', color: 'text-rose-400', hover: 'hover:bg-rose-500/20 hover:border-rose-500/40' },
  { label: 'Orden Consulta Control', title: 'Simular Orden Rutina', sub: 'Autorización Automática', color: 'text-emerald-400', hover: 'hover:bg-emerald-500/20 hover:border-emerald-500/40' },
] as const;
const NewDocumentModal = ({ isOpen, onClose, onDocumentIngested }: NewDocumentModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;
  const handleClose = () => {
    setSuccessMessage(null);
    onClose();
  };

  const handleSimulateIngest = (label: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setSuccessMessage(`Documento "${label}" procesado y derivado con éxito.`);
      onDocumentIngested?.();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl shadow-black space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Ingesta y Triaje Autónomo</h3>
              <p className="text-xs text-slate-400">Clasificación OCR/LLM y derivación hospitalaria automática</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <div className="text-sm font-semibold text-emerald-300">{successMessage}</div>
            <p className="text-xs text-slate-400">Integrado en OCI Storage y derivado a la cola clínica.</p>
            <button type="button" onClick={handleClose} className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-lg shadow-emerald-950/40 border border-emerald-400/30">
              Aceptar y continuar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-700 hover:border-rose-500/50 rounded-2xl p-6 text-center space-y-2 bg-slate-950/40 transition-colors">
              <UploadCloud className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="text-sm font-semibold text-slate-200">Arrastre un informe clínico o receta</div>
              <p className="text-xs text-slate-400">Formatos soportados: PDF, JPEG o PNG hasta 10 MB</p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">O simular ingesta directa para demo:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_CASES.map(({ label, title, sub, color, hover }) => (
                  <button key={label} type="button" disabled={isProcessing} onClick={() => handleSimulateIngest(label)} className={`flex items-center gap-2.5 p-3 rounded-xl bg-slate-800/60 ${hover} border border-slate-700 text-left transition-all disabled:opacity-50 text-xs text-slate-200 cursor-pointer`}>
                    <FileText className={`w-4 h-4 ${color}`} />
                    <div>
                      <div className="font-semibold">{title}</div>
                      <div className="text-[10px] text-slate-400">{sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewDocumentModal;
