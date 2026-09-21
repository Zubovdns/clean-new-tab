import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getDomain, getFaviconCandidates } from '../src/utils/favicon';

describe('favicon utils', () => {
  describe('getDomain', () => {
    it('extracts hostname from full HTTPS and HTTP URLs', () => {
      expect(getDomain('https://github.com/user/repo')).toBe('github.com');
      expect(getDomain('http://example.org/test?a=1')).toBe('example.org');
    });

    it('extracts hostname from URLs without protocol', () => {
      expect(getDomain('reddit.com')).toBe('reddit.com');
      expect(getDomain('sub.domain.com/path')).toBe('sub.domain.com');
    });

    it('extracts hostname with ports', () => {
      expect(getDomain('http://localhost:3000/dashboard')).toBe('localhost');
      expect(getDomain('localhost:8080')).toBe('localhost');
    });

    it('handles malformed or empty URLs safely', () => {
      expect(getDomain('')).toBe('');
      expect(getDomain(':::invalid-url:::')).toBe(':::invalid-url:::');
    });
  });

  describe('getFaviconCandidates', () => {
    const originalChrome = (globalThis as unknown as { chrome?: unknown }).chrome;

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      (globalThis as unknown as { chrome?: unknown }).chrome = originalChrome;
    });

    it('prioritizes customFavicon first if provided', () => {
      const candidates = getFaviconCandidates(
        'https://example.com',
        32,
        'https://custom.icon/fav.png'
      );
      expect(candidates[0]).toBe('https://custom.icon/fav.png');
    });

    it('includes cachedFavicon when provided', () => {
      const candidates = getFaviconCandidates(
        'https://example.com',
        32,
        undefined,
        'https://example.com/cached.ico'
      );
      expect(candidates).toContain('https://example.com/cached.ico');
    });

    it('generates public CDN and origin candidates for public domains', () => {
      const candidates = getFaviconCandidates('https://github.com');
      expect(candidates.some((c) => c.includes('gstatic.com/faviconV2'))).toBe(true);
      expect(candidates.some((c) => c.includes('icons.duckduckgo.com'))).toBe(true);
      expect(candidates.some((c) => c.includes('icon.horse'))).toBe(true);
      expect(candidates).toContain('https://github.com/favicon.ico');
    });

    it('skips public external CDNs for local and private addresses', () => {
      const localCandidates = getFaviconCandidates('http://localhost:3000');
      expect(localCandidates.some((c) => c.includes('gstatic.com'))).toBe(false);
      expect(localCandidates.some((c) => c.includes('duckduckgo.com'))).toBe(false);
      expect(localCandidates.some((c) => c.includes('icon.horse'))).toBe(false);
      expect(localCandidates).toContain('http://localhost:3000/favicon.ico');

      const privateIpCandidates = getFaviconCandidates('http://192.168.1.1/admin');
      expect(privateIpCandidates.some((c) => c.includes('gstatic.com'))).toBe(false);
    });

    it('uses Chromium native _favicon endpoint when chrome.runtime.getURL is available', () => {
      (globalThis as unknown as { chrome: unknown }).chrome = {
        runtime: {
          getURL: (path: string) => `chrome-extension://dummy-extension-id${path}`,
        },
      };

      const candidates = getFaviconCandidates('https://news.ycombinator.com', 32);
      const chromeCandidate = candidates.find((c) => c.includes('/_favicon/'));
      expect(chromeCandidate).toBeDefined();
      expect(chromeCandidate).toContain('chrome-extension://dummy-extension-id/_favicon/');
      expect(chromeCandidate).toContain('pageUrl=https%3A%2F%2Fnews.ycombinator.com');
      expect(chromeCandidate).toContain('size=32');

      // Chromium native endpoint should precede external Google CDN
      const chromeIdx = candidates.findIndex((c) => c.includes('/_favicon/'));
      const googleIdx = candidates.findIndex((c) => c.includes('gstatic.com'));
      expect(chromeIdx).toBeLessThan(googleIdx);
    });

    it('does not duplicate candidates', () => {
      const candidates = getFaviconCandidates(
        'https://example.com',
        32,
        'https://example.com/favicon.ico'
      );
      const count = candidates.filter((c) => c === 'https://example.com/favicon.ico').length;
      expect(count).toBe(1);
    });
  });
});
