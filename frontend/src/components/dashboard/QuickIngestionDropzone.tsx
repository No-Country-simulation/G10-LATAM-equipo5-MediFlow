import { useState, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react';
import { UploadCloud, AlertCircle, Loader2 } from 'lucide-react';
import { useDocumentIngestion } from '../../hooks/useDocumentIngestion';
import { ALLOWED_EXTENSIONS } from '../../services/ingestionService';
import ProcessingScanner from '../ingestion/ProcessingScanner';
import TriageProcessSummary from '../ingestion/TriageProcessSummary';
import DuplicateFileWarning from '../ingestion/DuplicateFileWarning';

interface QuickIngestionDropzoneProps {
  onSuccess?: () => void;
}

export const QuickIngestionDropzone = ({ onSuccess }: QuickIngestionDropzoneProps) => {
  const {
    selectedFile,
    confirmPending,
    isProcessing,
    result,
    failure,
    verificandoDuplicados,
    duplicados,
    selectFile,
    cancelConfirmation,
    submit,
    reset,
  } = useDocumentIngestion();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Se envía solo: primero se verifica que el archivo no se haya subido antes; si ya se subió, el
  // usuario decide ("Subir igual" o "Cancelar").
  const hayDuplicados = duplicados.length > 0;
  useEffect(() => {
    if (confirmPending && selectedFile && !isProcessing && !verificandoDuplicados && !hayDuplicados) void submit();
  }, [confirmPending, selectedFile, isProcessing, verificandoDuplicados, hayDuplicados, submit]);

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

  // Una sola vista a la vez: resultado, procesando, verificando el archivo, aviso de duplicado o
  // la zona para soltar el archivo.
  const contenido = () => {
    if (result) {
      return (
        <TriageProcessSummary response={result} onReset={reset} />
      );
    }
    if (isProcessing) {
      return (
        <ProcessingScanner fileName={selectedFile?.name} />
      );
    }
    if (confirmPending && verificandoDuplicados) {
      return (
        <div className="p-8 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Verificando si el archivo ya fue subido...
        </div>
      );
    }
    if (confirmPending && hayDuplicados) {
      return (
        <div className="space-y-4">
          <DuplicateFileWarning coincidencias={duplicados} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelConfirmation}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/30 transition-colors cursor-pointer"
            >
              Subir igual
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        {failure && (
          <div role="alert" className="p-3.5 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div><span className="font-semibold block mb-0.5">Falló la etapa {failure.etapa}</span>{failure.detalle}</div>
          </div>
        )}
  
        <input ref={fileInputRef} type="file" accept={ALLOWED_EXTENSIONS.join(',')} className="hidden" onChange={handleChange} />
  
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
              <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG (Máx. 10 MB) · TXT, JSON (Máx. 1 MB)</p>
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
    );
  };

  return (
    <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm relative overflow-hidden">
      <div className="border-b border-slate-800/80 pb-4 mb-5">
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Procesamiento y Triaje Autónomo con IA</h2>
        <p className="text-xs text-slate-400 mt-1">Arrastra un documento clínico en PDF, PNG, JPG, TXT o JSON para clasificación y extracción estructurada de entidades médicas.</p>
      </div>

      {contenido()}
    </div>
  );
};

export default QuickIngestionDropzone;
