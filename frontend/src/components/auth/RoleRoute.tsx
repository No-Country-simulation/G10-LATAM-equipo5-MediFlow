import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/auth';
import { canAccessRoute, getHomeRoute } from '../../utils/permissions';

interface RoleRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

export const RoleRoute = ({ children, allowedRoles, fallbackPath }: RoleRouteProps) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // GESTOR_USUARIOS never has access to clinical/document routes
  if (user.role === 'GESTOR_USUARIOS' && !allowedRoles.includes('GESTOR_USUARIOS')) {
    return <Navigate to="/usuarios" replace />;
  }

  if (!canAccessRoute(user.role, allowedRoles)) {
    const destination = fallbackPath ?? getHomeRoute(user.role);
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};

