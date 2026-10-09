import type { UserRole } from '../types/auth';

export const DOCUMENT_ACCESS_ROLES: UserRole[] = ['ADMIN', 'AUDITOR_CLINICO', 'OPERADOR'];
export const INGEST_ACCESS_ROLES: UserRole[] = ['ADMIN', 'AUDITOR_CLINICO', 'OPERADOR'];
export const AUDIT_ACCESS_ROLES: UserRole[] = ['ADMIN', 'AUDITOR_CLINICO'];
export const USER_MANAGEMENT_ROLES: UserRole[] = ['ADMIN', 'GESTOR_USUARIOS'];

export const canAccessRoute = (
  userRole: UserRole | undefined,
  allowedRoles: UserRole[]
): boolean => {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};

export const getHomeRoute = (userRole?: UserRole): string =>
  userRole === 'GESTOR_USUARIOS' ? '/usuarios' : '/dashboard';
