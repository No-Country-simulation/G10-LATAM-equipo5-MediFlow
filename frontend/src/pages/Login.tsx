import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import HospitalDoorsTransition from '../components/auth/HospitalDoorsTransition';
import ContinuousEcg from '../components/common/ContinuousEcg';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../services/api';
import type { LoginRequest } from '../types/auth';

const getAuthErrorMessage = (err: unknown): string => {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Credenciales incorrectas';
    if (err.status === 0 || err.status === 408) return 'Error de conexión';
    if (err.status >= 500) return 'Error del servidor clínico';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Error al procesar el acceso clínico';
};

const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDoors, setShowDoors] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !showDoors) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, showDoors, navigate]);

  const handleLogin = async (credentials: LoginRequest) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(credentials);
      setShowDoors(true);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  const handleDoorsComplete = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-slate-950 flex flex-col items-center justify-end select-none">
      <img
        src="/assets/hospital-lobby2.webp"
        alt="Lobby de Recepción Hospitalaria"
        className={`absolute inset-0 w-full h-full object-cover object-bottom -z-20 transition-opacity duration-[400ms] ${showDoors ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
      />

      <div
        className={`absolute inset-0 bg-slate-950/30 backdrop-blur-[0.5px] pointer-events-none -z-10 transition-opacity duration-[400ms] ${showDoors ? 'opacity-0' : 'opacity-100'
          }`}
      />

      <div
        className={`relative z-10 w-full max-w-2xl mb-28 sm:mb-32 lg:mb-36 px-4 flex flex-col items-center transition-all duration-300 origin-bottom ${showDoors ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-[1.07]'
          }`}
      >
        <div className="w-full bg-slate-900 border-4 border-slate-800 rounded-xl shadow-[0_25px_60px_-10px_rgba(0,0,0,0.95)] overflow-hidden">
          <div className="h-4 bg-slate-900 flex items-center justify-center gap-1.5 border-b border-slate-800/60">
            <span className="w-2 h-2 rounded-full bg-slate-950 border border-slate-700" />
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_#f43f5e,0_0_16px_rgba(244,63,94,0.6)]" />
          </div>

          <div className="relative bg-slate-950/95 p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-center overflow-hidden">
            <div className="relative z-10 flex flex-col justify-center space-y-2 p-2 sm:p-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>Medi</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-rose-400">Flow</span>
              </h1>

              <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed max-w-xs">
                Sistema de triaje clínico inteligente, extracción documental y derivación hospitalaria automatizada.
              </p>
            </div>

            <div className="relative z-10 bg-slate-900/50 p-4 sm:p-5 rounded-xl border border-slate-800/80 flex flex-col justify-center">
              <LoginForm onSubmit={handleLogin} isLoading={isSubmitting} error={error} />
            </div>

            <ContinuousEcg />
          </div>
        </div>

        <div className="w-14 h-8 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-x border-slate-700 mx-auto -mt-0.5 z-0" />
        <div className="w-28 h-2 rounded-full bg-slate-800 border border-slate-700/80 shadow-md mx-auto -mt-1 z-0" />
      </div>

      <HospitalDoorsTransition
        isOpen={showDoors}
        onAnimationComplete={handleDoorsComplete}
      />
    </main>
  );
};

export default Login;
