import { API_BASE_URL, FASTAPI_ENDPOINTS } from '@/config/api';
import type { TokenResponse } from '@/types/auth';
import { createLogger, describeError, newRequestId } from '@/utils/logger';

const TOKEN_KEY = 'mediflow_token';
const REFRESH_TOKEN_KEY = 'mediflow_refresh_token';

/** Mismo header que registran el backend y n8n: une los logs de una operación. */
export const REQUEST_ID_HEADER = 'X-Request-ID';

const log = createLogger('api');

export class ApiError extends Error {
  status: number;
  /** ID de seguimiento de la petición: búsquelo en los logs del backend. */
  requestId?: string;

  constructor(status: number, message: string, requestId?: string) {
    // En errores del servidor el usuario ve el código para reportarlo (si el backend no lo incluyó).
    const showReference = requestId !== undefined && (status >= 500 || status === 0) && !message.includes(requestId);
    super(showReference ? `${message} (código de seguimiento: ${requestId})` : message);
    this.status = status;
    this.requestId = requestId;
    this.name = 'ApiError';
  }
}

/**
 * Ruta para el log, con los nombres de los parámetros de la query pero sin sus valores
 * (pueden ser datos de pacientes, ej. `?rut=...`).
 */
export const describeEndpoint = (endpoint: string): string => {
  const [path, query] = endpoint.replace(API_BASE_URL, '').split('?');
  if (!query) return path;
  const names = [...new Set([...new URLSearchParams(query).keys()])].sort((a, b) => a.localeCompare(b));
  return `${path}?${names.join(',')}`;
};

export const getStoredToken = (): string | null => sessionStorage.getItem(TOKEN_KEY);
export const getStoredRefreshToken = (): string | null => sessionStorage.getItem(REFRESH_TOKEN_KEY);
export const setStoredTokens = (accessToken: string, refreshToken: string): void => {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};
export const removeStoredToken = (): void => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};

let refreshInFlight: Promise<string | null> | null = null;

const requestNewTokens = async (): Promise<string | null> => {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  const requestId = newRequestId();
  try {
    const response = await fetch(`${API_BASE_URL}${FASTAPI_ENDPOINTS.auth.refresh}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [REQUEST_ID_HEADER]: requestId },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      log.warn(`No se pudo renovar la sesión (HTTP ${response.status})`, { requestId });
      return null;
    }

    const tokens = (await response.json()) as TokenResponse;
    setStoredTokens(tokens.access_token, tokens.refresh_token);
    window.dispatchEvent(new CustomEvent<TokenResponse>('auth:token-refreshed', { detail: tokens }));
    log.info('Sesión renovada con el refresh token', { requestId, user: tokens.user.username });
    return tokens.access_token;
  } catch (err) {
    log.error('Error de red al renovar la sesión', { requestId, error: describeError(err) });
    return null;
  }
};

/**
 * Canjea el refresh token por un par nuevo. El backend rota el refresh token (es de un solo
 * uso), así que las llamadas concurrentes comparten la misma petición.
 */
export const refreshAccessToken = (): Promise<string | null> => {
  refreshInFlight ??= requestNewTokens().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

const getTokenExpiresAt = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

/**
 * Retorna un access token con al menos `minValidityMs` de vigencia, renovándolo si hace falta.
 * Útil antes de entregar el token a terceros (n8n), que no pueden refrescarlo por su cuenta.
 */
export const ensureFreshToken = async (minValidityMs = 60000): Promise<string | null> => {
  const token = getStoredToken();
  if (!token) return null;

  const expiresAt = getTokenExpiresAt(token);
  if (expiresAt !== null && expiresAt - Date.now() > minValidityMs) return token;
  return (await refreshAccessToken()) ?? token;
};

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  /** No intentar renovar el token ante un 401 (login, logout o el reintento tras renovar). */
  skipAuthRefresh?: boolean;
}

const buildHeaders = (headers: HeadersInit | undefined, body: unknown, token: string | null, requestId: string) => {
  const requestHeaders = new Headers(headers);
  if (token && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }
  if (!requestHeaders.has('Content-Type') && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  return requestHeaders;
};

const readErrorDetail = async (response: Response): Promise<string> => {
  const errorBody = await response.json().catch(() => null);
  const detail = errorBody?.detalle ? `[${errorBody?.etapa || 'Error'}] ${errorBody.detalle}` : errorBody?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? String(d)).join('; ');
  return `Error HTTP: ${response.status} ${response.statusText}`;
};

/** Error de red o de ejecución traducido a `ApiError` con un mensaje para el usuario. */
const toApiError = (error: unknown, requestId: string): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new ApiError(408, 'Tiempo de espera agotado al conectar con el servidor', requestId);
  }
  if (error instanceof TypeError) {
    return new ApiError(0, 'No se pudo conectar con el servidor. Verifique su conexión de red', requestId);
  }
  return new ApiError(500, error instanceof Error ? error.message : 'Error de red inesperado', requestId);
};

const logResponse = (method: string, target: string, status: number, durationMs: number, requestId: string) => {
  const message = `${method} ${target} -> ${status} (${durationMs} ms)`;
  const context = { requestId };
  if (status >= 500) log.error(message, context);
  else if (status >= 400) log.warn(message, context);
  else log.debug(message, context);
};

export const request = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const { timeoutMs = 30000, skipAuthRefresh = false, headers, ...customConfig } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const method = (customConfig.method ?? 'GET').toUpperCase();
  const target = describeEndpoint(endpoint);
  const requestId = newRequestId();
  const token = getStoredToken();
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      ...customConfig,
      headers: buildHeaders(headers, customConfig.body, token, requestId),
      signal: controller.signal,
    });
    logResponse(method, target, response.status, Math.round(performance.now() - startedAt), requestId);

    if (response.status === 401 && token && !skipAuthRefresh && (await refreshAccessToken())) {
      log.debug(`Reintentando ${method} ${target} con el token renovado`);
      return await request<T>(endpoint, { ...options, skipAuthRefresh: true });
    }

    if (response.status === 401 && token) {
      log.warn('Sesión expirada o revocada: se cierra la sesión', { requestId });
      removeStoredToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (!response.ok) {
      throw new ApiError(response.status, await readErrorDetail(response), response.headers.get(REQUEST_ID_HEADER) ?? requestId);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    const apiError = toApiError(error, requestId);
    if (apiError.status === 0 || apiError.status === 408) {
      log.error(`${method} ${target} falló: ${apiError.message}`, { requestId });
    }
    throw apiError;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const api = {
  get: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  put: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};
