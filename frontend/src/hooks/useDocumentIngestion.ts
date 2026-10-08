import { useState } from 'react';
import { ingestDocument, validateFile } from '../services/ingestionService';
import { IngestionError, type N8nIngestResponse } from '../types/ingestion';

interface IngestionFailure {
  etapa: string;
  detalle: string;
}

export function useDocumentIngestion() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // true while a valid file is awaiting the user's "Confirm & Analyze" action.
  const [confirmPending, setConfirmPending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<N8nIngestResponse | null>(null);
  const [failure, setFailure] = useState<IngestionFailure | null>(null);

  const selectFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setSelectedFile(null);
      setConfirmPending(false);
      setFailure({ etapa: 'VALIDACION_ARCHIVO', detalle: validationError });
      return;
    }
    setFailure(null);
    setSelectedFile(file);
    // Immediately surface the confirmation dialog instead of auto-submitting.
    setConfirmPending(true);
  };

  // Called when the user dismisses the confirmation modal without sending.
  const cancelConfirmation = () => {
    setSelectedFile(null);
    setConfirmPending(false);
  };

  const submit = async () => {
    if (!selectedFile || isProcessing) return;
    setConfirmPending(false);
    setIsProcessing(true);
    setFailure(null);
    try {
      setResult(await ingestDocument(selectedFile));
    } catch (error) {
      setFailure(
        error instanceof IngestionError
          ? { etapa: error.etapa, detalle: error.message }
          : { etapa: 'DESCONOCIDO', detalle: 'Error inesperado al procesar el documento.' },
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Resets every piece of state — call this from the "Procesar otro documento" button.
  const reset = () => {
    setSelectedFile(null);
    setConfirmPending(false);
    setResult(null);
    setFailure(null);
  };

  return {
    selectedFile,
    confirmPending,
    isProcessing,
    result,
    failure,
    selectFile,
    cancelConfirmation,
    submit,
    reset,
  };
}
