export const getStoredItem = <T>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error(`Error parsing item ${key} from sessionStorage`, error);
    return null;
  }
};

export const setStoredItem = <T>(key: string, value: T): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving item ${key} to sessionStorage`, error);
  }
};

export const removeStoredItem = (key: string): void => {
  sessionStorage.removeItem(key);
};
