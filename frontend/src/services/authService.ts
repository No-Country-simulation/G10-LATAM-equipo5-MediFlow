import { api, ensureFreshToken, getStoredRefreshToken, getStoredToken } from './api';
import { FASTAPI_ENDPOINTS } from '@/config/api';
import type {
  LoginRequest,
  PaginatedUsersResponse,
  PasswordChangeRequest,
  PasswordResetRequest,
  TokenResponse,
  UserAdminUpdateRequest,
  UserCreateRequest,
  UserOut,
  UserResponse,
} from '../types/auth';
import type { DeleteResponse } from '../types/catalog';

export const authService = {
  getToken: (): string | null => getStoredToken(),

  login: (credentials: LoginRequest): Promise<TokenResponse> => {
    return api.post<TokenResponse>(FASTAPI_ENDPOINTS.auth.login, credentials, { skipAuthRefresh: true });
  },

  logout: async (): Promise<void> => {
    // Se renueva antes (si hace falta) para que el refresh token enviado sea el vigente.
    await ensureFreshToken();
    return api.post<void>(
      FASTAPI_ENDPOINTS.auth.logout,
      { refresh_token: getStoredRefreshToken() },
      { skipAuthRefresh: true },
    );
  },

  getProfile: (): Promise<UserOut> => {
    return api.get<UserOut>(FASTAPI_ENDPOINTS.auth.me);
  },

  changePassword: (payload: PasswordChangeRequest): Promise<void> => {
    return api.post<void>(FASTAPI_ENDPOINTS.users.changePassword, payload);
  },

  resetPassword: (userId: string, payload: PasswordResetRequest): Promise<void> => {
    return api.post<void>(FASTAPI_ENDPOINTS.users.resetPassword(userId), payload);
  },

  getUsers: (page = 1, pageSize = 50): Promise<PaginatedUsersResponse> => {
    return api.get<PaginatedUsersResponse>(`${FASTAPI_ENDPOINTS.users.base}?page=${page}&page_size=${pageSize}`);
  },

  createUser: (payload: UserCreateRequest): Promise<UserResponse> => {
    return api.post<UserResponse>(FASTAPI_ENDPOINTS.users.base, payload);
  },

  updateUser: (userId: string, payload: UserAdminUpdateRequest): Promise<UserResponse> => {
    return api.patch<UserResponse>(FASTAPI_ENDPOINTS.users.detail(userId), payload);
  },

  deleteUser: (userId: string): Promise<DeleteResponse> => {
    return api.delete<DeleteResponse>(FASTAPI_ENDPOINTS.users.detail(userId));
  },
};



