import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import type { UserAdminUpdateRequest, UserCreateRequest, UserResponse } from '../types/auth';
import { useActionFeedback } from './useActionFeedback';
import { errorMessage } from '../utils/errors';

const USERS_PAGE_SIZE = 100;

export const useUsersManagement = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { error, setError, successMessage, setSuccessMessage, reset: startAction } = useActionFeedback();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const replaceUser = (updated: UserResponse) =>
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));

  // Solo actualiza el estado en los callbacks de la promesa: así puede llamarse desde el efecto.
  const requestUsers = useCallback(
    (isCancelled: () => boolean = () => false) =>
      authService
        .getUsers(1, USERS_PAGE_SIZE)
        .then((data) => {
          if (!isCancelled()) setUsers(data.items);
        })
        .catch((err: unknown) => {
          if (!isCancelled()) setError(errorMessage(err, 'Error al obtener usuarios'));
        })
        .finally(() => {
          if (!isCancelled()) setIsLoading(false);
        }),
    [setError]
  );

  useEffect(() => {
    let cancelled = false;
    void requestUsers(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [requestUsers]);

  const fetchUsers = () => {
    setIsLoading(true);
    setError(null);
    return requestUsers();
  };

  const toggleUserStatus = async (user: UserResponse) => {
    startAction();
    setUpdatingUserId(user.id);
    const newStatus = !user.is_active;
    try {
      const updated = await authService.updateUser(user.id, { is_active: newStatus });
      replaceUser(updated);
      setSuccessMessage(`Usuario ${updated.username} ${newStatus ? 'activado' : 'desactivado'} correctamente`);
    } catch (err) {
      setError(errorMessage(err, 'Error al cambiar estado del usuario'));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const createNewUser = async (payload: UserCreateRequest): Promise<boolean> => {
    startAction();
    try {
      const created = await authService.createUser(payload);
      setUsers((prev) => [created, ...prev]);
      setSuccessMessage(`Usuario ${created.username} creado con éxito`);
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Error al crear usuario'));
      return false;
    }
  };

  const updateExistingUser = async (userId: string, payload: UserAdminUpdateRequest): Promise<boolean> => {
    startAction();
    try {
      const updated = await authService.updateUser(userId, payload);
      replaceUser(updated);
      setSuccessMessage(`Usuario ${updated.username} actualizado correctamente`);
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Error al actualizar usuario'));
      return false;
    }
  };

  /**
   * Smart Delete del backend: si el usuario tiene actividad registrada solo se desactiva, así que
   * la fila se actualiza en vez de quitarse.
   */
  const deleteUser = async (user: UserResponse): Promise<void> => {
    startAction();
    try {
      const result = await authService.deleteUser(user.id);
      if (result.deletion_type === 'HARD_DELETE') {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } else {
        replaceUser({ ...user, is_active: false });
      }
      setSuccessMessage(result.message);
    } catch (err) {
      setError(errorMessage(err, 'Error al eliminar usuario'));
    }
  };

  return {
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
    dismissMessages: startAction,
  };
};
