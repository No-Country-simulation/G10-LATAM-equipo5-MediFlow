import { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { getStoredToken, removeStoredToken, setStoredToken } from '../services/api';
import { getStoredItem, removeStoredItem, setStoredItem } from '../services/sessionStorage';
import type { LoginRequest, UserOut } from '../types/auth';

const USER_KEY = 'mediflow_user';

export const useAuthSession = () => {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<UserOut | null>(() => getStoredItem<UserOut>(USER_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    removeStoredToken();
    removeStoredItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const initSession = async () => {
      if (!getStoredToken()) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await authService.getProfile();
        setUser(profile);
        setStoredItem(USER_KEY, profile);
      } catch {
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    window.addEventListener('auth:unauthorized', clearSession);
    return () => window.removeEventListener('auth:unauthorized', clearSession);
  }, []);

  const login = async (credentials: LoginRequest): Promise<UserOut> => {
    setIsLoading(true);
    try {
      const { access_token, user: loggedUser } = await authService.login(credentials);
      setStoredToken(access_token);
      setStoredItem(USER_KEY, loggedUser);
      setToken(access_token);
      setUser(loggedUser);
      return loggedUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (error) {
      console.warn('Backend logout warning:', error);
    } finally {
      clearSession();
      setIsLoading(false);
    }
  };

  return {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  };
};
