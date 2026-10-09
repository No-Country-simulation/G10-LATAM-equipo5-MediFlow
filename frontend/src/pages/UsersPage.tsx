import { useState } from 'react';
import { Users, AlertCircle, RefreshCw, UserPlus, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUsersManagement } from '../hooks/useUsersManagement';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { UsersTable } from '../components/users/UsersTable';

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    users,
    isLoading,
    error,
    successMessage,
    updatingUserId,
    fetchUsers,
    toggleUserStatus,
    createNewUser,
    dismissMessages,
  } = useUsersManagement();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <span>Directorio de Usuarios</span>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
              Control RBAC
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de roles y estado operativo del personal clínico y administrativo
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchUsers()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-950/40 border border-indigo-500/30 transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={dismissMessages} className="text-rose-400 hover:text-white p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={dismissMessages} className="text-emerald-400 hover:text-white p-1 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <UsersTable
        users={users}
        isLoading={isLoading}
        currentUserId={currentUser?.id}
        updatingUserId={updatingUserId}
        onToggleStatus={toggleUserStatus}
      />

      <CreateUserModal
        isOpen={isModalOpen}
        currentUserRole={currentUser?.role}
        onClose={() => setIsModalOpen(false)}
        onSubmit={createNewUser}
      />
    </div>
  );
};

export default UsersPage;
