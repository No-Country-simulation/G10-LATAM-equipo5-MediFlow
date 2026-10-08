import React, { useState } from 'react';
import { X, UserPlus, Lock, Mail, User, Shield, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import type { UserCreateRequest, UserRole } from '../../types/auth';

interface CreateUserModalProps {
  isOpen: boolean;
  currentUserRole?: UserRole;
  onClose: () => void;
  onSubmit: (payload: UserCreateRequest) => Promise<boolean>;
}

const ROLES: { role: UserRole; label: string }[] = [
  { role: 'AUDITOR_CLINICO', label: 'Auditor Clínico' }, { role: 'OPERADOR', label: 'Operador de Admisión' },
  { role: 'GESTOR_USUARIOS', label: 'Gestor de Usuarios' }, { role: 'ADMIN', label: 'Administrador General' },
];

const INITIAL_FORM: UserCreateRequest = { full_name: '', username: '', email: '', password: '', role: 'AUDITOR_CLINICO' };
const inputBase = 'py-2 bg-slate-950/70 border border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/80 transition-all autofill:bg-slate-900 autofill:text-white [box-shadow:0_0_0_30px_#090d16_inset!important] [-webkit-text-fill-color:#f8fafc!important]';

export const CreateUserModal: React.FC<CreateUserModalProps> = ({ isOpen, currentUserRole, onClose, onSubmit }) => {
  const [formData, setFormData] = useState<UserCreateRequest>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const allowedRoles = ROLES.filter((opt) => !(currentUserRole === 'GESTOR_USUARIOS' && opt.role === 'ADMIN'));

  const handleClose = () => { setFormData(INITIAL_FORM); setShowPassword(false); setLocalError(null); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (formData.password.length < 8) return setLocalError('La contraseña debe tener al menos 8 caracteres');
    setIsSubmitting(true);
    const success = await onSubmit(formData);
    setIsSubmitting(false);
    if (success) { setFormData(INITIAL_FORM); setShowPassword(false); onClose(); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="create-user-modal-title" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-700/60 shadow-2xl backdrop-blur-xl rounded-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"><UserPlus className="w-5 h-5" /></div>
            <div>
              <h2 id="create-user-modal-title" className="text-base font-bold text-white tracking-tight">Nuevo Usuario</h2>
              <p className="text-[11px] text-slate-400">Crear credenciales y asignar rol operativo</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} aria-label="Cerrar modal" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {localError && (
          <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /><span>{localError}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} autoComplete="off" className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nombre Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <input type="text" required autoComplete="off" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Dr. Roberto Soto" className={`w-full pl-9 pr-3 ${inputBase}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Usuario (Username)</label>
              <input type="text" required autoComplete="off" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="rsoto" className={`w-full px-3 ${inputBase}`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña (min 8)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete="new-password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" className={`w-full pl-9 pr-10 ${inputBase}`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'} className="absolute right-3 top-2.5 cursor-pointer">
                  {showPassword ? <EyeOff className="w-4 h-4 text-slate-400 hover:text-slate-200" /> : <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <input type="email" required autoComplete="off" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="rsoto@hospital.org" className={`w-full pl-9 pr-3 ${inputBase}`} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Rol en MediFlow</label>
            <div className="relative">
              <Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })} className={`w-full pl-9 pr-3 cursor-pointer ${inputBase}`}>
                {allowedRoles.map((r) => <option key={r.role} value={r.role} className="bg-slate-900 text-white">{r.label} ({r.role})</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button type="button" onClick={handleClose} disabled={isSubmitting} className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors cursor-pointer">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer">
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}<span>{isSubmitting ? 'Creando...' : 'Crear Usuario'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
