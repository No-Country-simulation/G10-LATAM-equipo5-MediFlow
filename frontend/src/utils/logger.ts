/**
 * Logger central del frontend. Cada línea en la consola del navegador se ve así:
 *
 *   21:14:03.120 INFO  [api] POST /users -> 201 (35 ms) {requestId: 'a1b2c3d4e5f6'}
 *
 * - Nivel mínimo: `VITE_LOG_LEVEL` (`debug` | `info` | `warn` | `error`); por defecto `debug` en
 *   desarrollo y `warn` en producción.
 * - Las últimas entradas quedan en memoria: en la consola, `mediflow.logs()` las muestra en tabla
 *   y `mediflow.downloadLogs()` las descarga para adjuntarlas a un reporte.
 * - El `requestId` es el mismo `X-Request-ID` que registran n8n y el backend: buscándolo en sus
 *   logs se sigue la operación completa.
 *
 * Regla: nunca registrar tokens, contraseñas, nombres de archivo ni datos de pacientes; solo
 * identificadores técnicos (rutas, códigos HTTP, `documento_id`, usernames del personal).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, string | number | boolean | null | undefined>;

export interface LogEntry {
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
  context?: LogContext;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color:#94a3b8',
  info: 'color:#38bdf8;font-weight:600',
  warn: 'color:#f59e0b;font-weight:600',
  error: 'color:#f43f5e;font-weight:700',
};

const MAX_HISTORY = 300;

const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && value in LEVEL_ORDER;

const configuredLevel = import.meta.env.VITE_LOG_LEVEL as string | undefined;
const defaultLevel = (): LogLevel => (import.meta.env.DEV ? 'debug' : 'warn');
const minLevel: LogLevel = isLogLevel(configuredLevel) ? configuredLevel : defaultLevel();

const history: LogEntry[] = [];

const timestamp = () => new Date().toISOString().slice(11, 23);

const write = (level: LogLevel, scope: string, message: string, context?: LogContext) => {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const entry: LogEntry = { time: timestamp(), level, scope, message, context };
  history.push(entry);
  if (history.length > MAX_HISTORY) history.shift();

  const prefix = `%c${entry.time} ${level.toUpperCase().padEnd(5)}%c [${scope}] ${message}`;
  const args: unknown[] = [prefix, LEVEL_STYLES[level], ''];
  if (context && Object.keys(context).length > 0) args.push(context);
  console[level](...args);
};

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
}

/** Logger de un módulo; `scope` aparece entre corchetes en cada línea (`api`, `auth`, ...). */
export const createLogger = (scope: string): Logger => ({
  debug: (message, context) => write('debug', scope, message, context),
  info: (message, context) => write('info', scope, message, context),
  warn: (message, context) => write('warn', scope, message, context),
  error: (message, context) => write('error', scope, message, context),
});

export const getLogHistory = (): readonly LogEntry[] => history;

/** Mensaje de un error para el log (sin el stack completo, que ya muestra la consola). */
export const describeError = (err: unknown): string =>
  err instanceof Error ? `${err.name}: ${err.message}` : String(err);

/** ID de seguimiento de una operación, enviado como `X-Request-ID` al backend y a n8n. */
export const newRequestId = (): string => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

const downloadLogs = () => {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mediflow-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

declare global {
  interface Window {
    mediflow?: { logs: () => void; downloadLogs: () => void };
  }
}

const appLogger = createLogger('app');

/**
 * Registra los errores no capturados del navegador y deja `mediflow.logs()` disponible en la
 * consola. Se llama una vez al iniciar la aplicación.
 */
export const installGlobalLogging = () => {
  window.mediflow = {
    logs: () => console.table(history.map(({ context, ...rest }) => ({ ...rest, context: JSON.stringify(context ?? {}) }))),
    downloadLogs,
  };

  window.addEventListener('error', (event) => {
    appLogger.error('Error no capturado', { message: event.message, source: event.filename, line: event.lineno });
  });
  window.addEventListener('unhandledrejection', (event) => {
    appLogger.error('Promesa rechazada sin manejar', { reason: describeError(event.reason) });
  });

  appLogger.info('MediFlow iniciado', { mode: import.meta.env.MODE, logLevel: minLevel });
};
