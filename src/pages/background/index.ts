import { saveMultipleFaviconsToCache, getFaviconCache } from '@utils/storage';

/**
 * Resolves a lightweight favicon URL for a target page:
 * Uses Google FaviconV2 CDN (32px, fast Anycast global edge caching)
 * and stores the URL in chrome.storage.local cache.
 */
const resolveFaviconForUrl = async (pageUrl: string): Promise<string | null> => {
  try {
    const urlObj = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
    const domain = urlObj.hostname;

    const gstaticUrl = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(pageUrl)}&size=32`;

    await saveMultipleFaviconsToCache({
      [domain]: gstaticUrl,
      [pageUrl]: gstaticUrl,
    });
    return gstaticUrl;
  } catch (err) {
    console.warn('[background] Failed to resolve favicon for:', pageUrl, err);
  }
  return null;
};

// Message handler for Newtab page requests (on-demand favicon resolution)
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RESOLVE_FAVICONS' && Array.isArray(message.urls)) {
      (async () => {
        try {
          const currentCache = await getFaviconCache();
          const batchEntries: Record<string, string> = {};

          for (const url of message.urls) {
            try {
              const u = new URL(url.startsWith('http') ? url : `https://${url}`);
              if (currentCache[url] || currentCache[u.hostname]) {
                continue; // Skip already cached URLs to avoid unnecessary operations
              }
              const gstaticUrl = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(url)}&size=32`;
              batchEntries[u.hostname] = gstaticUrl;
              batchEntries[url] = gstaticUrl;
            } catch {
              // ignore invalid URLs
            }
          }

          if (Object.keys(batchEntries).length > 0) {
            await saveMultipleFaviconsToCache(batchEntries);
          }
          sendResponse({ ok: true });
        } catch (err) {
          console.warn('[background] RESOLVE_FAVICONS error:', err);
          sendResponse({ ok: false });
        }
      })();
      return true; // Keep message channel open for async response
    }

    if (message?.type === 'RESOLVE_FAVICON' && message.url) {
      resolveFaviconForUrl(message.url).then((favicon) => {
        sendResponse({ favicon });
      });
      return true;
    }
  });
}
