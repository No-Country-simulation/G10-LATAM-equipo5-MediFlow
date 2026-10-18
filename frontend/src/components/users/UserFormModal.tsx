import React, { useState } from 'react';
import { Building2, Eye, EyeOff, Loader2, Lock, Mail, Route, Save, Shield, User, UserCog, UserPlus } from 'lucide-react';
import type { PasswordChangeRequest, UserAdminUpdateRequest, UserCreateRequest, UserResponse, UserRole } from '../../types/auth';
import { authService } from '../../services/authService';
import { useActiveAreas } from '../../hooks/useActiveAreas';
import { useQueuesSummary } from '../../hooks/useQueuesSummary';
import { ModalShell } from '../common/ModalShell';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_GHOST, BUTTON_PRIMARY, HINT, INPUT_BASE, LABEL } from '../common/formStyles';
import { grantableRoles } from './userRoles';
import { errorMessage } from '../../utils/errors';

interface UserFormModalProps {
  user?: UserResponse; currentUserRole?: UserRole; currentUserId?: string; onClose: () => void;
  onCreate: (p: UserCreateRequest) => Promise<boolean>; onUpdate: (id: string, p: UserAdminUpdateRequest) => Promise<boolean>;
  onChangePassword?: (p: PasswordChangeRequest) => Promise<void | boolean>;
}

const MIN_PASS = 8, ROLES_CON_COLAS: UserRole[] = ['OPERADOR', 'AUDITOR_CLINICO'];
const initForm = (u?: UserResponse): UserCreateRequest => ({
  full_name: u?.full_name ?? '', username: u?.username ?? '', email: u?.email ?? '', password: '',
  role: u?.role ?? 'AUDITOR_CLINICO', area_id: u?.area?.id ?? '', cola_ids: u?.colas?.map((c) => c.id) ?? [],
});

const PassInput = ({ id, label, val, onChange, req, min, auto, lbl }: {
  id: string; label: string; val: string; onChange: (v: string) => void; req?: boolean; min?: number; auto?: string; lbl: string;
}) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative"><Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
        <input id={id} type={show ? 'text' : 'password'} required={req} minLength={min} maxLength={72} autoComplete={auto} value={val} onChange={(e) => onChange(e.target.value)} placeholder="••••••••" className={`w-full pl-9 pr-10 ${INPUT_BASE}`} />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? `Ocultar ${lbl}` : `Ver ${lbl}`} className="absolute right-3 top-2.5 cursor-pointer">{show ? <EyeOff className="w-4 h-4 text-slate-400 hover:text-slate-200" /> : <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" />}</button>
      </div>
    </div>
  );
};

export const UserFormModal: React.FC<UserFormModalProps> = ({ user, currentUserRole, currentUserId, onClose, onCreate, onUpdate, onChangePassword }) => {
  const isEdit = user !== undefined, isSelf = Boolean(currentUserId && user && user.id === currentUserId);
  const [formData, setFormData] = useState(() => initForm(user));
  const [passData, setPassData] = useState<PasswordChangeRequest>({ current_password: '', new_password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false), [localError, setLocalError] = useState<string | null>(null);
  const { areas, error: areasError } = useActiveAreas(true), { queues, error: queuesError } = useQueuesSummary(true);
  const colas = queues.filter((q) => q.es_asistencial), usaColas = ROLES_CON_COLAS.includes(formData.role);
  const setField = <K extends keyof UserCreateRequest>(k: K, v: UserCreateRequest[K]) => setFormData((p) => ({ ...p, [k]: v }));
  const toggleCola = (id: string) => setFormData((p) => ({ ...p, cola_ids: p.cola_ids.includes(id) ? p.cola_ids.filter((c) => c !== id) : [...p.cola_ids, id] }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLocalError(null);
    if (!isEdit && formData.password.length < MIN_PASS) return setLocalError(`La contraseña debe tener al menos ${MIN_PASS} caracteres`);
    if (isSelf && (passData.current_password || passData.new_password)) {
      if (!passData.current_password) return setLocalError('Debes ingresar tu contraseña actual para cambiarla');
      if (passData.new_password.length < MIN_PASS) return setLocalError(`La nueva contraseña debe tener al menos ${MIN_PASS} caracteres`);
    }
    if (!formData.area_id) return setLocalError('Selecciona el área a la que pertenece el usuario');
    setIsSubmitting(true);
    const cola_ids = usaColas ? formData.cola_ids : [];
    const ok = isEdit ? await onUpdate(user.id, { full_name: formData.full_name, email: formData.email, role: formData.role, area_id: formData.area_id, cola_ids }) : await onCreate({ ...formData, cola_ids });
    if (!ok) return setIsSubmitting(false);
    if (isSelf && (passData.current_password || passData.new_password)) {
      try {
        const passOk = onChangePassword ? await onChangePassword(passData) : (await authService.changePassword(passData), true);
        if (passOk === false) return setIsSubmitting(false);
      } catch (err) { setIsSubmitting(false); return setLocalError(errorMessage(err, 'Error al cambiar la contraseña')); }
    }
    setIsSubmitting(false); onClose();
  };

  const roleOptions = grantableRoles(currentUserRole), showsCurrentRole = roleOptions.some((o) => o.role === formData.role);

  return (
    <ModalShell titleId="user-form-modal-title" title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'} subtitle={isEdit ? `Actualizar datos, rol y área de ${user.username}` : 'Crear credenciales y asignar rol operativo'} icon={isEdit ? UserCog : UserPlus} onClose={onClose} closeDisabled={isSubmitting}>
      <div className="mt-4 space-y-2 empty:hidden"><StatusBanner tone="error" message={localError} /><StatusBanner tone="error" message={areasError} /><StatusBanner tone="error" message={queuesError} /></div>
      <form onSubmit={(e) => void handleSubmit(e)} autoComplete="off" className="mt-4 space-y-3.5">
        <div><label htmlFor="user-full-name" className={LABEL}>Nombre Completo</label><div className="relative"><User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" /><input id="user-full-name" type="text" required maxLength={150} autoComplete="off" value={formData.full_name} onChange={(e) => setField('full_name', e.target.value)} placeholder="Dr. Roberto Soto" className={`w-full pl-9 pr-3 ${INPUT_BASE}`} /></div></div>
        <div className={isEdit ? '' : 'grid grid-cols-2 gap-3'}>
          <div><label htmlFor="user-username" className={LABEL}>Usuario (Username)</label><input id="user-username" type="text" required disabled={isEdit} minLength={3} maxLength={50} pattern="[A-Za-z0-9_.\-]+" title="Letras, números, punto, guion y guion bajo" autoComplete="off" value={formData.username} onChange={(e) => setField('username', e.target.value)} placeholder="rsoto" className={`w-full px-3 ${INPUT_BASE}`} /></div>
          {!isEdit && <PassInput id="user-password" label={`Contraseña (min ${MIN_PASS})`} val={formData.password} onChange={(v) => setField('password', v)} req min={MIN_PASS} auto="new-password" lbl="contraseña" />}
        </div>
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
        {isSelf && (
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-rose-400" /><span className="text-xs font-semibold text-slate-200">Cambiar Contraseña Personal</span><span className="text-[10px] text-slate-400 font-mono">(opcional)</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PassInput id="user-current-password" label="Contraseña Actual" val={passData.current_password} onChange={(v) => setPassData((p) => ({ ...p, current_password: v }))} auto="current-password" lbl="contraseña actual" />
              <PassInput id="user-new-password" label={`Nueva Contraseña (min ${MIN_PASS})`} val={passData.new_password} onChange={(v) => setPassData((p) => ({ ...p, new_password: v }))} min={MIN_PASS} auto="new-password" lbl="nueva contraseña" />
            </div>
          </div>
        )}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button type="button" onClick={onClose} disabled={isSubmitting} className={BUTTON_GHOST}>Cancelar</button>
          <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (isEdit ? <Save className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />)}
            <span>{isEdit ? 'Guardar Cambios' : 'Crear Usuario'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
};
