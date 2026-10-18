import type { UserRole } from '../../types/auth';

export const ROLE_OPTIONS: { role: UserRole; label: string }[] = [
  { role: 'AUDITOR_CLINICO', label: 'Auditor Clínico' },
  { role: 'OPERADOR', label: 'Operador de Admisión' },
  { role: 'GESTOR_USUARIOS', label: 'Gestor de Usuarios' },
  { role: 'ADMIN', label: 'Administrador General' },
];

export const roleLabel = (role: UserRole): string =>
  ROLE_OPTIONS.find((opt) => opt.role === role)?.label ?? role;

/** Un GESTOR_USUARIOS no puede otorgar el rol ADMIN (el backend también lo valida). */
export const grantableRoles = (currentUserRole?: UserRole) =>
  ROLE_OPTIONS.filter((opt) => !(currentUserRole === 'GESTOR_USUARIOS' && opt.role === 'ADMIN'));
