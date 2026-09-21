import { ChromeSection, ChromeShortcutItem } from '@app-types';

const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'chrome:',
  'brave:',
  'edge:',
  'chrome-extension:',
]);

/**
 * Checks if a given URL uses an allowed safe protocol.
 * Rejects javascript:, data:, vbscript:, and malformed URLs.
 */
export const isSafeUrl = (rawUrl: string): boolean => {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();

  // If protocol-relative URL
  if (trimmed.startsWith('//')) {
    return true;
  }

  // Check if string contains an explicit protocol
  const protocolMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase() + ':';
    return ALLOWED_PROTOCOLS.has(protocol);
  }

  // No explicit protocol (e.g. "google.com" or "sub.domain.org/path") -> safe, can be prefixed with https://
  return true;
};

/**
 * Normalizes and sanitizes a URL string.
 * Returns empty string if the URL is dangerous or invalid.
 */
export const normalizeSafeUrl = (rawUrl: string): string => {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  if (!isSafeUrl(trimmed)) {
    return '';
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
};

/**
 * Generates a unique ID with an optional prefix using crypto.randomUUID
 */
export const generateId = (prefix: 'sec' | 'sc'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

/**
 * Validates and normalizes raw sections data from external sources (JSON files, Gist, storage).
 * Strips dangerous URLs, ensures required properties, and assigns fallback IDs.
 */
export const validateAndNormalizeSections = (rawSections: unknown): ChromeSection[] => {
  if (!Array.isArray(rawSections)) return [];

  const result: ChromeSection[] = [];
  for (const rawSec of rawSections) {
    if (!rawSec || typeof rawSec !== 'object') continue;
    const sec = rawSec as Record<string, unknown>;

    const id =
      typeof sec.id === 'string' && sec.id.trim() ? sec.id.trim() : generateId('sec');
    const title =
      typeof sec.title === 'string' && sec.title.trim() ? sec.title.trim() : 'Новая секция';

    const items: ChromeShortcutItem[] = [];
    const rawItems = Array.isArray(sec.items) ? sec.items : [];

    for (const rawItem of rawItems) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const it = rawItem as Record<string, unknown>;

      const rawUrl = typeof it.url === 'string' ? it.url : '';
      const safeUrl = normalizeSafeUrl(rawUrl);
      if (!safeUrl) continue; // Skip dangerous or empty URLs

      items.push({
        id: typeof it.id === 'string' && it.id.trim() ? it.id.trim() : generateId('sc'),
        type: 'shortcut',
        title:
          typeof it.title === 'string' && it.title.trim()
            ? it.title.trim()
            : safeUrl.replace(/^https?:\/\//i, ''),
        url: safeUrl,
        favicon: typeof it.favicon === 'string' && it.favicon.trim() ? it.favicon.trim() : undefined,
      });
    }

    result.push({
      id,
      title,
      items,
    });
  }

  return result;
};
