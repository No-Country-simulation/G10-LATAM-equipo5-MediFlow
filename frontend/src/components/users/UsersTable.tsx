import { RefreshCw } from 'lucide-react';
import type { UserResponse } from '../../types/auth';
import { UserTableRow } from './UserTableRow';

interface UsersTableProps {
  users: UserResponse[];
  isLoading: boolean;
  currentUserId?: string;
  updatingUserId: string | null;
  onToggleStatus: (u: UserResponse) => void;
}

export const UsersTable = ({
  users,
  isLoading,
  currentUserId,
  updatingUserId,
  onToggleStatus,
}: UsersTableProps) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Usuario</th>
              <th className="px-5 py-3.5 font-semibold">Nombre Completo</th>
              <th className="px-5 py-3.5 font-semibold">Correo Electrónico</th>
              <th className="px-5 py-3.5 font-semibold">Rol Asignado</th>
              <th className="px-5 py-3.5 font-semibold">Estado / Acción</th>
              <th className="px-5 py-3.5 font-semibold">Fecha Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                  Cargando usuarios autorizados...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                  No se encontraron usuarios registrados en la base de datos
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserTableRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUserId}
                  isUpdating={updatingUserId === u.id}
                  onToggleStatus={onToggleStatus}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
