import type { FormEvent } from 'react';
import { KeyRound, Loader2, Save } from 'lucide-react';
import { useChangePassword } from '../../hooks/useChangePassword';
import { PasswordInput } from '../common/PasswordInput';
import { StatusBanner } from '../common/StatusBanner';
import { BUTTON_PRIMARY, HINT } from '../common/formStyles';
import { PASSWORD_MIN_LENGTH } from '../../utils/passwordPolicy';

/** Cambio de la contraseña propia: exige la actual y confirmar la nueva. */
export const ChangePasswordForm = () => {
  const { form, setField, isSubmitting, error, successMessage, submit, dismissMessages } = useChangePassword();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  return (
    <section aria-labelledby="change-password-title" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm">
      <h2 id="change-password-title" className="flex items-center gap-2 text-sm font-semibold text-white pb-4 border-b border-slate-800">
        <KeyRound className="w-4 h-4 text-rose-400" />
        Cambiar Contraseña
      </h2>

      <div className="mt-4 space-y-2 empty:hidden">
        <StatusBanner tone="error" message={error} onDismiss={dismissMessages} />
        <StatusBanner tone="success" message={successMessage} onDismiss={dismissMessages} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
        <PasswordInput
          id="profile-current-password"
          label="Contraseña Actual"
          value={form.current_password}
          onChange={(v) => setField('current_password', v)}
          fieldName="contraseña actual"
          autoComplete="current-password"
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PasswordInput
            id="profile-new-password"
            label={`Nueva Contraseña (min ${PASSWORD_MIN_LENGTH})`}
            value={form.new_password}
            onChange={(v) => setField('new_password', v)}
            fieldName="nueva contraseña"
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
          <PasswordInput
            id="profile-confirm-password"
            label="Confirmar Nueva Contraseña"
            value={form.confirm_password}
            onChange={(v) => setField('confirm_password', v)}
            fieldName="confirmación de contraseña"
            minLength={PASSWORD_MIN_LENGTH}
            required
          />
        </div>
        <p className={HINT}>Tu sesión actual seguirá activa después del cambio.</p>

        <div className="flex justify-end pt-3 border-t border-slate-800/80">
          <button type="submit" disabled={isSubmitting} className={BUTTON_PRIMARY}>
            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Actualizar Contraseña</span>
          </button>
        </div>
      </form>
    </section>
  );
};
