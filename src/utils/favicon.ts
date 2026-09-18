/**
 * Favicon helper functions and candidate URL resolution
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

  // 0. User override or runtime cache from active tabs
  if (cachedFavicon) {
    candidates.push(cachedFavicon);
  }

  // 1. Google FaviconV2 API (resolves specific subdomains and paths)
  if (domain && !domain.includes('localhost') && !domain.startsWith('127.')) {
    candidates.push(
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(targetUrl)}&size=${size}`
    );
  }

  // 2. Chromium native _favicon endpoint
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
      // ignore invalid URL construction
    }
  }

  // 3. Direct favicon at origin root (preserves subdomain icons)
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

  // 4. DuckDuckGo Favicon CDN
  if (domain) {
    candidates.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
  }

  // 5. Icon Horse CDN
  if (domain) {
    candidates.push(`https://icon.horse/icon/${domain}`);
  }

  return candidates;
}
