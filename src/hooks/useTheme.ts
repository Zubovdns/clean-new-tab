import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};

const getSnapshot = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const getServerSnapshot = (): boolean => true;

/**
 * Hook to detect and track system color scheme (dark / light)
 */
export const useTheme = (): boolean => {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

