import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  Stethoscope,
  FolderOpen,
  UserCheck,
  Sparkles,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const navLinks: NavItem[] = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { to: '/triaje', label: 'Triaje Clínico', icon: Stethoscope },
  { to: '/documentos', label: 'Expedientes', icon: FolderOpen },
  { to: '/auditoria', label: 'Auditoría', icon: UserCheck },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-white tracking-tight">MediFlow</span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Sesión Activa
            </span>
          </div>
        </Link>
      </div>

      <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white border border-slate-700/80 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => navigate('/ingesta')}
          title="El documento será clasificado y enrutado automáticamente por el agente de IA"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs shadow-md shadow-emerald-950/40 border border-emerald-400/30 flex items-center gap-2 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-emerald-100" />
          <span className="hidden md:inline">Procesar Documento IA</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 text-right">
          <div>
            <div className="text-xs font-semibold text-slate-200">{user?.full_name}</div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>{user?.role}</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold text-xs">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 border border-slate-700/60 hover:border-rose-500/40 text-xs font-medium text-slate-200 hover:text-rose-300 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cerrar Sesión</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
