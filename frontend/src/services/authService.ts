import { api } from './api';
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
  login: (credentials: LoginRequest): Promise<TokenResponse> => {
    return api.post<TokenResponse>('/auth/login', credentials);
  },

  logout: (): Promise<void> => {
    return api.post<void>('/auth/logout');
  },

  getProfile: (): Promise<UserOut> => {
    return api.get<UserOut>('/auth/me');
  },

  getUsers: (page = 1, pageSize = 50): Promise<PaginatedUsersResponse> => {
    return api.get<PaginatedUsersResponse>(`/users?page=${page}&page_size=${pageSize}`);
  },

  createUser: (payload: UserCreateRequest): Promise<UserResponse> => {
    return api.post<UserResponse>('/users', payload);
  },

  updateUser: (userId: string, payload: UserAdminUpdateRequest): Promise<UserResponse> => {
    return api.patch<UserResponse>(`/users/${userId}`, payload);
  },
};



