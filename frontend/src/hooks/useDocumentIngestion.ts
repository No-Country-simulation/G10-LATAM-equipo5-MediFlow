import { useRef, useState } from 'react';
import { ingestDocument, validateFile } from '../services/ingestionService';
import { documentService } from '../services/documentService';
import { IngestionError, type N8nIngestResponse } from '../types/ingestion';
import type { CoincidenciaArchivo } from '../types/medical';
import { huellaDeArchivo } from '../utils/huella';
import { createLogger, describeError } from '../utils/logger';

const log = createLogger('ingesta');

interface IngestionFailure {
  etapa: string;
  detalle: string;
}

/** Documentos ya registrados con el mismo archivo; vacío si no hay o si no se pudo consultar. */
const buscarDuplicados = async (file: File): Promise<CoincidenciaArchivo[]> => {
  try {
    const sha256 = await huellaDeArchivo(file);
    if (!sha256) return [];
    const { coincidencias } = await documentService.checkDuplicateFiles([sha256]);
    if (coincidencias.length) log.info('El archivo ya fue subido antes', { coincidencias: coincidencias.length });
    return coincidencias;
  } catch (err) {
    // La consulta es solo un aviso previo: si falla, se sigue (el backend marca el duplicado al ingerir).
    log.warn('No se pudo verificar si el archivo ya fue subido', { error: describeError(err) });
    return [];
  }
};

export function useDocumentIngestion() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // true while a valid file is awaiting the user's "Confirm & Analyze" action.
  const [confirmPending, setConfirmPending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<N8nIngestResponse | null>(null);
  const [failure, setFailure] = useState<IngestionFailure | null>(null);
  // Aviso de archivo ya subido: se consulta al elegir el archivo, antes de gastar en la IA.
  const [verificandoDuplicados, setVerificandoDuplicados] = useState(false);
  const [duplicados, setDuplicados] = useState<CoincidenciaArchivo[]>([]);
  const seleccion = useRef(0);

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
    setDuplicados([]);
    setVerificandoDuplicados(true);
    // Immediately surface the confirmation dialog instead of auto-submitting.
    setConfirmPending(true);

    // Si el usuario elige otro archivo antes de que responda, la respuesta vieja se ignora.
    const actual = ++seleccion.current;
    void buscarDuplicados(file).then((encontrados) => {
      if (actual !== seleccion.current) return;
      setDuplicados(encontrados);
      setVerificandoDuplicados(false);
    });
  };

  // Called when the user dismisses the confirmation modal without sending.
  const cancelConfirmation = () => {
    seleccion.current += 1;
    setSelectedFile(null);
    setConfirmPending(false);
    setDuplicados([]);
    setVerificandoDuplicados(false);
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
    seleccion.current += 1;
    setSelectedFile(null);
    setConfirmPending(false);
    setResult(null);
    setFailure(null);
    setDuplicados([]);
    setVerificandoDuplicados(false);
  };

  return {
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
  };
}
