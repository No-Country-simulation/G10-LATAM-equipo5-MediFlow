import {
  LayoutDashboard,
  FolderOpen,
  UserCheck,
  Users,
} from 'lucide-react';
import type { UserRole } from '../../types/auth';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

export const getNavLinks = (role?: UserRole): NavItem[] => {
  if (!role) return [];

  if (role === 'GESTOR_USUARIOS') {
    return [{ to: '/usuarios', label: 'Usuarios', icon: Users }];
  }

  const items: NavItem[] = [
    { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    {
      to: '/documentos',
      label: role === 'OPERADOR' ? 'Mis Documentos' : 'Expedientes',
      icon: FolderOpen,
    },
  ];

  if (role === 'ADMIN' || role === 'AUDITOR_CLINICO') {
    items.push({ to: '/auditoria', label: 'Auditoría', icon: UserCheck });
  }

  if (role === 'ADMIN') {
    items.push({ to: '/usuarios', label: 'Usuarios', icon: Users });
  }

  return items;
};
