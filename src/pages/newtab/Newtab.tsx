import React, { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '@utils/storage';

interface TabItem {
  id: string;
  title: string;
  url: string;
}

const STORAGE_KEY = 'brave_user_tabs';

const DEFAULT_TABS: TabItem[] = [
  { id: '1', title: 'GitHub', url: 'https://github.com' },
  { id: '2', title: 'Brave Search', url: 'https://search.brave.com' },
  { id: '3', title: 'YouTube', url: 'https://youtube.com' },
  { id: '4', title: 'Reddit', url: 'https://reddit.com' },
];

function getDomain(rawUrl: string): string {
  try {
    const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    return new URL(url).hostname;
  } catch {
    return rawUrl;
  }
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export default function Newtab() {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getStorageItem<TabItem[]>(STORAGE_KEY, DEFAULT_TABS).then((savedTabs) => {
      setTabs(savedTabs);
      setIsLoaded(true);
    });
  }, []);

  const saveTabs = (newTabs: TabItem[]) => {
    setTabs(newTabs);
    setStorageItem(STORAGE_KEY, newTabs);
  };

  const handleOpenTab = (targetUrl: string) => {
    window.location.href = normalizeUrl(targetUrl);
  };

  const handleAddTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const normalizedUrl = normalizeUrl(url);
    const domain = getDomain(normalizedUrl);
    const resolvedTitle = title.trim() || domain;

    const newTab: TabItem = {
      id: Date.now().toString(),
      title: resolvedTitle,
      url: normalizedUrl,
    };

    const updated = [...tabs, newTab];
    saveTabs(updated);

    setTitle('');
    setUrl('');
    setIsModalOpen(false);
  };

  const handleDeleteTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = tabs.filter((tab) => tab.id !== id);
    saveTabs(updated);
  };

  const handleFaviconError = (id: string) => {
    setFailedFavicons((prev) => ({ ...prev, [id]: true }));
  };

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#0d1117]" />;
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex items-center justify-center p-6 select-none font-sans">
      <main className="w-full max-w-4xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {tabs.map((tab) => {
            const domain = getDomain(tab.url);
            const hasFaviconError = failedFavicons[tab.id];

            return (
              <div
                key={tab.id}
                onClick={() => handleOpenTab(tab.url)}
                className="group relative flex flex-col items-center justify-center p-5 rounded-2xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteTab(tab.id, e)}
                  title="Удалить вкладку"
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs"
                >
                  ✕
                </button>

                {/* Favicon / Icon */}
                <div className="w-12 h-12 rounded-xl bg-neutral-800/90 flex items-center justify-center mb-3 overflow-hidden shadow-inner">
                  {!hasFaviconError ? (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                      alt={tab.title}
                      className="w-7 h-7 object-contain"
                      onError={() => handleFaviconError(tab.id)}
                    />
                  ) : (
                    <span className="text-lg font-semibold text-neutral-300">
                      {tab.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Title */}
                <span className="text-sm font-medium text-neutral-200 group-hover:text-white truncate w-full text-center px-1">
                  {tab.title}
                </span>
              </div>
            );
          })}

          {/* Add Tab Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900/40 text-neutral-400 hover:text-white transition-all duration-200 cursor-pointer min-h-[128px] group"
          >
            <div className="w-12 h-12 rounded-xl bg-neutral-800/40 group-hover:bg-neutral-800 flex items-center justify-center mb-3 transition-colors">
              <span className="text-2xl font-light leading-none">+</span>
            </div>
            <span className="text-sm font-medium">Добавить</span>
          </button>
        </div>
      </main>

      {/* Modal: Add Tab */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">Добавить вкладку</h2>

            <form onSubmit={handleAddTab} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  URL адрес *
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="github.com или https://..."
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Название (необязательно)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: GitHub"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800/80 border border-neutral-700 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-neutral-500 transition-colors"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow cursor-pointer"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
