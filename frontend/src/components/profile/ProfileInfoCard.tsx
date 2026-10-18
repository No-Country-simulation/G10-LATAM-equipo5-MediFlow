import type { ReactNode } from 'react';
import { AtSign, Building2, Mail, Route, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { UserOut } from '../../types/auth';
import { roleLabel } from '../users/userRoles';

interface InfoRowProps {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}

const InfoRow = ({ icon: Icon, label, children }: InfoRowProps) => (
  <div className="flex items-start gap-3 py-3">
    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" />
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</dt>
      <dd className="text-xs text-slate-200 mt-0.5 break-words">{children}</dd>
    </div>
  </div>
);

/** Datos de la cuenta del usuario conectado (solo lectura: los edita un ADMIN o GESTOR_USUARIOS). */
export const ProfileInfoCard = ({ user }: { user: UserOut }) => (
  <section aria-labelledby="profile-info-title" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
    <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
      <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-lg">
        {user.full_name.charAt(0).toUpperCase() || 'U'}
      </div>
      <div className="min-w-0">
        <h2 id="profile-info-title" className="text-sm font-semibold text-white truncate">{user.full_name}</h2>
        <p className="text-[11px] text-slate-400">{roleLabel(user.role)}</p>
      </div>
    </div>

    <dl className="divide-y divide-slate-800/60">
      <InfoRow icon={AtSign} label="Usuario">
        <span className="font-mono">{user.username}</span>
      </InfoRow>
      <InfoRow icon={Mail} label="Correo electrónico">{user.email}</InfoRow>
      <InfoRow icon={ShieldCheck} label="Rol">
        {roleLabel(user.role)} <span className="font-mono text-[10px] text-slate-500">({user.role})</span>
      </InfoRow>
      <InfoRow icon={Building2} label="Área">
        {user.area?.nombre ?? <span className="italic text-amber-400/80">Sin área asignada</span>}
      </InfoRow>
      {user.colas && user.colas.length > 0 && (
        <InfoRow icon={Route} label="Colas de triaje">
          {user.colas.map((c) => c.nombre).join(', ')}
        </InfoRow>
      )}
    </dl>

    <p className="mt-3 text-[10px] text-slate-500">
      Para modificar estos datos contacta a un administrador o gestor de usuarios.
    </p>
  </section>
);
