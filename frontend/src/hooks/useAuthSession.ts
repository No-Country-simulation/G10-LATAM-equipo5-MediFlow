import { useEffect, useState } from 'react';
import { authService } from '../services/authService';
import { getStoredToken, removeStoredToken, setStoredTokens } from '../services/api';
import { getStoredItem, removeStoredItem, setStoredItem } from '../services/sessionStorage';
import type { LoginRequest, TokenResponse, UserOut } from '../types/auth';
import { createLogger, describeError } from '../utils/logger';

const USER_KEY = 'mediflow_user';
const log = createLogger('auth');

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
        log.info('Sesión restaurada', { user: profile.username, role: profile.role });
      } catch (error) {
        log.warn('La sesión guardada ya no es válida: se pide iniciar sesión de nuevo', { error: describeError(error) });
        clearSession();
      } finally {
        setIsLoading(false);
      }
    };

    const handleTokenRefreshed = (event: Event) => {
      const { access_token, user: refreshedUser } = (event as CustomEvent<TokenResponse>).detail;
      setStoredItem(USER_KEY, refreshedUser);
      setToken(access_token);
      setUser(refreshedUser);
    };

    initSession();

    window.addEventListener('auth:unauthorized', clearSession);
    window.addEventListener('auth:token-refreshed', handleTokenRefreshed);
    return () => {
      window.removeEventListener('auth:unauthorized', clearSession);
      window.removeEventListener('auth:token-refreshed', handleTokenRefreshed);
    };
  }, []);

  const login = async (credentials: LoginRequest): Promise<UserOut> => {
    setIsLoading(true);
    try {
      const { access_token, refresh_token, user: loggedUser } = await authService.login(credentials);
      setStoredTokens(access_token, refresh_token);
      setStoredItem(USER_KEY, loggedUser);
      setToken(access_token);
      setUser(loggedUser);
      log.info('Inicio de sesión', { user: loggedUser.username, role: loggedUser.role, area: loggedUser.area?.codigo });
      return loggedUser;
    } catch (error) {
      log.warn('Inicio de sesión rechazado', { user: credentials.username, error: describeError(error) });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      log.info('Cierre de sesión', { user: user?.username });
    } catch (error) {
      log.warn('El backend no confirmó el cierre de sesión; se limpia la sesión local igual', { error: describeError(error) });
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
