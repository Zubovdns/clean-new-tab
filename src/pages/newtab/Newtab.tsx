import React, { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '@utils/storage';

export interface TabItem {
  id: string;
  title: string;
  url: string;
}

export interface FolderItem {
  id: string;
  title: string;
  type: 'folder';
  tabs: TabItem[];
}

export interface StandaloneTabItem extends TabItem {
  type: 'tab';
}

export type DashboardItem = FolderItem | StandaloneTabItem;

const STORAGE_KEY = 'brave_user_dashboard_items_v2';

const DEFAULT_ITEMS: DashboardItem[] = [
  { id: '1', type: 'tab', title: 'GitHub', url: 'https://github.com' },
  { id: '2', type: 'tab', title: 'Brave Search', url: 'https://search.brave.com' },
  {
    id: '3',
    type: 'folder',
    title: 'Медиа',
    tabs: [
      { id: '3-1', title: 'YouTube', url: 'https://youtube.com' },
      { id: '3-2', title: 'Reddit', url: 'https://reddit.com' },
    ],
  },
  { id: '4', type: 'tab', title: 'ChatGPT', url: 'https://chatgpt.com' },
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
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Folder open state
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isEditingFolderTitle, setIsEditingFolderTitle] = useState(false);
  const [folderTitleInput, setFolderTitleInput] = useState('');

  // Modals state
  const [modalMode, setModalMode] = useState<'none' | 'add_tab' | 'add_folder'>('none');
  const [targetFolderIdForNewTab, setTargetFolderIdForNewTab] = useState<string | null>(null);
  const [newTabUrl, setNewTabUrl] = useState('');
  const [newTabTitle, setNewTabTitle] = useState('');
  const [newFolderTitle, setNewFolderTitle] = useState('');

  // Move tab to folder state
  const [movingTabId, setMovingTabId] = useState<string | null>(null);

  // Favicon errors cache
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getStorageItem<DashboardItem[]>(STORAGE_KEY, DEFAULT_ITEMS).then((loaded) => {
      // Normalize loaded items if coming from older schema
      const normalized = (loaded || []).map((item) => {
        if (!('type' in item)) {
          return { ...(item as TabItem), type: 'tab' } as StandaloneTabItem;
        }
        return item;
      });
      setItems(normalized.length ? normalized : DEFAULT_ITEMS);
      setIsLoaded(true);
    });
  }, []);

  // Handle ESC key to close open folder or modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalMode !== 'none') {
          setModalMode('none');
        } else if (activeFolderId) {
          setActiveFolderId(null);
          setIsEditingFolderTitle(false);
        } else if (movingTabId) {
          setMovingTabId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalMode, activeFolderId, movingTabId]);

  const saveItems = (newItems: DashboardItem[]) => {
    setItems(newItems);
    setStorageItem(STORAGE_KEY, newItems);
  };

  const handleOpenUrl = (url: string) => {
    window.location.href = normalizeUrl(url);
  };

  const handleFaviconError = (id: string) => {
    setFailedFavicons((prev) => ({ ...prev, [id]: true }));
  };

  // Open add tab modal
  const openAddTabModal = (folderId: string | null = null) => {
    setTargetFolderIdForNewTab(folderId);
    setNewTabUrl('');
    setNewTabTitle('');
    setModalMode('add_tab');
  };

  // Open add folder modal
  const openAddFolderModal = () => {
    setNewFolderTitle('');
    setModalMode('add_folder');
  };

  // Submit adding new tab
  const handleAddTabSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTabUrl.trim()) return;

    const normalizedUrl = normalizeUrl(newTabUrl);
    const domain = getDomain(normalizedUrl);
    const resolvedTitle = newTabTitle.trim() || domain;

    const newTab: TabItem = {
      id: Date.now().toString(),
      title: resolvedTitle,
      url: normalizedUrl,
    };

    if (targetFolderIdForNewTab) {
      // Add tab inside the selected folder
      const updated = items.map((item) => {
        if (item.id === targetFolderIdForNewTab && item.type === 'folder') {
          return { ...item, tabs: [...item.tabs, newTab] };
        }
        return item;
      });
      saveItems(updated);
    } else {
      // Add tab to root level
      const updated: DashboardItem[] = [...items, { ...newTab, type: 'tab' }];
      saveItems(updated);
    }

    setModalMode('none');
    setTargetFolderIdForNewTab(null);
  };

  // Submit adding new folder
  const handleAddFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newFolderTitle.trim() || 'Новая папка';
    const newFolder: FolderItem = {
      id: Date.now().toString(),
      title,
      type: 'folder',
      tabs: [],
    };
    saveItems([...items, newFolder]);
    setModalMode('none');
    setNewFolderTitle('');
  };

  // Delete root item (tab or folder)
  const handleDeleteRootItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = items.filter((item) => item.id !== id);
    saveItems(updated);
    if (activeFolderId === id) setActiveFolderId(null);
  };

  // Delete tab from folder
  const handleDeleteTabFromFolder = (folderId: string, tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = items.map((item) => {
      if (item.id === folderId && item.type === 'folder') {
        return {
          ...item,
          tabs: item.tabs.filter((t) => t.id !== tabId),
        };
      }
      return item;
    });
    saveItems(updated);
  };

  // Move tab from folder to root
  const handleMoveTabToRoot = (folderId: string, tab: TabItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedFolderItems = items.map((item) => {
      if (item.id === folderId && item.type === 'folder') {
        return {
          ...item,
          tabs: item.tabs.filter((t) => t.id !== tab.id),
        };
      }
      return item;
    });
    const updated: DashboardItem[] = [...updatedFolderItems, { ...tab, type: 'tab' }];
    saveItems(updated);
  };

  // Move root tab into a selected folder
  const handleMoveTabIntoFolder = (tabId: string, destinationFolderId: string) => {
    const tabToMove = items.find((item) => item.id === tabId && item.type === 'tab') as StandaloneTabItem | undefined;
    if (!tabToMove) return;

    const remainingItems = items.filter((item) => item.id !== tabId);
    const updated = remainingItems.map((item) => {
      if (item.id === destinationFolderId && item.type === 'folder') {
        return {
          ...item,
          tabs: [...item.tabs, { id: tabToMove.id, title: tabToMove.title, url: tabToMove.url }],
        };
      }
      return item;
    });
    saveItems(updated);
    setMovingTabId(null);
  };

  // Rename folder
  const handleSaveFoldertitle = (folderId: string) => {
    const trimmed = folderTitleInput.trim();
    if (trimmed) {
      const updated = items.map((item) => {
        if (item.id === folderId && item.type === 'folder') {
          return { ...item, title: trimmed };
        }
        return item;
      });
      saveItems(updated);
    }
    setIsEditingFolderTitle(false);
  };

  const activeFolder = items.find((item) => item.id === activeFolderId && item.type === 'folder') as FolderItem | undefined;
  const foldersList = items.filter((item): item is FolderItem => item.type === 'folder');

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#0d1015]" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#141720] via-[#0d1017] to-[#090b10] text-white flex flex-col items-center justify-center p-6 select-none font-sans overflow-x-hidden">
      {/* Top Action Bar */}
      <div className="fixed top-5 right-6 flex items-center gap-2 z-20">
        <button
          type="button"
          onClick={() => openAddTabModal(null)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-medium text-neutral-200 hover:text-white backdrop-blur-md shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
        >
          <span className="text-sm leading-none">+</span>
          <span>Вкладка</span>
        </button>

        <button
          type="button"
          onClick={openAddFolderModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-medium text-neutral-200 hover:text-white backdrop-blur-md shadow-sm transition-all duration-200 cursor-pointer active:scale-95"
        >
          <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>Папка</span>
        </button>
      </div>

      {/* Main Grid: Launchpad style */}
      <main className="w-full max-w-4xl py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
          {items.map((item) => {
            if (item.type === 'folder') {
              // Folder Tile (macOS Launchpad folder squircle with 2x2 preview)
              const previewTabs = item.tabs.slice(0, 4);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveFolderId(item.id);
                    setFolderTitleInput(item.title);
                  }}
                  className="macos-tile group relative flex flex-col items-center justify-center p-4 rounded-3xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] backdrop-blur-xl shadow-lg cursor-pointer"
                >
                  {/* Delete folder button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRootItem(item.id, e)}
                    title="Удалить папку"
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-neutral-800/90 text-neutral-400 hover:text-white hover:bg-rose-600 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs shadow cursor-pointer z-10"
                  >
                    ✕
                  </button>

                  {/* 2x2 Launchpad Folder Icon */}
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.07] border border-white/[0.12] p-1.5 grid grid-cols-2 gap-1.5 items-center justify-center mb-2.5 shadow-inner backdrop-blur-md">
                    {previewTabs.length > 0 ? (
                      previewTabs.map((t) => {
                        const domain = getDomain(t.url);
                        return (
                          <div key={t.id} className="w-5 h-5 rounded-md bg-white/[0.08] flex items-center justify-center overflow-hidden">
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                              alt=""
                              className="w-3.5 h-3.5 object-contain"
                              onError={() => handleFaviconError(t.id)}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <div className="col-span-2 row-span-2 flex items-center justify-center text-neutral-500">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Folder Title & Count */}
                  <span className="text-sm font-medium text-neutral-200 group-hover:text-white truncate w-full text-center px-1">
                    {item.title}
                  </span>
                  <span className="text-[11px] text-neutral-500 font-normal mt-0.5">
                    {item.tabs.length} {item.tabs.length === 1 ? 'вкладка' : item.tabs.length >= 2 && item.tabs.length <= 4 ? 'вкладки' : 'вкладок'}
                  </span>
                </div>
              );
            }

            // Standalone Tab Tile
            const domain = getDomain(item.url);
            const hasFaviconError = failedFavicons[item.id];

            return (
              <div
                key={item.id}
                onClick={() => handleOpenUrl(item.url)}
                className="macos-tile group relative flex flex-col items-center justify-center p-4 rounded-3xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] backdrop-blur-xl shadow-lg cursor-pointer"
              >
                {/* Actions: Move to folder & Delete */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {foldersList.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMovingTabId(movingTabId === item.id ? null : item.id);
                      }}
                      title="Переместить в папку"
                      className="w-6 h-6 rounded-full bg-neutral-800/90 text-neutral-400 hover:text-white hover:bg-indigo-600 transition-colors flex items-center justify-center text-[10px] shadow cursor-pointer"
                    >
                      📁
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRootItem(item.id, e)}
                    title="Удалить"
                    className="w-6 h-6 rounded-full bg-neutral-800/90 text-neutral-400 hover:text-white hover:bg-rose-600 transition-colors flex items-center justify-center text-xs shadow cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Move Tab Dropdown */}
                {movingTabId === item.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-10 right-2 w-44 rounded-2xl macos-glass p-2 shadow-2xl z-30 animate-macos-modal"
                  >
                    <div className="text-[11px] font-semibold text-neutral-400 px-2 py-1 mb-1">
                      Переместить в:
                    </div>
                    {foldersList.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => handleMoveTabIntoFolder(item.id, folder.id)}
                        className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-xs text-neutral-200 truncate flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <span>📁</span>
                        <span className="truncate">{folder.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Icon Container */}
                <div className="w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/[0.1] flex items-center justify-center mb-2.5 overflow-hidden shadow-inner backdrop-blur-md">
                  {!hasFaviconError ? (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                      alt={item.title}
                      className="w-8 h-8 object-contain"
                      onError={() => handleFaviconError(item.id)}
                    />
                  ) : (
                    <span className="text-xl font-medium text-neutral-200">
                      {item.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Title */}
                <span className="text-sm font-medium text-neutral-200 group-hover:text-white truncate w-full text-center px-1">
                  {item.title}
                </span>
                <span className="text-[11px] text-neutral-500 font-normal mt-0.5 truncate max-w-full px-1">
                  {domain}
                </span>
              </div>
            );
          })}

          {/* "+ Добавить" Tile */}
          <button
            type="button"
            onClick={() => openAddTabModal(null)}
            className="macos-tile flex flex-col items-center justify-center p-4 rounded-3xl border-2 border-dashed border-white/[0.1] hover:border-white/[0.25] hover:bg-white/[0.03] text-neutral-400 hover:text-white transition-all duration-200 cursor-pointer min-h-[140px] group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center mb-2.5 transition-colors">
              <span className="text-2xl font-light leading-none">+</span>
            </div>
            <span className="text-sm font-medium">Добавить</span>
          </button>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* macOS FOLDER POPUP (Launchpad style expansion) */}
      {/* ========================================================================= */}
      {activeFolder && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-2xl flex items-center justify-center p-6 z-50 animate-macos-backdrop"
          onClick={() => {
            setActiveFolderId(null);
            setIsEditingFolderTitle(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl macos-glass rounded-[28px] p-6 sm:p-8 shadow-2xl animate-macos-modal relative"
          >
            {/* macOS Window Title Bar */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.08]">
              {/* Traffic Light Close Button */}
              <button
                type="button"
                onClick={() => {
                  setActiveFolderId(null);
                  setIsEditingFolderTitle(false);
                }}
                className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-rose-500/80 hover:text-white text-neutral-400 flex items-center justify-center text-xs transition-colors cursor-pointer"
                title="Закрыть (Esc)"
              >
                ✕
              </button>

              {/* Editable Folder Title */}
              <div className="flex items-center gap-2">
                {isEditingFolderTitle ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={folderTitleInput}
                      onChange={(e) => setFolderTitleInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveFoldertitle(activeFolder.id);
                        if (e.key === 'Escape') setIsEditingFolderTitle(false);
                      }}
                      autoFocus
                      className="px-3 py-1 rounded-xl bg-white/[0.1] border border-white/[0.2] text-white text-base font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveFoldertitle(activeFolder.id)}
                      className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-medium cursor-pointer"
                    >
                      Сохранить
                    </button>
                  </div>
                ) : (
                  <h2
                    onClick={() => setIsEditingFolderTitle(true)}
                    className="text-lg font-semibold text-white tracking-tight cursor-pointer hover:opacity-80 flex items-center gap-2 group"
                    title="Нажмите для переименования"
                  >
                    <span>{activeFolder.title}</span>
                    <span className="opacity-0 group-hover:opacity-60 text-xs">✏️</span>
                  </h2>
                )}
              </div>

              {/* Quick Add inside folder */}
              <button
                type="button"
                onClick={() => openAddTabModal(activeFolder.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.1] hover:bg-white/[0.18] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <span>+</span>
                <span>Вкладка</span>
              </button>
            </div>

            {/* Grid inside Folder */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1">
              {activeFolder.tabs.map((tab) => {
                const domain = getDomain(tab.url);
                const hasFaviconError = failedFavicons[tab.id];

                return (
                  <div
                    key={tab.id}
                    onClick={() => handleOpenUrl(tab.url)}
                    className="macos-tile group relative flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] cursor-pointer"
                  >
                    {/* Action buttons on tab */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        type="button"
                        onClick={(e) => handleMoveTabToRoot(activeFolder.id, tab, e)}
                        title="Вынести из папки"
                        className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-indigo-600 transition-colors flex items-center justify-center text-[10px] cursor-pointer"
                      >
                        ↗
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTabFromFolder(activeFolder.id, tab.id, e)}
                        title="Удалить"
                        className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 hover:text-white hover:bg-rose-600 transition-colors flex items-center justify-center text-[10px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Icon */}
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center mb-2 overflow-hidden shadow-inner">
                      {!hasFaviconError ? (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                          alt={tab.title}
                          className="w-7 h-7 object-contain"
                          onError={() => handleFaviconError(tab.id)}
                        />
                      ) : (
                        <span className="text-base font-medium text-neutral-200">
                          {tab.title.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <span className="text-xs font-medium text-neutral-200 group-hover:text-white truncate w-full text-center px-1">
                      {tab.title}
                    </span>
                    <span className="text-[10px] text-neutral-500 truncate max-w-full px-1">
                      {domain}
                    </span>
                  </div>
                );
              })}

              {/* Add Tab inside Folder card */}
              <button
                type="button"
                onClick={() => openAddTabModal(activeFolder.id)}
                className="macos-tile flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.03] text-neutral-400 hover:text-white transition-all duration-200 cursor-pointer min-h-[110px] group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center mb-2 transition-colors">
                  <span className="text-xl font-light leading-none">+</span>
                </div>
                <span className="text-xs font-medium">Добавить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* macOS MODAL: ADD TAB */}
      {/* ========================================================================= */}
      {modalMode === 'add_tab' && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-macos-backdrop"
          onClick={() => setModalMode('none')}
        >
          <div
            className="macos-glass rounded-[24px] p-6 max-w-sm w-full shadow-2xl space-y-4 animate-macos-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h2 className="text-base font-semibold text-white tracking-tight">
                {targetFolderIdForNewTab ? 'Добавить вкладку в папку' : 'Новая вкладка'}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode('none')}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTabSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  URL адрес *
                </label>
                <input
                  type="text"
                  value={newTabUrl}
                  onChange={(e) => setNewTabUrl(e.target.value)}
                  placeholder="github.com или https://..."
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Название (необязательно)
                </label>
                <input
                  type="text"
                  value={newTabTitle}
                  onChange={(e) => setNewTabTitle(e.target.value)}
                  placeholder="Например: GitHub"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>

              {/* Optional folder selector if creating from root */}
              {!targetFolderIdForNewTab && foldersList.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1">
                    Поместить в папку (необязательно)
                  </label>
                  <select
                    value={targetFolderIdForNewTab || ''}
                    onChange={(e) => setTargetFolderIdForNewTab(e.target.value || null)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#1e2028] border border-white/[0.12] text-white text-sm focus:outline-none focus:border-white/30 cursor-pointer"
                  >
                    <option value="">На главный экран (без папки)</option>
                    {foldersList.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode('none')}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* macOS MODAL: ADD FOLDER */}
      {/* ========================================================================= */}
      {modalMode === 'add_folder' && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-macos-backdrop"
          onClick={() => setModalMode('none')}
        >
          <div
            className="macos-glass rounded-[24px] p-6 max-w-sm w-full shadow-2xl space-y-4 animate-macos-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <h2 className="text-base font-semibold text-white tracking-tight">Новая папка</h2>
              <button
                type="button"
                onClick={() => setModalMode('none')}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddFolderSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Название папки
                </label>
                <input
                  type="text"
                  value={newFolderTitle}
                  onChange={(e) => setNewFolderTitle(e.target.value)}
                  placeholder="Например: Работа, Медиа, Разработка"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode('none')}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
