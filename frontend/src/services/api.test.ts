import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  api,
  request,
  getStoredToken,
  getStoredRefreshToken,
  setStoredTokens,
  ensureFreshToken,
  ApiError,
  REQUEST_ID_HEADER,
} from './api';

describe('API service core and interceptors', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('Headers injection', () => {
    it('automatically injects X-Request-ID and Authorization Bearer header when token exists', async () => {
      setStoredTokens('test-access-token', 'test-refresh-token');

      let capturedHeaders: Headers | null = null;
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return Promise.resolve(
          new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const data = await api.get<{ status: string }>('/test-endpoint');

      expect(data).toEqual({ status: 'ok' });
      expect(capturedHeaders).not.toBeNull();
      expect(capturedHeaders!.get(REQUEST_ID_HEADER)).toBeTruthy();
      expect(capturedHeaders!.get('Authorization')).toBe('Bearer test-access-token');
      expect(capturedHeaders!.get('Content-Type')).toBe('application/json');
    });

    it('does not force application/json when sending FormData', async () => {
      let capturedHeaders: Headers | null = null;
      globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
        capturedHeaders = new Headers(init?.headers);
        return Promise.resolve(
          new Response(JSON.stringify({ uploaded: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      const formData = new FormData();
      formData.append('file', 'data');
      await api.post('/upload', formData);

      expect(capturedHeaders!.has('Content-Type')).toBe(false);
    });
  });

  describe('Concurrent 401 handling and token refresh deduplication', () => {
    it('shares a single refresh call when multiple requests receive 401 concurrently', async () => {
      setStoredTokens('expired-access-token', 'valid-refresh-token');

      let refreshCallsCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        const urlStr = String(url);

        // 1. Refresh endpoint
        if (urlStr.includes('/auth/refresh')) {
          refreshCallsCount++;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: 'new-fresh-token',
                refresh_token: 'new-refresh-token',
                token_type: 'bearer',
                user: { id: 'u1', username: 'admin', role: 'ADMIN', is_active: true },
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }

        // 2. Regular API requests: return 401 on first try, 200 with new token on retry
        const authHeader = new Headers(init?.headers).get('Authorization');
        if (authHeader === 'Bearer expired-access-token') {
          return Promise.resolve(
            new Response(JSON.stringify({ detail: 'Token expirado' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        if (authHeader === 'Bearer new-fresh-token') {
          return Promise.resolve(
            new Response(JSON.stringify({ success: true, url: urlStr }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }

        return Promise.resolve(new Response(null, { status: 500 }));
      });

      // Fire 3 simultaneous API calls
      const [res1, res2, res3] = await Promise.all([
        api.get<{ success: boolean }>('/endpoint-1'),
        api.get<{ success: boolean }>('/endpoint-2'),
        api.get<{ success: boolean }>('/endpoint-3'),
      ]);

      expect(res1.success).toBe(true);
      expect(res2.success).toBe(true);
      expect(res3.success).toBe(true);

      // CRITICAL: Must have refreshed exactly once
      expect(refreshCallsCount).toBe(1);
      expect(getStoredToken()).toBe('new-fresh-token');
      expect(getStoredRefreshToken()).toBe('new-refresh-token');
    });
  });

  describe('Session cleanup on expired refresh token', () => {
    it('clears storage and emits auth:unauthorized when refresh fails', async () => {
      setStoredTokens('expired-access', 'invalid-refresh');

      const unauthorizedSpy = vi.fn();
      window.addEventListener('auth:unauthorized', unauthorizedSpy);

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (String(url).includes('/auth/refresh')) {
          return Promise.resolve(new Response(JSON.stringify({ detail: 'Invalid refresh' }), { status: 401 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }));
      });

      await expect(request('/protected')).rejects.toThrow(ApiError);

      expect(getStoredToken()).toBeNull();
      expect(getStoredRefreshToken()).toBeNull();
      expect(unauthorizedSpy).toHaveBeenCalledTimes(1);

      window.removeEventListener('auth:unauthorized', unauthorizedSpy);
    });
  });

  describe('Error translation and ensureFreshToken', () => {
    it('throws ApiError with HTTP status, message and requestId on failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Paciente no encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', [REQUEST_ID_HEADER]: 'REQ-TEST-123' },
        })
      );

      try {
        await api.get('/pacientes/999');
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(404);
        expect(apiError.message).toBe('Paciente no encontrado');
        expect(apiError.requestId).toBe('REQ-TEST-123');
      }
    });

    it('ensureFreshToken returns token if still valid and not near expiration', async () => {
      // Craft a JWT token with future expiration (1 hour from now)
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validPayload = btoa(JSON.stringify({ exp: futureExp }));
      const validJwt = `header.${validPayload}.signature`;
      setStoredTokens(validJwt, 'some-refresh');

      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      const token = await ensureFreshToken(60000);
      expect(token).toBe(validJwt);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
