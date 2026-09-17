/**
 * Favicon helper functions and URL candidate resolution
 */

export function getDomain(rawUrl: string): string {
  try {
    const url = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `https://${rawUrl}`;
    return new URL(url).hostname;
  } catch {
    return rawUrl;
  }
}

export function getRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

export function getFaviconCandidates(
  rawUrl: string,
  size = 32,
  cachedFavicon?: string
): string[] {
  const targetUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl
    : `https://${rawUrl}`;

  const candidates: string[] = [];
  const domain = getDomain(targetUrl);

  // 0. Cached favicon from tab capture, background scraper, or custom override
  // (base64 Data URI or exact tab URL - works offline & bypasses CORS/CORP!)
  if (cachedFavicon) {
    candidates.push(cachedFavicon);
  }

  // 1. Google FaviconV2 API (Supports FULL pageUrl including subdomains and subpaths,
  // e.g. gemini.google.com/app, learn.modsen.app/my-plan)
  // This returns the exact service icon (Gemini sparkle, Modsen Education icon, etc.)
  if (domain && !domain.includes('localhost') && !domain.startsWith('127.')) {
    candidates.push(
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(targetUrl)}&size=${size}`
    );
  }

  // 2. Chromium native _favicon endpoint
  // This accesses the exact same internal Chromium FaviconSource that chrome://favicon2 uses on Chrome NTP!
  const isChromium =
    typeof chrome !== 'undefined' &&
    !!chrome.runtime?.getURL &&
    !navigator.userAgent.toLowerCase().includes('firefox');

  if (isChromium) {
    try {
      const url = new URL(chrome.runtime.getURL('/_favicon/'));
      url.searchParams.set('pageUrl', targetUrl);
      url.searchParams.set('size', size.toString());
      candidates.push(url.toString());
    } catch {
      // ignore
    }
  }

  // 3. Direct site favicon at origin root (https://domain/favicon.ico) for EXACT domain ONLY
  // Note: NEVER fall back to rootDomain here because subdomains (gemini.google.com) would fetch google.com/favicon.ico (Google "G")!
  if (
    domain &&
    !domain.includes('localhost') &&
    !domain.startsWith('127.') &&
    !domain.startsWith('192.168.')
  ) {
    try {
      const origin = new URL(targetUrl).origin;
      candidates.push(`${origin}/favicon.ico`);
    } catch {
      candidates.push(`https://${domain}/favicon.ico`);
    }
  }

  // 4. DuckDuckGo Favicon CDN (exact domain only)
  if (domain) {
    candidates.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
  }

  // 5. Icon Horse CDN (exact domain only)
  if (domain) {
    candidates.push(`https://icon.horse/icon/${domain}`);
  }

  return candidates;
}
