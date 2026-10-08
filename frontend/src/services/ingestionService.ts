import { getStoredToken } from './api';
import {
  IngestionError,
  type N8nErrorResponse,
  type N8nIngestResponse,
} from '../types/ingestion';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

// Gemini Flash takes 10-45 s per document; 120 s gives ample headroom without
// needing visibility-change cancellation — the request runs to completion even
// when the user switches browser tabs.
const INGEST_TIMEOUT_MS = 120_000;

function isN8nError(body: unknown): body is N8nErrorResponse {
  return typeof body === 'object' && body !== null && 'status' in body && body.status === 'error';
}

export function validateFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (!ALLOWED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return `Formato no admitido. Use ${ALLOWED_EXTENSIONS.join(', ')}.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'El archivo supera el límite de 10 MB.';
  }
  return null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new IngestionError('RESPUESTA_INVALIDA', `n8n respondió HTTP ${response.status} sin un JSON válido.`);
  }
}

export async function ingestDocument(file: File): Promise<N8nIngestResponse> {
  const webhookUrl: string | undefined = import.meta.env.VITE_N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new IngestionError('CONFIGURACION', 'Falta la variable VITE_N8N_WEBHOOK_URL.');
  }

  const formData = new FormData();
  formData.append('data', file);

  const headers = new Headers();
  const token = getStoredToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: formData,
      signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
    });
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'TimeoutError';
    throw new IngestionError(
      'CONEXION_N8N',
      isTimeout ? 'Tiempo de espera agotado (120 s).' : 'No se pudo conectar con el webhook de n8n.',
    );
  }

  const body = await readJson(response);
  if (isN8nError(body)) throw new IngestionError(body.etapa, body.detalle);
  if (!response.ok) {
    throw new IngestionError('HTTP', `n8n respondió con HTTP ${response.status}.`);
  }
  return body as N8nIngestResponse;
}
