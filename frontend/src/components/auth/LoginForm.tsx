import { useState, type ChangeEvent, type FormEvent } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import type { LoginRequest } from '../../types/auth';

interface LoginFormProps {
  onSubmit: (credentials: LoginRequest) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const INPUT_BASE_CLASSES =
  'w-full pl-9 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

const LoginForm = ({ onSubmit, isLoading, error }: LoginFormProps) => {
  const [formData, setFormData] = useState<LoginRequest>({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="space-y-1">
        <label htmlFor="username" className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
          Usuario
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <User className="w-4 h-4" />
          </div>
          <input
            id="username"
            type="text"
            name="username"
            required
            disabled={isLoading}
            value={formData.username}
            onChange={handleChange}
            autoComplete="username"
            placeholder="Usuario"
            className={`${INPUT_BASE_CLASSES} pr-3`}
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
          Contraseña
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Lock className="w-4 h-4" />
          </div>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            required
            disabled={isLoading}
            value={formData.password}
            onChange={handleChange}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`${INPUT_BASE_CLASSES} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            disabled={isLoading}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="relative pt-1">
        {error && (
          <span
            role="alert"
            className="absolute -top-3 right-0 text-[11px] text-rose-400 font-medium animate-in fade-in duration-150 pointer-events-none"
          >
            {error}
          </span>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          <span>{isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}</span>
        </button>
      </div>
    </form>
  );
};

export default LoginForm;
