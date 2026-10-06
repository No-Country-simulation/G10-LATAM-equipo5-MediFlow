import React, { useState } from 'react';
import { X, UserPlus, Lock, Mail, User, Shield, AlertCircle, Loader2 } from 'lucide-react';
import type { UserCreateRequest, UserRole } from '../../types/auth';

interface CreateUserModalProps {
  isOpen: boolean;
  currentUserRole?: UserRole;
  onClose: () => void;
  onSubmit: (payload: UserCreateRequest) => Promise<boolean>;
}

const ROLE_OPTIONS: { role: UserRole; label: string; description: string }[] = [
  { role: 'AUDITOR_CLINICO', label: 'Auditor Clínico', description: 'Revisión HITL y resolución de discrepancias' },
  { role: 'OPERADOR', label: 'Operador de Admisión', description: 'Carga de expedientes y consulta de sus documentos' },
  { role: 'GESTOR_USUARIOS', label: 'Gestor de Usuarios', description: 'Administración del personal del sistema' },
  { role: 'ADMIN', label: 'Administrador General', description: 'Acceso total y configuración de catálogos' },
];

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  currentUserRole,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<UserCreateRequest>({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'AUDITOR_CLINICO',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const allowedRoles = ROLE_OPTIONS.filter((opt) => {
    if (currentUserRole === 'GESTOR_USUARIOS' && opt.role === 'ADMIN') {
      return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (formData.password.length < 8) {
      setLocalError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsSubmitting(true);
    const success = await onSubmit(formData);
    setIsSubmitting(false);

    if (success) {
      setFormData({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'AUDITOR_CLINICO',
      });
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-user-modal-title" className="text-base font-bold text-white">
                Nuevo Usuario
              </h2>
              <p className="text-[11px] text-slate-400">Crear credenciales y asignar rol operativo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {localError && (
          <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Nombre Completo</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Dr. Roberto Soto"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Usuario (Username)</label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="rsoto"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña (min 8)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="rsoto@hospital.org"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Rol en MediFlow</label>
            <div className="relative">
              <Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {allowedRoles.map((r) => (
                  <option key={r.role} value={r.role} className="bg-slate-900 text-white">
                    {r.label} ({r.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>{isSubmitting ? 'Creando...' : 'Crear Usuario'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
