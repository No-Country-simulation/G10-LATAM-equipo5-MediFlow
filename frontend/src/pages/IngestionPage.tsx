import { AlertCircle, FileText, Sparkles, X } from 'lucide-react';
import ProcessingScanner from '../components/ingestion/ProcessingScanner';
import DocumentDropzone from '../components/ingestion/DocumentDropzone';
import TriageProcessSummary from '../components/ingestion/TriageProcessSummary';
import { useDocumentIngestion } from '../hooks/useDocumentIngestion';

const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

// ---------------------------------------------------------------------------
// Confirmation modal — shown immediately after a valid file is selected.
// ---------------------------------------------------------------------------
interface ConfirmModalProps {
  file: File;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({ file, onConfirm, onCancel }: ConfirmModalProps) => (
  // Backdrop — clicking it is equivalent to "Cambiar archivo".
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-modal-title"
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    onClick={onCancel}
  >
    <div
      className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/60 p-6 space-y-5"
      // Prevent backdrop click propagation when clicking the card itself.
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCancel}
        className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* File info */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <FileText className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p id="confirm-modal-title" className="text-sm font-bold text-white leading-snug truncate">
            {file.name}
          </p>
          <p className="text-xs text-slate-400">{formatSize(file.size)}</p>
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed">
        Documento cargado correctamente. ¿Desea iniciar el análisis clínico?
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-emerald-100" />
          Confirmar y Analizar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer"
        >
          Cambiar archivo
        </button>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const IngestionPage = () => {
  const {
    selectedFile,
    confirmPending,
    isProcessing,
    result,
    failure,
    selectFile,
    cancelConfirmation,
    submit,
    reset,
  } = useDocumentIngestion();

  return (
    <>
      {/* Confirmation modal rendered as a portal-like overlay */}
      {confirmPending && selectedFile && (
        <ConfirmModal
          file={selectedFile}
          onConfirm={() => void submit()}
          onCancel={cancelConfirmation}
        />
      )}

      <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Header — button removed; the dropzone is now the sole flow initiator */}
        <div className="border-b border-slate-800 pb-5">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Recepción e Ingesta de Documentos Clínicos</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Triaje Asistencial
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Carga o arrastre de documentación clínica para extracción y derivación hospitalaria
            automatizada.
          </p>
        </div>

        {/* Error banner — visible when analysis ended with a known failure */}
        {failure && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-semibold block mb-1">Falló la etapa {failure.etapa}</span>
              {failure.detalle}
            </div>
          </div>
        )}

        {/* Main content area */}
        {result ? (
          // Results are available — show summary (includes "Procesar otro documento")
          <TriageProcessSummary response={result} onReset={reset} />
        ) : isProcessing ? (
          // Request is in-flight — show clinical progress scanner
          <ProcessingScanner fileName={selectedFile?.name} />
        ) : failure ? (
          // Definitive error — show dropzone again + a "Procesar otro documento" CTA
          <div className="space-y-4">
            <DocumentDropzone onSelectFile={selectFile} />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={reset}
                className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
              >
                Procesar otro documento
              </button>
            </div>
          </div>
        ) : (
          // Idle — show the dropzone
          <DocumentDropzone onSelectFile={selectFile} />
        )}
      </div>
    </>
  );
};

export default IngestionPage;
