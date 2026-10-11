import { createLogger, describeError } from '../utils/logger';

const log = createLogger('storage');

export const getStoredItem = <T>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    log.warn('Dato de sesión ilegible, se descarta', { key, error: describeError(error) });
    return null;
  }
};

export const setStoredItem = <T>(key: string, value: T): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    log.warn('No se pudo guardar un dato de sesión', { key, error: describeError(error) });
  }
};

export const removeStoredItem = (key: string): void => {
  sessionStorage.removeItem(key);
};
