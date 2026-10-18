import { Building2, Headphones, Pencil, Shield, Stethoscope, Trash2, UserCog } from 'lucide-react';
import type { UserResponse, UserRole } from '../../types/auth';
import { ActiveToggle } from '../common/ActiveToggle';
import { ICON_BUTTON } from '../common/formStyles';

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
  /** Solo un ADMIN puede eliminar a otro ADMIN (el backend también lo valida). */
  canDelete: boolean;
  isUpdating: boolean;
  onToggleStatus: (u: UserResponse) => void;
  onEdit: (u: UserResponse) => void;
  onDelete: (u: UserResponse) => void;
}

export const UserTableRow = ({ user, canDelete, isUpdating, onToggleStatus, onEdit, onDelete }: UserTableRowProps) => {
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
        {user.area ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-300" title={user.area.codigo}>
            <Building2 className="w-3 h-3 text-slate-500" />
            {user.area.nombre}
          </span>
        ) : (
          <span className="text-[11px] text-amber-400/80 italic">Sin área</span>
        )}
        {user.colas && user.colas.length > 0 && (
          <div className="text-[10px] text-slate-500 mt-0.5" title="Colas que atiende en la Consola de Triaje">
            Triaje: {user.colas.map((c) => c.nombre).join(', ')}
          </div>
        )}
      </td>
      <td className="px-5 py-3.5">
        <ActiveToggle
          isActive={user.is_active}
          isUpdating={isUpdating}
          onToggle={() => onToggleStatus(user)}
        />
      </td>
      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
        {new Date(user.created_at).toLocaleDateString('es-CL', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onEdit(user)}
            title="Editar usuario"
            aria-label={`Editar ${user.username}`}
            className={`${ICON_BUTTON} hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/30`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(user)}
            disabled={!canDelete}
            title={canDelete ? 'Eliminar usuario' : 'Solo un ADMIN puede eliminar a otro ADMIN'}
            aria-label={`Eliminar ${user.username}`}
            className={`${ICON_BUTTON} hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
