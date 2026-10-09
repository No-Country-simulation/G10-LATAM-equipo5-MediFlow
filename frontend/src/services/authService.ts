import { api, getStoredToken } from './api';
import { FASTAPI_ENDPOINTS } from '@/config/api';
import type {
  LoginRequest,
  PaginatedUsersResponse,
  TokenResponse,
  UserAdminUpdateRequest,
  UserCreateRequest,
  UserOut,
  UserResponse,
} from '../types/auth';

export const authService = {
  getToken: (): string | null => getStoredToken(),

  login: (credentials: LoginRequest): Promise<TokenResponse> => {
    return api.post<TokenResponse>(FASTAPI_ENDPOINTS.auth.login, credentials);
  },

  logout: (): Promise<void> => {
    return api.post<void>(FASTAPI_ENDPOINTS.auth.logout);
  },

  getProfile: (): Promise<UserOut> => {
    return api.get<UserOut>(FASTAPI_ENDPOINTS.auth.me);
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
};



