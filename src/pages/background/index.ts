import { saveMultipleFaviconsToCache, getFaviconCache } from '../../utils/storage';

/**
 * Resolves a lightweight favicon URL for a target page:
 * 1. Checks open tabs for live browser-rendered favicons
 * 2. Falls back to Google FaviconV2 (32px)
 * 
 * Stores clean, lightweight URL strings (avoiding Base64 image bloat in memory)
 */
const resolveFaviconForUrl = async (pageUrl: string): Promise<string | null> => {
  try {
    const urlObj = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`);
    const domain = urlObj.hostname;

    // 1. Check open tabs first (highest fidelity, exact browser-rendered tab icon)
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      try {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
          if (t.url && t.favIconUrl) {
            try {
              const tabUrlObj = new URL(t.url);
              if (tabUrlObj.hostname === domain) {
                await saveMultipleFaviconsToCache({
                  [domain]: t.favIconUrl,
                  [pageUrl]: t.favIconUrl,
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

    // 2. Google FaviconV2 API (Supports exact full URL, subdomains, size 32 for minimal RAM footprint)
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

/**
 * Scans all currently open tabs and caches their lightweight favicon URLs
 */
const scanOpenTabs = async () => {
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
            entries[tab.url] = tab.favIconUrl;
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
};

// Initial scan
scanOpenTabs();

// Listen for tab updates to capture favicons dynamically in real time
if (typeof chrome !== 'undefined' && chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    const iconUrl = changeInfo.favIconUrl || tab.favIconUrl;
    if (iconUrl && tab.url) {
      try {
        const u = new URL(tab.url);
        if (u.protocol.startsWith('http')) {
          saveMultipleFaviconsToCache({
            [u.hostname]: iconUrl,
            [tab.url]: iconUrl,
          });
        }
      } catch {
        // ignore
      }
    }
  });
}

// Listen for tab activation to capture favicon from active tabs
if (typeof chrome !== 'undefined' && chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab?.url && tab?.favIconUrl) {
        const u = new URL(tab.url);
        if (u.protocol.startsWith('http')) {
          saveMultipleFaviconsToCache({
            [u.hostname]: tab.favIconUrl,
            [tab.url]: tab.favIconUrl,
          });
        }
      }
    } catch {
      // ignore
    }
  });
}

// Message handler for Newtab page requests
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'RESOLVE_FAVICONS' && Array.isArray(message.urls)) {
      (async () => {
        const currentCache = await getFaviconCache();
        for (const url of message.urls) {
          try {
            const u = new URL(url.startsWith('http') ? url : `https://${url}`);
            if (currentCache[url] || currentCache[u.hostname]) {
              continue; // Skip already cached URLs to avoid repeated background tasks
            }
          } catch {
            // ignore
          }
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
  });
}
