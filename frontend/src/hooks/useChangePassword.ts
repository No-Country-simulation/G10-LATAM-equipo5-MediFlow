import { useState } from 'react';
import { authService } from '../services/authService';
import { useActionFeedback } from './useActionFeedback';
import { errorMessage } from '../utils/errors';
import { PASSWORD_MIN_LENGTH } from '../utils/passwordPolicy';

export interface PasswordChangeForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

const EMPTY_FORM: PasswordChangeForm = { current_password: '', new_password: '', confirm_password: '' };

/** Primer error del formulario o `null` si es válido (el backend vuelve a validar el largo y la actual). */
export const validatePasswordChange = (form: PasswordChangeForm): string | null => {
  if (!form.current_password) return 'Ingresa tu contraseña actual';
  if (form.new_password.length < PASSWORD_MIN_LENGTH) {
    return `La nueva contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`;
  }
  if (form.new_password === form.current_password) return 'La nueva contraseña debe ser distinta de la actual';
  if (form.new_password !== form.confirm_password) return 'Las contraseñas nuevas no coinciden';
  return null;
};

/** Estado y envío del cambio de la contraseña propia (requiere la actual). */
export const useChangePassword = () => {
  const [form, setForm] = useState<PasswordChangeForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { error, setError, successMessage, setSuccessMessage, reset } = useActionFeedback();

  const setField = (field: keyof PasswordChangeForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async () => {
    reset();
    const validationError = validatePasswordChange(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.changePassword({ current_password: form.current_password, new_password: form.new_password });
      setForm(EMPTY_FORM);
      setSuccessMessage('Contraseña actualizada correctamente');
    } catch (err) {
      setError(errorMessage(err, 'Error al cambiar la contraseña'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { form, setField, isSubmitting, error, successMessage, submit, dismissMessages: reset };
};
