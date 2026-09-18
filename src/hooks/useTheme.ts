import { useState, useEffect } from 'react';

/**
 * Hook to detect and track system color scheme (dark / light)
 */
export function useTheme(): boolean {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(media.matches);

    const listener = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isDark;
}

export default useTheme;
