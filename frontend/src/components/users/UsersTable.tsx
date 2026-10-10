import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import type { UserResponse, UserRole } from '../../types/auth';
import { UserTableRow } from './UserTableRow';

interface UsersTableProps {
  users: UserResponse[];
  isLoading: boolean;
  currentUserId?: string;
  currentUserRole?: UserRole;
  updatingUserId: string | null;
  onToggleStatus: (u: UserResponse) => void;
  onEdit: (u: UserResponse) => void;
  onDelete: (u: UserResponse) => void;
}

const COLUMNS = ['Usuario', 'Nombre Completo', 'Correo Electrónico', 'Rol Asignado', 'Área', 'Estado / Acción', 'Fecha Registro'];

const MessageRow = ({ children }: { children: ReactNode }) => (
  <tr>
    <td colSpan={COLUMNS.length + 1} className="px-5 py-12 text-center text-slate-400">
      {children}
    </td>
  </tr>
);

export const UsersTable = ({
  users,
  isLoading,
  currentUserId,
  currentUserRole,
  updatingUserId,
  onToggleStatus,
  onEdit,
  onDelete,
}: UsersTableProps) => {
  const renderBody = () => {
    if (isLoading) {
      return (
        <MessageRow>
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
          Cargando usuarios autorizados...
        </MessageRow>
      );
    }
    if (users.length === 0) {
      return <MessageRow>No se encontraron usuarios registrados en la base de datos</MessageRow>;
    }
    return users.map((u) => (
      <UserTableRow
        key={u.id}
        user={u}
        isSelf={u.id === currentUserId}
        canDelete={u.role !== 'ADMIN' || currentUserRole === 'ADMIN'}
        isUpdating={updatingUserId === u.id}
        onToggleStatus={onToggleStatus}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ));
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              {COLUMNS.map((column) => (
                <th key={column} className="px-5 py-3.5 font-semibold">{column}</th>
              ))}
              <th className="px-5 py-3.5 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">{renderBody()}</tbody>
        </table>
      </div>
    </div>
  );
};
