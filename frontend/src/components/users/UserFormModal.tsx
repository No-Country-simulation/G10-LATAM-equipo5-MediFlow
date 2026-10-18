import React, { useState } from 'react';
import { Building2, Loader2, Mail, Route, Save, Shield, User, UserCog, UserPlus } from 'lucide-react';
import type { UserAdminUpdateRequest, UserCreateRequest, UserResponse, UserRole } from '../../types/auth';
import { useActiveAreas } from '../../hooks/useActiveAreas';
import { useQueuesSummary } from '../../hooks/useQueuesSummary';
import { ModalShell } from '../common/ModalShell';
import { PasswordInput } from '../common/PasswordInput';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_GHOST, BUTTON_PRIMARY, HINT, INPUT_BASE, LABEL } from '../common/formStyles';
import { grantableRoles } from './userRoles';
import { PASSWORD_MIN_LENGTH } from '../../utils/passwordPolicy';

interface UserFormModalProps {
  user?: UserResponse; currentUserRole?: UserRole; onClose: () => void;
  onCreate: (p: UserCreateRequest) => Promise<boolean>; onUpdate: (id: string, p: UserAdminUpdateRequest) => Promise<boolean>;
  /** Restablece la contraseña de `user` tras guardar sus datos; solo se llama si se ingresó una nueva. */
  onResetPassword: (u: UserResponse, newPassword: string) => Promise<boolean>;
}

const ROLES_CON_COLAS: UserRole[] = ['OPERADOR', 'AUDITOR_CLINICO'];
const initForm = (u?: UserResponse): UserCreateRequest => ({
  full_name: u?.full_name ?? '', username: u?.username ?? '', email: u?.email ?? '', password: '',
  role: u?.role ?? 'AUDITOR_CLINICO', area_id: u?.area?.id ?? '', cola_ids: u?.colas?.map((c) => c.id) ?? [],
});

/** En edición la contraseña es opcional: vacía significa "no restablecer". */
const validate = (f: UserCreateRequest, isEdit: boolean): string | null => {
  if ((!isEdit || f.password) && f.password.length < PASSWORD_MIN_LENGTH) return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  if (!f.area_id) return 'Selecciona el área a la que pertenece el usuario';
  return null;
};

export const UserFormModal: React.FC<UserFormModalProps> = ({ user, currentUserRole, onClose, onCreate, onUpdate, onResetPassword }) => {
  const isEdit = user !== undefined;
  const [formData, setFormData] = useState(() => initForm(user));
  const [isSubmitting, setIsSubmitting] = useState(false), [localError, setLocalError] = useState<string | null>(null);
  const { areas, error: areasError } = useActiveAreas(true), { queues, error: queuesError } = useQueuesSummary(true);
  const colas = queues.filter((q) => q.es_asistencial), usaColas = ROLES_CON_COLAS.includes(formData.role);
  const setField = <K extends keyof UserCreateRequest>(k: K, v: UserCreateRequest[K]) => setFormData((p) => ({ ...p, [k]: v }));
  const toggleCola = (id: string) => setFormData((p) => ({ ...p, cola_ids: p.cola_ids.includes(id) ? p.cola_ids.filter((c) => c !== id) : [...p.cola_ids, id] }));

  const save = async (): Promise<boolean> => {
    const cola_ids = usaColas ? formData.cola_ids : [];
    if (!isEdit) return onCreate({ ...formData, cola_ids });
    const ok = await onUpdate(user.id, { full_name: formData.full_name, email: formData.email, role: formData.role, area_id: formData.area_id, cola_ids });
    if (!ok || !formData.password) return ok;
    return onResetPassword(user, formData.password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate(formData, isEdit);
    setLocalError(validationError);
    if (validationError) return;
    setIsSubmitting(true);
    const ok = await save();
    setIsSubmitting(false);
    if (ok) onClose();
  };

  const roleOptions = grantableRoles(currentUserRole), showsCurrentRole = roleOptions.some((o) => o.role === formData.role);
  const SubmitIcon = isEdit ? Save : UserPlus;

  return (
    <ModalShell titleId="user-form-modal-title" title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'} subtitle={isEdit ? `Actualizar datos, rol y área de ${user.username}` : 'Crear credenciales y asignar rol operativo'} icon={isEdit ? UserCog : UserPlus} onClose={onClose} closeDisabled={isSubmitting}>
      <div className="mt-4 space-y-2 empty:hidden"><StatusBanner tone="error" message={localError} /><StatusBanner tone="error" message={areasError} /><StatusBanner tone="error" message={queuesError} /></div>
      <form onSubmit={(e) => void handleSubmit(e)} autoComplete="off" className="mt-4 space-y-3.5">
        <div><label htmlFor="user-full-name" className={LABEL}>Nombre Completo</label><div className="relative"><User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" /><input id="user-full-name" type="text" required maxLength={150} autoComplete="off" value={formData.full_name} onChange={(e) => setField('full_name', e.target.value)} placeholder="Dr. Roberto Soto" className={`w-full pl-9 pr-3 ${INPUT_BASE}`} /></div></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="user-username" className={LABEL}>Usuario (Username)</label><input id="user-username" type="text" required disabled={isEdit} minLength={3} maxLength={50} pattern="[A-Za-z0-9_.\-]+" title="Letras, números, punto, guion y guion bajo" autoComplete="off" value={formData.username} onChange={(e) => setField('username', e.target.value)} placeholder="rsoto" className={`w-full px-3 ${INPUT_BASE}`} /></div>
          <PasswordInput id="user-password" label={isEdit ? 'Nueva Contraseña (opcional)' : `Contraseña (min ${PASSWORD_MIN_LENGTH})`} value={formData.password} onChange={(v) => setField('password', v)} required={!isEdit} minLength={PASSWORD_MIN_LENGTH} fieldName="contraseña" />
        </div>
        {isEdit && <p className={`${HINT} -mt-2`}>Déjala vacía para mantener la actual; si la ingresas, se restablece la contraseña de {user.username}.</p>}
        <div><label htmlFor="user-email" className={LABEL}>Correo Electrónico</label><div className="relative"><Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" /><input id="user-email" type="email" required maxLength={100} autoComplete="off" value={formData.email} onChange={(e) => setField('email', e.target.value)} placeholder="rsoto@hospital.org" className={`w-full pl-9 pr-3 ${INPUT_BASE}`} /></div></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label htmlFor="user-role" className={LABEL}>Rol en MediFlow</label><div className="relative"><Shield className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" /><select id="user-role" value={formData.role} onChange={(e) => setField('role', e.target.value as UserRole)} className={`w-full pl-9 pr-3 cursor-pointer ${INPUT_BASE}`}>{!showsCurrentRole && <option value={formData.role} className="bg-slate-900 text-white">{formData.role}</option>}{roleOptions.map((r) => <option key={r.role} value={r.role} className="bg-slate-900 text-white">{r.label}</option>)}</select></div></div>
          <div><label htmlFor="user-area" className={LABEL}>Área</label><div className="relative"><Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" /><select id="user-area" required value={formData.area_id} onChange={(e) => setField('area_id', e.target.value)} className={`w-full pl-9 pr-3 cursor-pointer ${INPUT_BASE}`}><option value="" disabled className="bg-slate-900 text-slate-500">Seleccionar área...</option>{areas.map((a) => <option key={a.id} value={a.id} className="bg-slate-900 text-white">{a.nombre}</option>)}</select></div></div>
        </div>
        {usaColas && (
          <fieldset>
            <legend className={`${LABEL} flex items-center gap-1.5`}><Route className="w-3.5 h-3.5 text-slate-500" />Colas que atiende en Triaje</legend>
            {colas.length === 0 ? <p className={HINT}>No hay colas asistenciales activas. Márcalas en Catálogos → Colas.</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{colas.map((q) => (<label key={q.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-slate-800 bg-slate-950/50 text-xs text-slate-300 cursor-pointer hover:border-slate-700"><input type="checkbox" checked={formData.cola_ids.includes(q.id)} onChange={() => toggleCola(q.id)} className="accent-indigo-500" />{q.nombre}</label>))}</div>
            )}
            <p className={HINT}>Solo verá en la Consola de Triaje los casos de estas colas.</p>
          </fieldset>
        )}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={BUTTON_GHOST}>Cancelar</button>
          <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SubmitIcon className="w-3.5 h-3.5" />}
            <span>{isEdit ? 'Guardar Cambios' : 'Crear Usuario'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
