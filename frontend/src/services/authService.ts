import { api } from './api';
import type { LoginRequest, TokenResponse, UserOut } from '../types/auth';

export const authService = {
  login: (credentials: LoginRequest): Promise<TokenResponse> => {
    return api.post<TokenResponse>('/auth/login', credentials);
  },

  logout: (): Promise<void> => {
    return api.post<void>('/auth/logout');
  },

  getProfile: (): Promise<UserOut> => {
    return api.get<UserOut>('/auth/me');
  },
};

