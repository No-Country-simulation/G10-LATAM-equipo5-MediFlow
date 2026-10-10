import { API_BASE_URL, FASTAPI_ENDPOINTS } from '@/config/api';
import type { TokenResponse } from '@/types/auth';

const TOKEN_KEY = 'mediflow_token';
const REFRESH_TOKEN_KEY = 'mediflow_refresh_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

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

  try {
    const response = await fetch(`${API_BASE_URL}${FASTAPI_ENDPOINTS.auth.refresh}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;

    const tokens = (await response.json()) as TokenResponse;
    setStoredTokens(tokens.access_token, tokens.refresh_token);
    window.dispatchEvent(new CustomEvent<TokenResponse>('auth:token-refreshed', { detail: tokens }));
    return tokens.access_token;
  } catch {
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

export const request = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const { timeoutMs = 30000, skipAuthRefresh = false, headers, ...customConfig } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const token = getStoredToken();
  const requestHeaders = new Headers(headers);

  if (token && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${token}`);
  }

  if (!requestHeaders.has('Content-Type') && !(customConfig.body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...customConfig,
      headers: requestHeaders,
      signal: controller.signal,
    });

    if (response.status === 401 && token && !skipAuthRefresh && (await refreshAccessToken())) {
      return await request<T>(endpoint, { ...options, skipAuthRefresh: true });
    }

    if (response.status === 401) {
      removeStoredToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const detailStr = errorBody?.detalle ? `[${errorBody?.etapa || 'Error'}] ${errorBody.detalle}` : errorBody?.detail;
      const detail = detailStr || `Error HTTP: ${response.status} ${response.statusText}`;
      throw new ApiError(response.status, detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(408, 'Tiempo de espera agotado al conectar con el servidor');
    }
    if (error instanceof TypeError) {
      throw new ApiError(0, 'No se pudo conectar con el servidor. Verifique su conexión de red');
    }
    throw new ApiError(500, error instanceof Error ? error.message : 'Error de red inesperado');
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
