import { api } from './api';
import type { LoginRequest, TokenResponse, UserOut } from '../types/auth';

export const authService = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    return api.post<TokenResponse>('/auth/login', credentials);
  },

  logout: async (): Promise<void> => {
    try {
      await api.post<void>('/auth/logout');
    } catch {
      // Continúa el logout local si el token ya expiró o fue revocado
    }
  },

  getProfile: async (): Promise<UserOut> => {
    return api.get<UserOut>('/auth/me');
  },
};
