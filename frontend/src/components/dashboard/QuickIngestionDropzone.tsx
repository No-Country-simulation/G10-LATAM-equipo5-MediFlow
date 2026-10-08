import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';
import { useDocumentIngestion } from '../../hooks/useDocumentIngestion';
import ProcessingScanner from '../ingestion/ProcessingScanner';
import TriageProcessSummary from '../ingestion/TriageProcessSummary';

interface QuickIngestionDropzoneProps {
  onSuccess?: () => void;
}

export const QuickIngestionDropzone = ({ onSuccess }: QuickIngestionDropzoneProps) => {
  const { selectedFile, confirmPending, isProcessing, result, failure, selectFile, submit, reset } = useDocumentIngestion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (confirmPending && selectedFile && !isProcessing) void submit();
  }, [confirmPending, selectedFile, isProcessing, submit]);

  useEffect(() => {
    if (result) onSuccess?.();
  }, [result, onSuccess]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectFile(file);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
  };

  return (
    <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm relative overflow-hidden">
      <div className="border-b border-slate-800/80 pb-4 mb-5">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Procesamiento y Triaje Autónomo con IA</h2>
        <p className="text-xs text-slate-400 mt-1">Arrastra un documento clínico en PDF, PNG o JPG para clasificación y extracción estructurada de entidades médicas.</p>
      </div>

      {result ? (
        <TriageProcessSummary response={result} onReset={reset} />
      ) : isProcessing ? (
        <ProcessingScanner fileName={selectedFile?.name} />
      ) : (
        <>
          {failure && (
            <div role="alert" className="p-3.5 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div><span className="font-semibold block mb-0.5">Falló la etapa {failure.etapa}</span>{failure.detalle}</div>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleChange} />

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group ${
              isDragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700 hover:border-emerald-500/60 bg-slate-950/40 hover:bg-emerald-950/10'
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm sm:text-base font-semibold text-slate-200 group-hover:text-emerald-300 transition-colors">
                  Arrastra y suelta tu expediente clínico aquí o haz clic para explorar
                </p>
                <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG (Máx. 10 MB)</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all cursor-pointer hover:shadow-emerald-500/20 active:scale-[0.98]"
            >
              <span>Cargar Archivo y Analizar con IA →</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default QuickIngestionDropzone;
