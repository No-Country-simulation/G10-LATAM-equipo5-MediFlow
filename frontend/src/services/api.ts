const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';
const TOKEN_KEY = 'mediflow_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export const getStoredToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const removeStoredToken = (): void => localStorage.removeItem(TOKEN_KEY);

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export const request = async <T>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const { timeoutMs = 30000, headers, ...customConfig } = options;
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

    if (response.status === 401) {
      removeStoredToken();
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const detail = errorBody?.detail || `Error HTTP: ${response.status} ${response.statusText}`;
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
  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>(url, { ...options, method: 'DELETE' }),
};
