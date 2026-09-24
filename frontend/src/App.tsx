import { Activity } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import DashboardPreview from './components/dashboard/DashboardPreview';

const AppContent = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
          <span>Iniciando entorno clínico MediFlow...</span>
        </div>
      </main>
    );
  }

  return isAuthenticated ? <DashboardPreview /> : <Login />;
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
