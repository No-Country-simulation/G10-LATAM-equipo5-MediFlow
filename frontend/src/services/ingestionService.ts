import { ensureFreshToken } from './api';
import { N8N_WEBHOOK_INGESTION_URL } from '@/config/api';
import { createLogger, describeError, newRequestId, type LogContext } from '@/utils/logger';
import {
  IngestionError,
  type N8nErrorResponse,
  type N8nIngestResponse,
} from '../types/ingestion';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
// Un TXT/JSON va como texto al prompt del LLM: 1 MB ya son ~250 mil tokens.
export const MAX_TEXT_FILE_SIZE_BYTES = 1 * 1024 * 1024;
export const TEXT_EXTENSIONS = ['.txt', '.json'];
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', ...TEXT_EXTENSIONS];

// Gemini tarda 10-45 s por documento y n8n puede repetir la extracción con el modelo preciso
// cuando el rápido tiene dudas: 180 s cubren ambas llamadas. La petición sigue aunque el usuario
// cambie de pestaña.
const INGEST_TIMEOUT_MS = 180_000;

const log = createLogger('ingesta');

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
  if (TEXT_EXTENSIONS.some((extension) => lowerName.endsWith(extension)) && file.size > MAX_TEXT_FILE_SIZE_BYTES) {
    return 'Los archivos TXT y JSON no pueden superar 1 MB.';
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

const failIngestion = (etapa: string, detalle: string, context: LogContext): never => {
  log.error(`Ingesta fallida en ${etapa}: ${detalle}`, context);
  throw new IngestionError(etapa, detalle);
};

/**
 * Envía el documento al webhook de n8n. `request_id` viaja como campo del formulario: n8n lo
 * reenvía al backend como `X-Request-ID`, así que con ese valor se sigue la ingesta en los tres
 * logs. El nombre del archivo no se registra (puede incluir el nombre del paciente).
 */
export async function ingestDocument(file: File): Promise<N8nIngestResponse> {
  const requestId = newRequestId();
  const fileInfo: LogContext = { requestId, type: file.type || 'desconocido', sizeKb: Math.round(file.size / 1024) };

  const webhookUrl = N8N_WEBHOOK_INGESTION_URL;
  if (!webhookUrl) {
    return failIngestion('CONFIGURACION', 'Falta la URL de webhook para n8n.', fileInfo);
  }

  // n8n reenvía el token al backend y no puede renovarlo: debe seguir vigente toda la ingesta.
  const token = await ensureFreshToken(INGEST_TIMEOUT_MS + 60_000);

  const formData = new FormData();
  formData.append('data', file);
  formData.append('request_id', requestId);
  if (token) {
    formData.append('token', token);
  }

  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  log.info('Enviando documento a n8n', fileInfo);
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);

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
    return failIngestion(
      'CONEXION_N8N',
      isTimeout ? 'Tiempo de espera agotado (180 s).' : 'No se pudo conectar con el webhook de n8n.',
      { ...fileInfo, durationMs: elapsed(), error: describeError(error) },
    );
  }

  const body = await readJson(response);
  const result: LogContext = { requestId, httpStatus: response.status, durationMs: elapsed() };
  if (isN8nError(body)) return failIngestion(body.etapa, body.detalle, { ...result, n8nRequestId: body.request_id });
  if (!response.ok) {
    return failIngestion('HTTP', `n8n respondió con HTTP ${response.status}.`, result);
  }

  const ingested = body as N8nIngestResponse;
  log.info('Documento procesado por n8n', {
    ...result,
    documentoId: ingested.documento_id,
    estado: ingested.status,
    tipo: ingested.clasificacion?.tipo_documento,
  });
  return ingested;
}
