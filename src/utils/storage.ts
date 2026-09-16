/**
 * Safe chrome.storage.local helper with localStorage fallback
 * Works both inside WebExtension runtime and in standalone browser tab
 */

export async function getStorageItem<T>(key: string, defaultValue: T): Promise<T> {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const result = await chrome.storage.local.get([key]);
      return result[key] !== undefined ? (result[key] as T) : defaultValue;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    }
  } catch (error) {
    console.warn(`[storage] Error reading key "${key}":`, error);
  }
  return defaultValue;
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [key]: value });
      return;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    console.warn(`[storage] Error writing key "${key}":`, error);
  }
}
