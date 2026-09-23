/**
 * Favicon helper functions and candidate URL resolution
 */

export const getDomain = (rawUrl: string): string => {
  try {
    const url =
      rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
    return new URL(url).hostname;
  } catch {
    return rawUrl;
  }
};

export const getFaviconCandidates = (
  rawUrl: string,
  size = 32,
  customFavicon?: string,
  cachedFavicon?: string,
): string[] => {
  const targetUrl =
    rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;

  const candidates: string[] = [];
  const domain = getDomain(targetUrl);
  const isLocalOrPrivate =
    !domain ||
    domain.includes('localhost') ||
    domain.startsWith('127.') ||
    domain.startsWith('192.168.') ||
    domain.startsWith('10.') ||
    domain.endsWith('.local');

  const addCandidate = (url: string | undefined) => {
    if (!url) return;
    const trimmed = url.trim();
    if (trimmed && !candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }
  };

  // 0. Explicit user-defined custom favicon (highest priority)
  addCandidate(customFavicon);

  // 1. Chromium native _favicon endpoint (fast local browser cache, zero network latency, no tracking)
  const isChromium =
    typeof chrome !== 'undefined' &&
    !!chrome.runtime?.getURL &&
    !navigator.userAgent.toLowerCase().includes('firefox');

  if (isChromium) {
    try {
      const url = new URL(chrome.runtime.getURL('/_favicon/'));
      url.searchParams.set('pageUrl', targetUrl);
      url.searchParams.set('size', size.toString());
      addCandidate(url.toString());
    } catch {
      // ignore invalid URL construction
    }
  }

  // 2. Tab-discovered URL or runtime cache
  addCandidate(cachedFavicon);

  // 3. Google FaviconV2 CDN (fast Anycast CDN, 32px optimized PNG, global edge caching)
  // Skipped for private/local domains where Google cannot resolve
  if (!isLocalOrPrivate) {
    addCandidate(
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(targetUrl)}&size=${size}`,
    );
  }

  // 4. Direct favicon at origin root (preserves subdomain icons)
  try {
    const origin = new URL(targetUrl).origin;
    addCandidate(`${origin}/favicon.ico`);
  } catch {
    if (domain) {
      addCandidate(`https://${domain}/favicon.ico`);
    }
  }

  // 5. DuckDuckGo Favicon CDN (public domains fallback)
  if (domain && !isLocalOrPrivate) {
    addCandidate(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
  }

  // 6. Icon Horse CDN (public domains fallback)
  if (domain && !isLocalOrPrivate) {
    addCandidate(`https://icon.horse/icon/${domain}`);
  }

  return candidates;
};
