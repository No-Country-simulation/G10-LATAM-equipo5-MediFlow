import { useState } from 'react';
import { Sparkles, AlertCircle } from 'lucide-react';
import DocumentDropzone from '../components/ingestion/DocumentDropzone';
import TriageProcessSummary from '../components/ingestion/TriageProcessSummary';
import { documentService } from '../services/documentService';
import type { ClinicalSample } from '../types/ingestion';
import type { IngestResponse } from '../types/document';

const IngestionPage = () => {
  const [selectedFile, setSelectedFile] = useState<ClinicalSample | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<IngestResponse | undefined>(undefined);

  const handleStartTriage = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setIsCompleted(false);
    setError(null);

    try {
      const fileToUpload = selectedFile.file || new File(['dummy content'], selectedFile.name, { type: 'application/pdf' });
      const result = await documentService.ingestDocument(fileToUpload);
      setResponse(result);
      setIsCompleted(true);
    } catch (err) {
      console.error('Ingestion error', err);
      const errDetail = err instanceof Error ? err.message : 'Error al procesar el documento. Intente de nuevo.';
      setError(errDetail);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setIsCompleted(false);
    setError(null);
    setResponse(undefined);
  };

  return (
    <div className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
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

        <button
          type="button"
          disabled={!selectedFile || isProcessing || isCompleted}
          onClick={() => void handleStartTriage()}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-xl text-xs shadow-lg shadow-emerald-950/40 border border-emerald-400/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-emerald-100" />
          <span>{isProcessing ? 'Procesando Triaje Clínico...' : 'Iniciar Triaje con Agente IA'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-rose-400">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold block mb-1">Error durante la ingesta:</span>
            {error}
          </div>
        </div>
      )}

      {!isCompleted ? (
        <DocumentDropzone
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
          disabled={isProcessing}
        />
      ) : (
        selectedFile && <TriageProcessSummary file={selectedFile} response={response} onReset={handleReset} />
      )}
    </div>
  );
};

export default IngestionPage;
