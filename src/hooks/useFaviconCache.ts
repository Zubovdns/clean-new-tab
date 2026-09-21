import { useState, useEffect, useCallback } from 'react';
import { CHROME_NTP_FAVICON_CACHE_KEY, getFaviconCache } from '@utils/storage';
import { getDomain } from '@utils/favicon';

/**
 * Hook to manage real-time favicon cache in chrome.storage.local
 */
export const useFaviconCache = () => {
  const [faviconCache, setFaviconCache] = useState<Record<string, string>>({});

  useEffect(() => {
    getFaviconCache().then(setFaviconCache);

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[CHROME_NTP_FAVICON_CACHE_KEY]?.newValue) {
        setFaviconCache(changes[CHROME_NTP_FAVICON_CACHE_KEY].newValue);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  const getCachedFavicon = useCallback(
    (rawUrl: string, itemFavicon?: string): string => {
      if (itemFavicon) return itemFavicon;
      const cleanUrl = rawUrl.trim();
      const domain = getDomain(cleanUrl);
      let origin = '';
      try {
        origin = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`).origin;
      } catch {
        // ignore
      }
      const noSlash = cleanUrl.replace(/\/$/, '');
      const withSlash = `${noSlash}/`;

      return (
        faviconCache[cleanUrl] ||
        faviconCache[noSlash] ||
        faviconCache[withSlash] ||
        (origin ? faviconCache[origin] : '') ||
        (origin ? faviconCache[`${origin}/`] : '') ||
        faviconCache[domain] ||
        ''
      );
    },
    [faviconCache]
  );

  return { getCachedFavicon };
};

