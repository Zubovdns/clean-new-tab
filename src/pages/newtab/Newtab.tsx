import React, { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '@utils/storage';

interface QuickLink {
  id: string;
  title: string;
  url: string;
  icon?: string;
}

const DEFAULT_LINKS: QuickLink[] = [
  { id: '1', title: 'GitHub', url: 'https://github.com' },
  { id: '2', title: 'Brave Search', url: 'https://search.brave.com' },
  { id: '3', title: 'YouTube', url: 'https://youtube.com' },
  { id: '4', title: 'Reddit', url: 'https://reddit.com' },
  { id: '5', title: 'ChatGPT', url: 'https://chatgpt.com' },
];

const SEARCH_ENGINES: Record<string, { name: string; url: string }> = {
  brave: { name: 'Brave', url: 'https://search.brave.com/search?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  yandex: { name: 'Яндекс', url: 'https://yandex.ru/search/?text=' },
};

export default function Newtab() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchEngine, setSearchEngine] = useState('brave');
  const [searchQuery, setSearchQuery] = useState('');
  const [links, setLinks] = useState<QuickLink[]>(DEFAULT_LINKS);
  const [note, setNote] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Clock interval
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load saved links and notes
  useEffect(() => {
    getStorageItem<QuickLink[]>('brave_newtab_links', DEFAULT_LINKS).then(setLinks);
    getStorageItem<string>('brave_newtab_note', '').then(setNote);
    getStorageItem<string>('brave_newtab_engine', 'brave').then(setSearchEngine);
  }, []);

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNote(val);
    setStorageItem('brave_newtab_note', val);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const engine = SEARCH_ENGINES[searchEngine] || SEARCH_ENGINES.brave;
    window.location.href = `${engine.url}${encodeURIComponent(searchQuery.trim())}`;
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    let formattedUrl = newUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    const updated = [
      ...links,
      { id: Date.now().toString(), title: newTitle.trim(), url: formattedUrl },
    ];
    setLinks(updated);
    setStorageItem('brave_newtab_links', updated);
    setNewTitle('');
    setNewUrl('');
    setShowAddModal(false);
  };

  const handleDeleteLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = links.filter((link) => link.id !== id);
    setLinks(updated);
    setStorageItem('brave_newtab_links', updated);
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return 'Доброе утро';
    if (hour >= 12 && hour < 18) return 'Добрый день';
    if (hour >= 18 && hour < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  };

  const formattedTime = currentTime.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = currentTime.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 flex flex-col justify-between p-6 select-none">
      {/* Top Bar */}
      <header className="flex justify-between items-center max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Brave New Tab Extension</span>
          <span className="text-slate-500">•</span>
          <span className="text-indigo-300">v0.1.0</span>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={searchEngine}
            onChange={(e) => {
              setSearchEngine(e.target.value);
              setStorageItem('brave_newtab_engine', e.target.value);
            }}
            className="bg-white/5 border border-white/10 text-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
          >
            {Object.entries(SEARCH_ENGINES).map(([key, engine]) => (
              <option key={key} value={key} className="bg-slate-900 text-slate-200">
                Поиск: {engine.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Center Section */}
      <main className="max-w-4xl w-full mx-auto my-auto flex flex-col items-center gap-8 py-8">
        {/* Clock & Greeting */}
        <div className="text-center space-y-2">
          <h1 className="text-7xl md:text-8xl font-extralight tracking-tight text-white drop-shadow-sm font-mono">
            {formattedTime}
          </h1>
          <p className="text-lg md:text-xl font-medium text-slate-300 capitalize">
            {formattedDate}
          </p>
          <p className="text-sm md:text-base text-indigo-200/80 font-light">
            {getGreeting()}!
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Искать в ${SEARCH_ENGINES[searchEngine]?.name || 'Интернете'} или ввести URL...`}
            className="w-full py-4 pl-5 pr-14 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/15 border border-white/15 focus:border-indigo-400 backdrop-blur-xl text-white placeholder-slate-400 shadow-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all text-base"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            Искать
          </button>
        </form>

        {/* Quick Links */}
        <div className="w-full max-w-3xl">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Быстрый доступ
            </span>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              + Добавить ссылку
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="group relative flex flex-col items-center justify-center p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-400/40 backdrop-blur-md transition-all duration-200 cursor-pointer text-center"
                onClick={() => (window.location.href = link.url)}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-indigo-400/20 flex items-center justify-center text-sm font-bold text-indigo-200 mb-2 group-hover:scale-105 transition-transform">
                  {link.title.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-medium text-slate-200 truncate w-full">
                  {link.title}
                </span>

                <button
                  onClick={(e) => handleDeleteLink(link.id, e)}
                  title="Удалить"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] hidden group-hover:flex items-center justify-center shadow hover:bg-rose-500 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Scratchpad Note */}
        <div className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Быстрые заметки (сохраняются автоматически)
            </span>
            <span className="text-[10px] text-slate-500">chrome.storage.local</span>
          </div>
          <textarea
            value={note}
            onChange={handleNoteChange}
            placeholder="Напишите список задач или мысли на сегодня..."
            rows={3}
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none"
          />
        </div>
      </main>

      {/* Footer Info */}
      <footer className="flex flex-col sm:flex-row justify-between items-center gap-2 max-w-6xl w-full mx-auto text-xs text-slate-500">
        <div>
          Разработка: редактируйте{' '}
          <code className="px-1.5 py-0.5 rounded bg-white/5 text-indigo-300 font-mono">
            src/pages/newtab/Newtab.tsx
          </code>
        </div>
        <div>Стек: Vite • React 19 • TypeScript • Tailwind CSS • CRXJS (MV3)</div>
      </footer>

      {/* Add Link Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-semibold text-white">Добавить быстрый доступ</h3>
            <form onSubmit={handleAddLink} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Название</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Например: Почта"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">URL адрес</label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
