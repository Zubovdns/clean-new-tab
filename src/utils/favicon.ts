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
  size = 64,
  cachedFavicon?: string
): string[] {
  const targetUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
    ? rawUrl
    : `https://${rawUrl}`;

  const candidates: string[] = [];
  const domain = getDomain(targetUrl);
  const rootDomain = getRootDomain(domain);

  // 0. Cached favicon from tab capture, background scraper, or custom override
  // (base64 Data URI or exact tab URL - works offline & bypasses CORS/CORP!)
  if (cachedFavicon) {
    candidates.push(cachedFavicon);
  }

  // 1. Direct site favicon at origin root (https://domain/favicon.ico)
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

    if (rootDomain && rootDomain !== domain) {
      candidates.push(`https://${rootDomain}/favicon.ico`);
    }
  }

  // 2. DuckDuckGo Favicon CDN (primary domain + root domain fallback)
  if (domain) {
    candidates.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    if (rootDomain && rootDomain !== domain) {
      candidates.push(`https://icons.duckduckgo.com/ip3/${rootDomain}.ico`);
    }
  }

  // 3. Google S2 Favicon service (domain + root domain fallback)
  if (domain) {
    candidates.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`);
    if (rootDomain && rootDomain !== domain) {
      candidates.push(`https://www.google.com/s2/favicons?domain=${rootDomain}&sz=${size}`);
    }
  }

  // 4. Icon Horse CDN
  if (domain) {
    candidates.push(`https://icon.horse/icon/${domain}`);
  }

  // 5. Chrome / Chromium native internal favicon database (_favicon)
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

  return candidates;
}
