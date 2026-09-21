import { describe, it, expect } from 'vitest';

import {
  isSafeUrl,
  normalizeSafeUrl,
  generateId,
  validateAndNormalizeSections,
} from '../src/utils/security';

describe('security utils', () => {
  describe('isSafeUrl', () => {
    it('accepts standard web protocols', () => {
      expect(isSafeUrl('https://google.com')).toBe(true);
      expect(isSafeUrl('http://localhost:3000')).toBe(true);
      expect(isSafeUrl('http://192.168.1.1')).toBe(true);
    });

    it('accepts browser internal pages', () => {
      expect(isSafeUrl('chrome://extensions')).toBe(true);
      expect(isSafeUrl('brave://settings')).toBe(true);
      expect(isSafeUrl('edge://flags')).toBe(true);
    });

    it('accepts domains without explicit protocol', () => {
      expect(isSafeUrl('github.com')).toBe(true);
      expect(isSafeUrl('sub.domain.org/path')).toBe(true);
      expect(isSafeUrl('//cdn.example.com/asset')).toBe(true);
    });

    it('rejects dangerous script protocols (XSS prevention)', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('javascript:chrome.storage.local.get(null)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('rejects empty or invalid inputs', () => {
      expect(isSafeUrl('')).toBe(false);
      expect(isSafeUrl(null as unknown as string)).toBe(false);
      expect(isSafeUrl(undefined as unknown as string)).toBe(false);
    });
  });

  describe('normalizeSafeUrl', () => {
    it('prefixes bare domains with https://', () => {
      expect(normalizeSafeUrl('github.com')).toBe('https://github.com');
      expect(normalizeSafeUrl('sub.example.com/path?q=1')).toBe('https://sub.example.com/path?q=1');
    });

    it('preserves existing safe protocols', () => {
      expect(normalizeSafeUrl('http://insecure.site')).toBe('http://insecure.site');
      expect(normalizeSafeUrl('https://secure.site')).toBe('https://secure.site');
      expect(normalizeSafeUrl('chrome://settings')).toBe('chrome://settings');
    });

    it('returns empty string for unsafe protocols', () => {
      expect(normalizeSafeUrl('javascript:void(0)')).toBe('');
      expect(normalizeSafeUrl('data:application/json,{}')).toBe('');
    });
  });

  describe('generateId', () => {
    it('generates unique IDs with requested prefix', () => {
      const id1 = generateId('sec');
      const id2 = generateId('sec');
      const id3 = generateId('sc');

      expect(id1.startsWith('sec-')).toBe(true);
      expect(id3.startsWith('sc-')).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });

  describe('validateAndNormalizeSections', () => {
    it('sanitizes sections and filters out malicious URLs', () => {
      const input = [
        {
          id: 'sec-1',
          title: 'Work',
          items: [
            { id: '1', title: 'GitHub', url: 'github.com' },
            { id: '2', title: 'Exploit', url: 'javascript:alert(document.cookie)' },
            { id: '3', title: 'Data URI', url: 'data:text/html,bad' },
            { id: '4', title: 'Internal', url: 'chrome://bookmarks' },
          ],
        },
      ];

      const result = validateAndNormalizeSections(input);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Work');
      expect(result[0].items).toHaveLength(2);

      expect(result[0].items[0].url).toBe('https://github.com');
      expect(result[0].items[0].title).toBe('GitHub');

      expect(result[0].items[1].url).toBe('chrome://bookmarks');
    });

    it('handles corrupted data gracefully', () => {
      expect(validateAndNormalizeSections(null)).toEqual([]);
      expect(validateAndNormalizeSections('invalid')).toEqual([]);
      expect(validateAndNormalizeSections([null, undefined, {}])).toHaveLength(1);
      expect(validateAndNormalizeSections([{}])[0].title).toBe('Новая секция');
    });
  });
});
