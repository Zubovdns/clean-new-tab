import { ChromeGridItem, ChromeSection } from '../types';

export const CHROME_NTP_SECTIONS_KEY = 'chrome_ntp_sections_v3';
export const CHROME_NTP_ITEMS_KEY = 'chrome_ntp_grid_items_v2';
export const CHROME_NTP_FAVICON_CACHE_KEY = 'chrome_ntp_favicon_cache_v1';

export const DEFAULT_SECTIONS: ChromeSection[] = [
  {
    id: 'sec-main',
    title: 'Основное',
    items: [
      {
        id: 'sc-gmail',
        type: 'shortcut',
        title: 'Gmail',
        url: 'https://mail.google.com',
      },
      {
        id: 'sc-wiki',
        type: 'shortcut',
        title: 'Википедия',
        url: 'https://ru.wikipedia.org',
      },
      {
        id: 'sc-translate',
        type: 'shortcut',
        title: 'Переводчик',
        url: 'https://translate.google.com',
      },
      {
        id: 'sc-maps',
        type: 'shortcut',
        title: 'Карты',
        url: 'https://maps.google.com',
      },
    ],
  },
  {
    id: 'sec-work',
    title: 'Рабочее пространство',
    items: [
      {
        id: 'f-dev',
        type: 'folder',
        title: 'Разработка',
        items: [
          { id: 'dev-gh', title: 'GitHub', url: 'https://github.com' },
          { id: 'dev-so', title: 'StackOverflow', url: 'https://stackoverflow.com' },
          { id: 'dev-ai', title: 'Claude AI', url: 'https://claude.ai' },
          { id: 'dev-mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
          { id: 'dev-vercel', title: 'Vercel', url: 'https://vercel.com' },
        ],
      },
      {
        id: 'sc-figma',
        type: 'shortcut',
        title: 'Figma',
        url: 'https://www.figma.com',
      },
      {
        id: 'sc-notion',
        type: 'shortcut',
        title: 'Notion',
        url: 'https://www.notion.so',
      },
    ],
  },
  {
    id: 'sec-media',
    title: 'Медиа и отдых',
    items: [
      {
        id: 'f-media',
        type: 'folder',
        title: 'Медиа',
        items: [
          { id: 'med-yt', title: 'YouTube', url: 'https://www.youtube.com' },
          { id: 'med-tg', title: 'Telegram', url: 'https://web.telegram.org' },
          { id: 'med-reddit', title: 'Reddit', url: 'https://www.reddit.com' },
          { id: 'med-spotify', title: 'Spotify', url: 'https://open.spotify.com' },
        ],
      },
    ],
  },
];

/**
 * Safe chrome.storage.local helper with localStorage fallback
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

/**
 * Loads sections from storage with migration fallback from single grid items
 */
export async function loadSectionsFromStorage(): Promise<ChromeSection[]> {
  const savedSections = await getStorageItem<ChromeSection[] | null>(CHROME_NTP_SECTIONS_KEY, null);
  if (savedSections && Array.isArray(savedSections) && savedSections.length > 0) {
    return savedSections;
  }

  // Fallback: check if previous v2 grid items exist and migrate them to a section
  const previousItems = await getStorageItem<ChromeGridItem[] | null>(CHROME_NTP_ITEMS_KEY, null);
  if (previousItems && Array.isArray(previousItems) && previousItems.length > 0) {
    const migrated: ChromeSection[] = [
      {
        id: 'sec-migrated',
        title: 'Мои закладки',
        items: previousItems,
      },
    ];
    await setStorageItem(CHROME_NTP_SECTIONS_KEY, migrated);
    return migrated;
  }

  return DEFAULT_SECTIONS;
}

/**
 * Favicon persistent cache helpers
 */
export async function getFaviconCache(): Promise<Record<string, string>> {
  return getStorageItem<Record<string, string>>(CHROME_NTP_FAVICON_CACHE_KEY, {});
}

export async function saveFaviconToCache(key: string, faviconUrl: string): Promise<void> {
  if (!key || !faviconUrl) return;
  const cache = await getFaviconCache();
  if (cache[key] === faviconUrl) return;
  cache[key] = faviconUrl;
  await setStorageItem(CHROME_NTP_FAVICON_CACHE_KEY, cache);
}

const MAX_FAVICON_CACHE_ENTRIES = 200;

export async function saveMultipleFaviconsToCache(entries: Record<string, string>): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  const cache = await getFaviconCache();
  let changed = false;
  for (const [k, v] of Object.entries(entries)) {
    if (k && v && cache[k] !== v) {
      cache[k] = v;
      changed = true;
    }
  }

  // Prevent unbounded cache growth to preserve RAM and storage quota
  const allKeys = Object.keys(cache);
  if (allKeys.length > MAX_FAVICON_CACHE_ENTRIES) {
    const toRemove = allKeys.slice(0, allKeys.length - MAX_FAVICON_CACHE_ENTRIES);
    for (const k of toRemove) {
      delete cache[k];
    }
    changed = true;
  }

  if (changed) {
    await setStorageItem(CHROME_NTP_FAVICON_CACHE_KEY, cache);
  }
}

