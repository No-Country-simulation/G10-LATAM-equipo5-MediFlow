import { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { getStoredToken, removeStoredToken, setStoredToken } from '../services/api';
import type { LoginRequest, UserOut } from '../types/auth';

const USER_KEY = 'mediflow_user';

export const useAuthSession = () => {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [user, setUser] = useState<UserOut | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    removeStoredToken();
    localStorage.removeItem(USER_KEY);
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
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
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

  const login = async (credentials: LoginRequest) => {
    setIsLoading(true);
    try {
      const { access_token, user: loggedUser } = await authService.login(credentials);
      setStoredToken(access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(loggedUser));
      setToken(access_token);
      setUser(loggedUser);
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
