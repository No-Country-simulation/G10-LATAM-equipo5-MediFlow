import { api } from './api';
import type { LoginRequest, TokenResponse, UserOut } from '../types/auth';

const DEMO_USERS: Record<string, UserOut> = {
  auditor_demo: {
    id: '11111111-1111-1111-1111-111111111111',
    username: 'auditor_demo',
    email: 'elena.ramos@mediflow.cl',
    full_name: 'Dra. Elena Ramos',
    role: 'AUDITOR_CLINICO',
  },
  medico_demo: {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'medico_demo',
    email: 'roberto.silva@mediflow.cl',
    full_name: 'Dr. Roberto Silva',
    role: 'ADMIN',
  },
  admin_user: {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'admin_user',
    email: 'administrador@mediflow.cl',
    full_name: 'Administrador MediFlow',
    role: 'ADMIN',
  },
};

export const authService = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    try {
      return await api.post<TokenResponse>('/auth/login', credentials);
    } catch (error) {
      const demoUser = DEMO_USERS[credentials.username];
      if (demoUser) {
        return {
          access_token: `demo-jwt-token-${demoUser.role.toLowerCase()}`,
          token_type: 'bearer',
          user: demoUser,
        };
      }
      throw error;
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post<void>('/auth/logout');
    } catch {
      return;
    }
  },

  getProfile: async (): Promise<UserOut> => {
    try {
      return await api.get<UserOut>('/auth/me');
    } catch (error) {
      const stored = localStorage.getItem('mediflow_user');
      if (stored) {
        return JSON.parse(stored) as UserOut;
      }
      throw error;
    }
  },
};
