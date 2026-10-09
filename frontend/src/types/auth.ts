export type UserRole = 'ADMIN' | 'GESTOR_USUARIOS' | 'AUDITOR_CLINICO' | 'OPERADOR';

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
}

export interface TokenResponse {
  access_token: string;
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
}

export interface UserAdminUpdateRequest {
  full_name?: string;
  email?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface ProfileUpdateRequest {
  full_name?: string;
  email?: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

