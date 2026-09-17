import { saveMultipleFaviconsToCache, getFaviconCache } from '../../utils/storage';

/**
 * Converts a Blob to a base64 Data URI safely inside a Service Worker
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  const base64 = btoa(binary);
  const mimeType = blob.type || 'image/png';
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Extracts the best favicon URL from the site's HTML markup
 */
async function scrapeFaviconUrlFromHtml(pageUrl: string): Promise<string | null> {
  try {
    const urlObj = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
    const origin = urlObj.origin;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(origin, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Look for link tags with rel="icon", rel="shortcut icon", rel="apple-touch-icon"
    const linkRegex = /<link\s+[^>]*rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon|alternate\s+icon)[^"']*["'][^>]*>/gi;
    const linkMatches = html.match(linkRegex) || [];

    let bestHref: string | null = null;
    for (const tag of linkMatches) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch && hrefMatch[1]) {
        bestHref = hrefMatch[1].trim();
        // High quality hints: png, svg, or explicit sizes
        if (tag.includes('sizes="') || tag.includes('png') || tag.includes('svg')) {
          break;
        }
      }
    }

    // Try attribute order where href is before rel
    if (!bestHref) {
      const revLinkRegex = /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?(?:icon|apple-touch-icon|alternate\s+icon)[^"']*["'][^>]*>/gi;
      const revMatch = revLinkRegex.exec(html);
      if (revMatch && revMatch[1]) {
        bestHref = revMatch[1].trim();
      }
    }

    if (bestHref) {
      if (bestHref.startsWith('data:')) {
        return bestHref;
      }
      return new URL(bestHref, origin).href;
    }

    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/**
 * Resolves a favicon for a target URL by checking tabs, scraping HTML,
 * and converting the image to a base64 Data URI to prevent CORS/CORP issues.
 */
export async function resolveFaviconForUrl(pageUrl: string): Promise<string | null> {
  try {
    const urlObj = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
    const domain = urlObj.hostname;
    const origin = urlObj.origin;

    // 1. Check open tabs first (highest fidelity, zero network overhead)
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      try {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
          if (t.url && t.favIconUrl) {
            try {
              if (new URL(t.url).hostname === domain) {
                await saveMultipleFaviconsToCache({
                  [domain]: t.favIconUrl,
                  [origin]: t.favIconUrl,
                });
                return t.favIconUrl;
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 2. Try scraping HTML for <link rel="icon">
    const iconUrl = await scrapeFaviconUrlFromHtml(pageUrl);
    if (iconUrl) {
      if (iconUrl.startsWith('data:')) {
        await saveMultipleFaviconsToCache({
          [domain]: iconUrl,
          [origin]: iconUrl,
        });
        return iconUrl;
      }

      try {
        const iconCtrl = new AbortController();
        const iconTimeout = setTimeout(() => iconCtrl.abort(), 4000);
        const iconRes = await fetch(iconUrl, { signal: iconCtrl.signal });
        clearTimeout(iconTimeout);

        if (iconRes.ok) {
          const contentType = iconRes.headers.get('content-type') || '';
          if (
            !contentType.includes('text/html') &&
            (contentType.includes('image') || iconUrl.match(/\.(ico|png|svg|webp)($|\?)/i))
          ) {
            const blob = await iconRes.blob();
            if (blob.size > 0) {
              const dataUrl = await blobToDataUrl(blob);
              await saveMultipleFaviconsToCache({
                [domain]: dataUrl,
                [origin]: dataUrl,
              });
              return dataUrl;
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 3. Fallback: try root domain if subdomain (e.g. learn.modsen.app -> modsen.app)
    const parts = domain.split('.');
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join('.');
      const rootOrigin = `https://${rootDomain}`;
      try {
        const rootCtrl = new AbortController();
        const rootTimer = setTimeout(() => rootCtrl.abort(), 3000);
        const rootRes = await fetch(`${rootOrigin}/favicon.ico`, { signal: rootCtrl.signal });
        clearTimeout(rootTimer);

        if (rootRes.ok) {
          const contentType = rootRes.headers.get('content-type') || '';
          if (contentType.includes('image') || !contentType.includes('text/html')) {
            const blob = await rootRes.blob();
            if (blob.size > 0) {
              const dataUrl = await blobToDataUrl(blob);
              await saveMultipleFaviconsToCache({
                [domain]: dataUrl,
                [origin]: dataUrl,
              });
              return dataUrl;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn('[background] Failed to resolve favicon for:', pageUrl, err);
  }
  return null;
}

/**
 * Scans all currently open tabs and caches their favicons
 */
async function scanOpenTabs() {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;
  try {
    const tabs = await chrome.tabs.query({});
    const entries: Record<string, string> = {};
    for (const tab of tabs) {
      if (tab.url && tab.favIconUrl) {
        try {
          const u = new URL(tab.url);
          if (u.protocol.startsWith('http')) {
            entries[u.hostname] = tab.favIconUrl;
            entries[u.origin] = tab.favIconUrl;
          }
        } catch {
          // ignore
        }
      }
    }
    if (Object.keys(entries).length > 0) {
      await saveMultipleFaviconsToCache(entries);
    }
  } catch (err) {
    console.warn('[background] scanOpenTabs error:', err);
  }
}

// Initial scan
scanOpenTabs();

// Listen for tab updates to capture favicons dynamically in real time
if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.favIconUrl && tab.url) {
      try {
        const u = new URL(tab.url);
        if (u.protocol.startsWith('http')) {
          saveMultipleFaviconsToCache({
            [u.hostname]: changeInfo.favIconUrl,
            [u.origin]: changeInfo.favIconUrl,
          });
        }
      } catch {
        // ignore
      }
    }
  });
}

// Message handler for Newtab page requests
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RESOLVE_FAVICONS' && Array.isArray(message.urls)) {
      (async () => {
        for (const url of message.urls) {
          await resolveFaviconForUrl(url);
        }
        sendResponse({ ok: true });
      })();
      return true; // Keep message channel open for async response
    }

    if (message?.type === 'RESOLVE_FAVICON' && message.url) {
      resolveFaviconForUrl(message.url).then((favicon) => {
        sendResponse({ favicon });
      });
      return true;
    }

    if (message?.type === 'GET_FAVICON_CACHE') {
      getFaviconCache().then((cache) => {
        sendResponse({ cache });
      });
      return true;
    }
  });
}
