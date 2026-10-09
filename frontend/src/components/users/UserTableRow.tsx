import { Shield, UserCog, Stethoscope, Headphones } from 'lucide-react';
import type { UserResponse, UserRole } from '../../types/auth';

const ROLE_BADGES: Record<UserRole, { bg: string; text: string; border: string; icon: typeof Shield }> = {
  ADMIN: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    icon: Shield,
  },
  GESTOR_USUARIOS: {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/30',
    icon: UserCog,
  },
  AUDITOR_CLINICO: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    icon: Stethoscope,
  },
  OPERADOR: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    icon: Headphones,
  },
};

interface UserTableRowProps {
  user: UserResponse;
  isSelf: boolean;
  isUpdating: boolean;
  onToggleStatus: (u: UserResponse) => void;
}

export const UserTableRow = ({ user, isSelf, isUpdating, onToggleStatus }: UserTableRowProps) => {
  const roleCfg = ROLE_BADGES[user.role];
  const Icon = roleCfg.icon;

  return (
    <tr className="hover:bg-slate-800/25 transition-colors">
      <td className="px-5 py-3.5 font-mono font-semibold text-white">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-300">
            {user.username.charAt(0).toUpperCase()}
          </span>
          <span>{user.username}</span>
          {isSelf && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Tú
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 font-medium">{user.full_name}</td>
      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">{user.email}</td>
      <td className="px-5 py-3.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}
        >
          <Icon className="w-3 h-3" />
          <span>{user.role}</span>
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isSelf || isUpdating}
            onClick={() => void onToggleStatus(user)}
            title={
              isSelf
                ? 'No puedes desactivar tu propia cuenta'
                : user.is_active
                ? 'Clic para desactivar acceso'
                : 'Clic para reactivar acceso'
            }
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
              user.is_active ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                user.is_active ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span
            className={`text-[11px] font-medium ${
              user.is_active ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {isUpdating ? 'Actualizando...' : user.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
        {new Date(user.created_at).toLocaleDateString('es-CL', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </td>
    </tr>
  );
};
