import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { INPUT_BASE, LABEL } from './formStyles';
import { PASSWORD_MAX_LENGTH } from '../../utils/passwordPolicy';

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Nombre del campo para el botón de mostrar/ocultar (p. ej. "contraseña actual"). */
  fieldName: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: 'current-password' | 'new-password';
}

/** Campo de contraseña con ícono de candado y botón para mostrar u ocultar el valor. */
export const PasswordInput = ({
  id,
  label,
  value,
  onChange,
  fieldName,
  required,
  minLength,
  autoComplete = 'new-password',
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const ToggleIcon = visible ? EyeOff : Eye;

  return (
    <div>
      <label htmlFor={id} className={LABEL}>{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className={`w-full pl-9 pr-10 ${INPUT_BASE}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={`${visible ? 'Ocultar' : 'Ver'} ${fieldName}`}
          className="absolute right-3 top-2.5 cursor-pointer"
        >
          <ToggleIcon className="w-4 h-4 text-slate-400 hover:text-slate-200" />
        </button>
      </div>
    </div>
  );
};
