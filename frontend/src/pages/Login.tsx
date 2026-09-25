import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Shield } from 'lucide-react';
import LoginForm from '../components/auth/LoginForm';
import DemoAccounts from '../components/auth/DemoAccounts';
import { useAuth } from '../hooks/useAuth';
import type { LoginRequest } from '../types/auth';

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (credentials: LoginRequest) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(credentials);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al procesar el acceso clínico';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectDemo = (username: string, password: string) => {
    handleLogin({ username, password });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden select-none">
      <div className="w-full max-w-md z-10 bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold tracking-wide">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>AGENTE AUTÓNOMO CLÍNICO</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Medi</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-rose-400">Flow</span>
          </h1>

          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Extracción inteligente, triaje y enrutamiento automatizado de documentos de salud
          </p>
        </div>

        <LoginForm
          onSubmit={handleLogin}
          isLoading={isSubmitting}
          error={error}
        />

        <DemoAccounts
          onSelectDemo={handleSelectDemo}
          disabled={isSubmitting}
        />

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>Cumplimiento HIPAA / Encriptación AES-256</span>
        </div>
      </div>
    </main>
  );
};

export default Login;
