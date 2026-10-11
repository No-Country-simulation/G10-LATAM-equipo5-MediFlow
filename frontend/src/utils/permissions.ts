import type { UserRole } from '../types/auth';

export const DOCUMENT_ACCESS_ROLES: UserRole[] = ['ADMIN', 'AUDITOR_CLINICO', 'OPERADOR'];
export const INGEST_ACCESS_ROLES: UserRole[] = ['ADMIN', 'AUDITOR_CLINICO', 'OPERADOR'];
export const AUDIT_ACCESS_ROLES: UserRole[] = ['ADMIN', 'AUDITOR_CLINICO'];
/** Quiénes pueden corregir un documento ya procesado o auditado (PUT /documents/{id}). */
export const DOCUMENT_CORRECTION_ROLES: UserRole[] = ['ADMIN', 'AUDITOR_CLINICO'];
/** Estados en que un documento se puede corregir; los pendientes se corrigen en auditoría. */
export const ESTADOS_CORREGIBLES = ['PROCESADO', 'AUDITADO'] as const;
export const USER_MANAGEMENT_ROLES: UserRole[] = ['ADMIN', 'GESTOR_USUARIOS'];
// GESTOR_USUARIOS solo ve la pestaña de Áreas (ver catalogConfig).
export const CATALOG_MANAGEMENT_ROLES: UserRole[] = ['ADMIN', 'GESTOR_USUARIOS'];

export const canAccessRoute = (
  userRole: UserRole | undefined,
  allowedRoles: UserRole[]
): boolean => {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};

export const getHomeRoute = (userRole?: UserRole): string =>
  userRole === 'GESTOR_USUARIOS' ? '/usuarios' : '/dashboard';
