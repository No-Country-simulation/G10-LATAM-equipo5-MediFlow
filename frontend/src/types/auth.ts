export type UserRole = 'ADMIN' | 'GESTOR_USUARIOS' | 'AUDITOR_CLINICO' | 'OPERADOR';

export interface AreaSummary {
  id: string;
  codigo: string;
  nombre: string;
}

export interface QueueSummary {
  id: string;
  codigo: string;
  nombre: string;
  es_asistencial: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserOut {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  area?: AreaSummary | null;
  colas?: QueueSummary[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: UserOut;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  area?: AreaSummary | null;
  colas?: QueueSummary[];
  created_at: string;
}

export interface PaginatedUsersResponse {
  items: UserResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface UserCreateRequest {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  area_id: string;
  cola_ids: string[];
}

export interface UserAdminUpdateRequest {
  full_name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
  area_id?: string;
  cola_ids?: string[];
}

export interface ProfileUpdateRequest {
  full_name?: string;
  email?: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

/** Contraseña que un ADMIN o GESTOR_USUARIOS asigna a otro usuario (sin la actual). */
export interface PasswordResetRequest {
  new_password: string;
}

