import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import type { UserCreateRequest, UserResponse } from '../types/auth';

export const useUsersManagement = () => {
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setError(null);
    try {
      const data = await authService.getUsers(1, 100);
      setUsers(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al obtener usuarios');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    authService
      .getUsers(1, 100)
      .then((data) => {
        if (cancelled) return;
        setUsers(data.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleUserStatus = async (user: UserResponse) => {
    setUpdatingUserId(user.id);
    setError(null);
    setSuccessMessage(null);
    const newStatus = !user.is_active;

    try {
      const updated = await authService.updateUser(user.id, { is_active: newStatus });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setSuccessMessage(
        `Usuario ${updated.username} ${newStatus ? 'activado' : 'desactivado'} correctamente`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado del usuario');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const createNewUser = async (payload: UserCreateRequest): Promise<boolean> => {
    setError(null);
    setSuccessMessage(null);
    try {
      const created = await authService.createUser(payload);
      setUsers((prev) => [created, ...prev]);
      setSuccessMessage(`Usuario ${created.username} creado con éxito`);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
      return false;
    }
  };

  const dismissMessages = () => {
    setError(null);
    setSuccessMessage(null);
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
    dismissMessages,
  };
};
