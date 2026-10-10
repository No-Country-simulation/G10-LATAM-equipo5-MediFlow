import React, { useState } from 'react';
import { Building2, Eye, EyeOff, Loader2, Lock, Mail, Save, Shield, User, UserCog, UserPlus } from 'lucide-react';
import type { UserAdminUpdateRequest, UserCreateRequest, UserResponse, UserRole } from '../../types/auth';
import { useActiveAreas } from '../../hooks/useActiveAreas';
import { ModalShell } from '../common/ModalShell';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_GHOST, BUTTON_PRIMARY, INPUT_BASE, LABEL } from '../common/formStyles';
import { grantableRoles } from './userRoles';

interface UserFormModalProps {
  /** Usuario a editar; sin él, el formulario crea uno nuevo. */
  user?: UserResponse;
  currentUserRole?: UserRole;
  onClose: () => void;
  onCreate: (payload: UserCreateRequest) => Promise<boolean>;
  onUpdate: (userId: string, payload: UserAdminUpdateRequest) => Promise<boolean>;
}

const MIN_PASSWORD_LENGTH = 8;

const initialForm = (user?: UserResponse): UserCreateRequest => ({
  full_name: user?.full_name ?? '',
  username: user?.username ?? '',
  email: user?.email ?? '',
  password: '',
  role: user?.role ?? 'AUDITOR_CLINICO',
  area_id: user?.area?.id ?? '',
});

/**
 * Alta y edición de usuarios. En edición el `username` es de solo lectura y la contraseña no se
 * muestra: la cambia cada usuario desde su perfil.
 */
export const UserFormModal: React.FC<UserFormModalProps> = ({ user, currentUserRole, onClose, onCreate, onUpdate }) => {
  const isEdit = user !== undefined;
  const [formData, setFormData] = useState<UserCreateRequest>(() => initialForm(user));
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { areas, error: areasError } = useActiveAreas(true);

  const setField = <K extends keyof UserCreateRequest>(field: K, value: UserCreateRequest[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const save = (): Promise<boolean> => {
    if (!isEdit) return onCreate(formData);
    const { full_name, email, role, area_id } = formData;
    return onUpdate(user.id, { full_name, email, role, area_id });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!isEdit && formData.password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      return;
    }
    if (!formData.area_id) {
      setLocalError('Selecciona el área a la que pertenece el usuario');
      return;
    }
    setIsSubmitting(true);
    const success = await save();
    setIsSubmitting(false);
    if (success) onClose();
  };

  // Un ADMIN editado por un GESTOR conserva su rol aunque no esté entre los otorgables.
  const roleOptions = grantableRoles(currentUserRole);
  const showsCurrentRole = roleOptions.some((opt) => opt.role === formData.role);

  return (
    <ModalShell
      titleId="user-form-modal-title"
      title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
      subtitle={isEdit ? `Actualizar datos, rol y área de ${user.username}` : 'Crear credenciales y asignar rol operativo'}
      icon={isEdit ? UserCog : UserPlus}
      onClose={onClose}
      closeDisabled={isSubmitting}
    >
      <div className="mt-4 space-y-2 empty:hidden">
        <StatusBanner tone="error" message={localError} />
        <StatusBanner tone="error" message={areasError} />
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} autoComplete="off" className="mt-4 space-y-3.5">
        <div>
          <label htmlFor="user-full-name" className={LABEL}>Nombre Completo</label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <input id="user-full-name" type="text" required maxLength={150} autoComplete="off" value={formData.full_name} onChange={(e) => setField('full_name', e.target.value)} placeholder="Dr. Roberto Soto" className={`w-full pl-9 pr-3 ${INPUT_BASE}`} />
          </div>
        </div>

        <div className={isEdit ? '' : 'grid grid-cols-2 gap-3'}>
          <div>
            <label htmlFor="user-username" className={LABEL}>Usuario (Username)</label>
            <input id="user-username" type="text" required disabled={isEdit} minLength={3} maxLength={50} pattern="[A-Za-z0-9_.\-]+" title="Letras, números, punto, guion y guion bajo" autoComplete="off" value={formData.username} onChange={(e) => setField('username', e.target.value)} placeholder="rsoto" className={`w-full px-3 ${INPUT_BASE}`} />
          </div>
          {!isEdit && (
            <div>
              <label htmlFor="user-password" className={LABEL}>Contraseña (min {MIN_PASSWORD_LENGTH})</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input id="user-password" type={showPassword ? 'text' : 'password'} required minLength={MIN_PASSWORD_LENGTH} maxLength={72} autoComplete="new-password" value={formData.password} onChange={(e) => setField('password', e.target.value)} placeholder="••••••••" className={`w-full pl-9 pr-10 ${INPUT_BASE}`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'} className="absolute right-3 top-2.5 cursor-pointer">
                  {showPassword ? <EyeOff className="w-4 h-4 text-slate-400 hover:text-slate-200" /> : <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="user-email" className={LABEL}>Correo Electrónico</label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <input id="user-email" type="email" required maxLength={100} autoComplete="off" value={formData.email} onChange={(e) => setField('email', e.target.value)} placeholder="rsoto@hospital.org" className={`w-full pl-9 pr-3 ${INPUT_BASE}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="user-role" className={LABEL}>Rol en MediFlow</label>
            <div className="relative">
              <Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <select id="user-role" value={formData.role} onChange={(e) => setField('role', e.target.value as UserRole)} className={`w-full pl-9 pr-3 cursor-pointer ${INPUT_BASE}`}>
                {!showsCurrentRole && <option value={formData.role} className="bg-slate-900 text-white">{formData.role}</option>}
                {roleOptions.map((r) => <option key={r.role} value={r.role} className="bg-slate-900 text-white">{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="user-area" className={LABEL}>Área</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
              <select id="user-area" required value={formData.area_id} onChange={(e) => setField('area_id', e.target.value)} className={`w-full pl-9 pr-3 cursor-pointer ${INPUT_BASE}`}>
                <option value="" disabled className="bg-slate-900 text-slate-500">Seleccionar área...</option>
                {areas.map((a) => <option key={a.id} value={a.id} className="bg-slate-900 text-white">{a.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={BUTTON_GHOST}>Cancelar</button>
          <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {!isSubmitting && (isEdit ? <Save className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />)}
            <span>{isEdit ? 'Guardar Cambios' : 'Crear Usuario'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
