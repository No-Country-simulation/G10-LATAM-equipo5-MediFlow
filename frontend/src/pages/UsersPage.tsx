import { useState } from 'react';
import { Users, RefreshCw, UserPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUsersManagement } from '../hooks/useUsersManagement';
import { UserFormModal } from '../components/users/UserFormModal';
import { UsersTable } from '../components/users/UsersTable';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBanner } from '../components/common/StatusBanner';
import { BUTTON_CREATE, BUTTON_SECONDARY } from '../components/common/formStyles';
import type { UserResponse } from '../types/auth';

/** `null`: cerrado; `'new'`: alta; un usuario: edición. */
type FormTarget = UserResponse | 'new' | null;

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [userToDelete, setUserToDelete] = useState<UserResponse | null>(null);
  const {
    users,
    isLoading,
    error,
    successMessage,
    updatingUserId,
    fetchUsers,
    toggleUserStatus,
    createNewUser,
    updateExistingUser,
    deleteUser,
    dismissMessages,
  } = useUsersManagement();

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    await deleteUser(userToDelete);
    setUserToDelete(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <PageHeader
        icon={Users}
        title="Directorio de Usuarios"
        badge="Control RBAC"
        subtitle="Gestión de roles, áreas y estado operativo del personal clínico y administrativo"
        actions={
          <>
            <button type="button" onClick={() => void fetchUsers()} disabled={isLoading} className={BUTTON_SECONDARY}>
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button type="button" onClick={() => setFormTarget('new')} className={BUTTON_CREATE}>
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>
          </>
        }
      />

      <StatusBanner tone="error" message={error} onDismiss={dismissMessages} />
      <StatusBanner tone="success" message={successMessage} onDismiss={dismissMessages} />

      <UsersTable
        users={users}
        isLoading={isLoading}
        currentUserId={currentUser?.id}
        currentUserRole={currentUser?.role}
        updatingUserId={updatingUserId}
        onToggleStatus={(u) => void toggleUserStatus(u)}
        onEdit={setFormTarget}
        onDelete={setUserToDelete}
      />

      {formTarget !== null && (
        <UserFormModal
          key={formTarget === 'new' ? 'new' : formTarget.id}
          user={formTarget === 'new' ? undefined : formTarget}
          currentUserRole={currentUser?.role}
          onClose={() => setFormTarget(null)}
          onCreate={createNewUser}
          onUpdate={updateExistingUser}
        />
      )}

      <ConfirmDialog
        isOpen={userToDelete !== null}
        title="Eliminar Usuario"
        message={`¿Eliminar al usuario ${userToDelete?.username ?? ''}?`}
        detail="Si tiene actividad registrada (documentos subidos o auditados, cambios de catálogos) solo se desactivará, para conservar la trazabilidad."
        onConfirm={handleConfirmDelete}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );
};

export default UsersPage;
