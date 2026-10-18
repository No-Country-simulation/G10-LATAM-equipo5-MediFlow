import {
  Database,
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

const USERS_NAV_ITEM: NavItem = { to: '/usuarios', label: 'Usuarios', icon: Users };
const CATALOGS_NAV_ITEM: NavItem = { to: '/catalogos', label: 'Catálogos', icon: Database };

export const getNavLinks = (role?: UserRole): NavItem[] => {
  if (!role) return [];

  if (role === 'GESTOR_USUARIOS') {
    return [USERS_NAV_ITEM, CATALOGS_NAV_ITEM];
  }

  const items: NavItem[] = [
    { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    {
      to: '/documentos',
      label: role === 'OPERADOR' ? 'Documentos' : 'Expedientes',
      icon: FolderOpen,
    },
  ];

  if (role === 'ADMIN' || role === 'AUDITOR_CLINICO') {
    items.push({ to: '/auditoria', label: 'Auditoría', icon: UserCheck });
  }

  if (role === 'ADMIN') {
    items.push(USERS_NAV_ITEM, CATALOGS_NAV_ITEM);
  }

  return items;
};
