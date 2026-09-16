import React, { useState, useEffect, useRef } from 'react';
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

interface DraggedItemState {
  source: 'root' | 'folder';
  id: string;
  itemType: 'tab' | 'folder';
  folderId?: string;
  index: number;
}

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

  // Favicon errors cache
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  // Drag and Drop state
  const [draggedItem, setDraggedItem] = useState<DraggedItemState | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRootIndex, setDragOverRootIndex] = useState<number | null>(null);
  const [dragOverFolderTabIndex, setDragOverFolderTabIndex] = useState<number | null>(null);
  const [isDragOverBackdrop, setIsDragOverBackdrop] = useState(false);

  // Ref to prevent click navigation when dragging ends
  const isDraggingRef = useRef(false);

  useEffect(() => {
    getStorageItem<DashboardItem[]>(STORAGE_KEY, DEFAULT_ITEMS).then((loaded) => {
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

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modalMode !== 'none') {
          setModalMode('none');
        } else if (activeFolderId) {
          setActiveFolderId(null);
          setIsEditingFolderTitle(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalMode, activeFolderId]);

  const saveItems = (newItems: DashboardItem[]) => {
    setItems(newItems);
    setStorageItem(STORAGE_KEY, newItems);
  };

  const handleOpenUrl = (url: string) => {
    if (isDraggingRef.current) return;
    window.location.href = normalizeUrl(url);
  };

  const handleFolderClick = (folderId: string, folderTitle: string) => {
    if (isDraggingRef.current) return;
    setActiveFolderId(folderId);
    setFolderTitleInput(folderTitle);
  };

  const handleFaviconError = (id: string) => {
    setFailedFavicons((prev) => ({ ...prev, [id]: true }));
  };

  const openAddTabModal = (folderId: string | null = null) => {
    setTargetFolderIdForNewTab(folderId);
    setNewTabUrl('');
    setNewTabTitle('');
    setModalMode('add_tab');
  };

  const openAddFolderModal = () => {
    setNewFolderTitle('');
    setModalMode('add_folder');
  };

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
      const updated = items.map((item) => {
        if (item.id === targetFolderIdForNewTab && item.type === 'folder') {
          return { ...item, tabs: [...item.tabs, newTab] };
        }
        return item;
      });
      saveItems(updated);
    } else {
      const updated: DashboardItem[] = [...items, { ...newTab, type: 'tab' }];
      saveItems(updated);
    }

    setModalMode('none');
    setTargetFolderIdForNewTab(null);
  };

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

  const handleDeleteRootItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = items.filter((item) => item.id !== id);
    saveItems(updated);
    if (activeFolderId === id) setActiveFolderId(null);
  };

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

  const handleMoveTabToRoot = (folderId: string, tab: TabItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  // =========================================================================
  // DRAG AND DROP
  // =========================================================================

  const handleRootDragStart = (e: React.DragEvent, item: DashboardItem, index: number) => {
    isDraggingRef.current = true;
    const dragData: DraggedItemState = {
      source: 'root',
      id: item.id,
      itemType: item.type,
      index,
    };
    setDraggedItem(dragData);
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderTabDragStart = (e: React.DragEvent, tab: TabItem, folderId: string, index: number) => {
    isDraggingRef.current = true;
    const dragData: DraggedItemState = {
      source: 'folder',
      id: tab.id,
      itemType: 'tab',
      folderId,
      index,
    };
    setDraggedItem(dragData);
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverFolderId(null);
    setDragOverRootIndex(null);
    setDragOverFolderTabIndex(null);
    setIsDragOverBackdrop(false);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 60);
  };

  const handleFolderCardDragOver = (e: React.DragEvent, folderId: string) => {
    if (!draggedItem || draggedItem.id === folderId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleFolderCardDragLeave = (e: React.DragEvent, folderId: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverFolderId === folderId) {
        setDragOverFolderId(null);
      }
    }
  };

  const handleDropOnFolder = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem) return;

    if (draggedItem.itemType === 'tab' && draggedItem.id !== targetFolderId) {
      if (draggedItem.source === 'root') {
        const tabToMove = items.find((it) => it.id === draggedItem.id && it.type === 'tab') as StandaloneTabItem | undefined;
        if (!tabToMove) return;

        const filtered = items.filter((it) => it.id !== draggedItem.id);
        const updated = filtered.map((it) => {
          if (it.id === targetFolderId && it.type === 'folder') {
            return {
              ...it,
              tabs: [...it.tabs, { id: tabToMove.id, title: tabToMove.title, url: tabToMove.url }],
            };
          }
          return it;
        });
        saveItems(updated);
      } else if (draggedItem.source === 'folder' && draggedItem.folderId && draggedItem.folderId !== targetFolderId) {
        const sourceFolder = items.find((it) => it.id === draggedItem.folderId && it.type === 'folder') as FolderItem | undefined;
        const tabToMove = sourceFolder?.tabs.find((t) => t.id === draggedItem.id);
        if (!tabToMove) return;

        const updated = items.map((it) => {
          if (it.id === draggedItem.folderId && it.type === 'folder') {
            return { ...it, tabs: it.tabs.filter((t) => t.id !== draggedItem.id) };
          }
          if (it.id === targetFolderId && it.type === 'folder') {
            return { ...it, tabs: [...it.tabs, tabToMove] };
          }
          return it;
        });
        saveItems(updated);
      }
    }

    handleDragEnd();
  };

  const handleRootCardDragOver = (e: React.DragEvent, index: number) => {
    if (!draggedItem || draggedItem.source !== 'root') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverRootIndex !== index) {
      setDragOverRootIndex(index);
    }
  };

  const handleRootCardDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem || draggedItem.source !== 'root') return;
    const sourceIndex = draggedItem.index;

    if (sourceIndex !== targetIndex) {
      const newItems = [...items];
      const [movedItem] = newItems.splice(sourceIndex, 1);
      newItems.splice(targetIndex, 0, movedItem);
      saveItems(newItems);
    }

    handleDragEnd();
  };

  const handleFolderTabDragOver = (e: React.DragEvent, index: number) => {
    if (!draggedItem || draggedItem.source !== 'folder') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderTabIndex !== index) {
      setDragOverFolderTabIndex(index);
    }
  };

  const handleFolderTabDrop = (e: React.DragEvent, folderId: string, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedItem || draggedItem.source !== 'folder' || draggedItem.folderId !== folderId) return;
    const sourceIndex = draggedItem.index;

    if (sourceIndex !== targetIndex) {
      const updated = items.map((it) => {
        if (it.id === folderId && it.type === 'folder') {
          const newTabs = [...it.tabs];
          const [movedTab] = newTabs.splice(sourceIndex, 1);
          newTabs.splice(targetIndex, 0, movedTab);
          return { ...it, tabs: newTabs };
        }
        return it;
      });
      saveItems(updated);
    }

    handleDragEnd();
  };

  const handleBackdropDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItem && draggedItem.source === 'folder' && draggedItem.folderId) {
      const folder = items.find((it) => it.id === draggedItem.folderId && it.type === 'folder') as FolderItem | undefined;
      const tabToMove = folder?.tabs.find((t) => t.id === draggedItem.id);
      if (tabToMove) {
        handleMoveTabToRoot(draggedItem.folderId, tabToMove);
      }
    }
    handleDragEnd();
  };

  const activeFolder = items.find((item) => item.id === activeFolderId && item.type === 'folder') as FolderItem | undefined;
  const foldersList = items.filter((item): item is FolderItem => item.type === 'folder');

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#111318]" />;
  }

  return (
    <div className="min-h-screen bg-[#111318] text-[#e2e2e9] flex flex-col items-center justify-center p-6 select-none font-sans overflow-x-hidden">
      {/* Top Action Bar (Material 3 FABs) */}
      <div className="fixed top-6 right-6 flex items-center gap-3 z-20">
        <button
          type="button"
          onClick={() => openAddTabModal(null)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#004a77] hover:bg-[#005c94] text-[#c2e7ff] text-sm font-medium shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Вкладка</span>
        </button>

        <button
          type="button"
          onClick={openAddFolderModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#272a32] hover:bg-[#313540] text-[#e2e2e9] text-sm font-medium shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <svg className="w-4 h-4 text-[#a8c7fa]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span>Папка</span>
        </button>
      </div>

      {/* Main Grid (Material 3 Cards) */}
      <main className="w-full max-w-4xl py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 sm:gap-6">
          {items.map((item, index) => {
            const isBeingDragged = draggedItem?.id === item.id;
            const isFolderDropTarget = dragOverFolderId === item.id;
            const isReorderTarget = dragOverRootIndex === index && draggedItem?.id !== item.id && !isFolderDropTarget;

            if (item.type === 'folder') {
              // MATERIAL 3 FOLDER TILE
              const previewTabs = item.tabs.slice(0, 4);

              return (
                <div
                  key={item.id}
                  draggable={true}
                  onDragStart={(e) => handleRootDragStart(e, item, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleFolderCardDragOver(e, item.id)}
                  onDragLeave={(e) => handleFolderCardDragLeave(e, item.id)}
                  onDrop={(e) => handleDropOnFolder(e, item.id)}
                  onClick={() => handleFolderClick(item.id, item.title)}
                  className={`md-card group relative flex flex-col items-center justify-center p-5 rounded-[24px] cursor-pointer select-none border border-transparent ${
                    isBeingDragged ? 'md-card-dragging' : ''
                  } ${
                    isFolderDropTarget
                      ? 'animate-md-drop bg-[#004a77]/40 ring-4 ring-[#a8c7fa] border-[#a8c7fa] shadow-2xl z-20'
                      : isReorderTarget
                      ? 'border-2 border-dashed border-[#a8c7fa] bg-[#1d2026]'
                      : 'border-[#33363f]/50'
                  }`}
                >
                  {/* Material Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRootItem(item.id, e)}
                    title="Удалить папку"
                    className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#2a2e37] text-[#c4c7c5] hover:text-[#ffdad6] hover:bg-[#ba1a1a] transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs shadow-md cursor-pointer z-10"
                  >
                    ✕
                  </button>

                  {/* Drop Target Badge */}
                  {isFolderDropTarget && (
                    <div className="absolute -top-3.5 px-3 py-1 rounded-full bg-[#a8c7fa] text-[#062e6f] text-xs font-semibold tracking-wide shadow-md animate-bounce pointer-events-none z-30">
                      В папку
                    </div>
                  )}

                  {/* 2x2 Folder Thumbnail */}
                  <div className={`w-14 h-14 rounded-2xl p-1.5 grid grid-cols-2 gap-1.5 items-center justify-center mb-3 shadow-inner transition-all ${
                    isFolderDropTarget ? 'bg-[#004a77] border-2 border-[#a8c7fa]' : 'bg-[#292c35]'
                  }`}>
                    {previewTabs.length > 0 ? (
                      previewTabs.map((t) => {
                        const domain = getDomain(t.url);
                        return (
                          <div key={t.id} className="w-5 h-5 rounded-lg bg-[#383d49] flex items-center justify-center overflow-hidden pointer-events-none">
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
                      <div className="col-span-2 row-span-2 flex items-center justify-center text-[#a8c7fa] pointer-events-none">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Folder Title & Count */}
                  <span className="text-sm font-medium text-[#e2e2e9] group-hover:text-white truncate w-full text-center px-1 pointer-events-none">
                    {item.title}
                  </span>
                  <span className="text-xs text-[#8e9199] font-normal mt-0.5 pointer-events-none">
                    {item.tabs.length} {item.tabs.length === 1 ? 'вкладка' : item.tabs.length >= 2 && item.tabs.length <= 4 ? 'вкладки' : 'вкладок'}
                  </span>
                </div>
              );
            }

            // MATERIAL 3 TAB TILE
            const domain = getDomain(item.url);
            const hasFaviconError = failedFavicons[item.id];

            return (
              <div
                key={item.id}
                draggable={true}
                onDragStart={(e) => handleRootDragStart(e, item, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleRootCardDragOver(e, index)}
                onDrop={(e) => handleRootCardDrop(e, index)}
                onClick={() => handleOpenUrl(item.url)}
                className={`md-card group relative flex flex-col items-center justify-center p-5 rounded-[24px] cursor-pointer select-none border border-transparent ${
                  isBeingDragged ? 'md-card-dragging' : ''
                } ${
                  isReorderTarget
                    ? 'border-2 border-dashed border-[#a8c7fa] bg-[#1d2026] scale-102'
                    : 'border-[#33363f]/50'
                }`}
              >
                {/* Delete button */}
                <div className="absolute top-3 right-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteRootItem(item.id, e)}
                    title="Удалить вкладку"
                    className="w-7 h-7 rounded-full bg-[#2a2e37] text-[#c4c7c5] hover:text-[#ffdad6] hover:bg-[#ba1a1a] transition-all flex items-center justify-center text-xs shadow-md cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Favicon Container */}
                <div className="w-14 h-14 rounded-2xl bg-[#282c36] flex items-center justify-center mb-3 overflow-hidden shadow-inner pointer-events-none">
                  {!hasFaviconError ? (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                      alt={item.title}
                      className="w-8 h-8 object-contain"
                      onError={() => handleFaviconError(item.id)}
                    />
                  ) : (
                    <span className="text-xl font-medium text-[#a8c7fa]">
                      {item.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Title & Domain */}
                <span className="text-sm font-medium text-[#e2e2e9] group-hover:text-white truncate w-full text-center px-1 pointer-events-none">
                  {item.title}
                </span>
                <span className="text-xs text-[#8e9199] font-normal mt-0.5 truncate max-w-full px-1 pointer-events-none">
                  {domain}
                </span>
              </div>
            );
          })}

          {/* "+ Добавить" Outlined Tile */}
          <button
            type="button"
            onClick={() => openAddTabModal(null)}
            className="flex flex-col items-center justify-center p-5 rounded-[24px] border-2 border-dashed border-[#44474f] hover:border-[#a8c7fa] hover:bg-[#1d2026] text-[#8e9199] hover:text-[#a8c7fa] transition-all duration-200 cursor-pointer min-h-[148px] group"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#242730] group-hover:bg-[#2d323e] flex items-center justify-center mb-3 transition-colors text-xl font-light">
              +
            </div>
            <span className="text-sm font-medium">Добавить</span>
          </button>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MATERIAL 3 FOLDER DIALOG */}
      {/* ========================================================================= */}
      {activeFolder && (
        <div
          onDragOver={(e) => {
            if (draggedItem?.source === 'folder') {
              e.preventDefault();
              setIsDragOverBackdrop(true);
            }
          }}
          onDragLeave={() => setIsDragOverBackdrop(false)}
          onDrop={handleBackdropDrop}
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50 animate-md-scrim"
          onClick={() => {
            setActiveFolderId(null);
            setIsEditingFolderTitle(false);
          }}
        >
          {/* Visual prompt when dragging tab out of folder */}
          {draggedItem?.source === 'folder' && (
            <div className={`fixed top-8 px-6 py-3 rounded-full transition-all pointer-events-none z-60 ${
              isDragOverBackdrop
                ? 'bg-[#a8c7fa] text-[#062e6f] font-semibold shadow-xl scale-105'
                : 'bg-[#1f232c] text-[#c2e7ff] border border-[#a8c7fa]/30 shadow-lg'
            }`}>
              <span className="text-sm">
                {isDragOverBackdrop ? 'Отпустите, чтобы вынести на главный экран' : 'Перетащите сюда, чтобы вынести на главный экран'}
              </span>
            </div>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl md-dialog rounded-[28px] p-6 sm:p-8 animate-md-dialog relative"
          >
            {/* Folder Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#33363f]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2e3340] text-[#a8c7fa] flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>

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
                      className="px-3 py-1 rounded-lg bg-[#191c22] border border-[#a8c7fa] text-white text-lg font-medium focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveFoldertitle(activeFolder.id)}
                      className="md-btn-primary px-3 py-1 rounded-full text-xs font-semibold cursor-pointer"
                    >
                      Сохранить
                    </button>
                  </div>
                ) : (
                  <h2
                    onClick={() => setIsEditingFolderTitle(true)}
                    className="text-xl font-normal text-[#e2e2e9] cursor-pointer hover:text-white flex items-center gap-2 group"
                    title="Нажмите для переименования"
                  >
                    <span>{activeFolder.title}</span>
                    <span className="opacity-0 group-hover:opacity-60 text-xs">✏️</span>
                  </h2>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAddTabModal(activeFolder.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full md-btn-primary text-xs font-semibold cursor-pointer"
                >
                  <span>+</span>
                  <span>Вкладка</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFolderId(null);
                    setIsEditingFolderTitle(false);
                  }}
                  className="w-10 h-10 rounded-full hover:bg-white/10 text-[#c4c7c5] hover:text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                  title="Закрыть (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Grid inside Folder */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1">
              {activeFolder.tabs.map((tab, idx) => {
                const domain = getDomain(tab.url);
                const hasFaviconError = failedFavicons[tab.id];
                const isTabBeingDragged = draggedItem?.id === tab.id;
                const isReorderTabTarget = dragOverFolderTabIndex === idx && draggedItem?.id !== tab.id;

                return (
                  <div
                    key={tab.id}
                    draggable={true}
                    onDragStart={(e) => handleFolderTabDragStart(e, tab, activeFolder.id, idx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleFolderTabDragOver(e, idx)}
                    onDrop={(e) => handleFolderTabDrop(e, activeFolder.id, idx)}
                    onClick={() => handleOpenUrl(tab.url)}
                    className={`md-card group relative flex flex-col items-center justify-center p-4 rounded-[20px] cursor-pointer border border-[#33363f]/30 ${
                      isTabBeingDragged ? 'md-card-dragging' : ''
                    } ${
                      isReorderTabTarget
                        ? 'border-2 border-dashed border-[#a8c7fa] bg-[#2a2e38]'
                        : ''
                    }`}
                  >
                    {/* Action buttons */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        type="button"
                        onClick={(e) => handleMoveTabToRoot(activeFolder.id, tab, e)}
                        title="Вынести из папки"
                        className="w-6 h-6 rounded-full bg-[#2a2e37] text-[#c4c7c5] hover:text-white hover:bg-[#004a77] transition-colors flex items-center justify-center text-[10px] cursor-pointer"
                      >
                        ↗
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTabFromFolder(activeFolder.id, tab.id, e)}
                        title="Удалить"
                        className="w-6 h-6 rounded-full bg-[#2a2e37] text-[#c4c7c5] hover:text-[#ffdad6] hover:bg-[#ba1a1a] transition-colors flex items-center justify-center text-[10px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-[#282c36] flex items-center justify-center mb-2 overflow-hidden shadow-inner pointer-events-none">
                      {!hasFaviconError ? (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                          alt={tab.title}
                          className="w-7 h-7 object-contain"
                          onError={() => handleFaviconError(tab.id)}
                        />
                      ) : (
                        <span className="text-base font-medium text-[#a8c7fa]">
                          {tab.title.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Title & Domain */}
                    <span className="text-xs font-medium text-[#e2e2e9] group-hover:text-white truncate w-full text-center px-1 pointer-events-none">
                      {tab.title}
                    </span>
                    <span className="text-[10px] text-[#8e9199] truncate max-w-full px-1 pointer-events-none">
                      {domain}
                    </span>
                  </div>
                );
              })}

              {/* Add Tab inside Folder card */}
              <button
                type="button"
                onClick={() => openAddTabModal(activeFolder.id)}
                className="flex flex-col items-center justify-center p-4 rounded-[20px] border-2 border-dashed border-[#44474f] hover:border-[#a8c7fa] hover:bg-[#1d2026] text-[#8e9199] hover:text-[#a8c7fa] transition-all duration-200 cursor-pointer min-h-[110px] group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#242730] group-hover:bg-[#2d323e] flex items-center justify-center mb-2 transition-colors text-lg font-light">
                  +
                </div>
                <span className="text-xs font-medium">Добавить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MATERIAL 3 DIALOG: ADD TAB */}
      {/* ========================================================================= */}
      {modalMode === 'add_tab' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-md-scrim"
          onClick={() => setModalMode('none')}
        >
          <div
            className="md-dialog rounded-[28px] p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-md-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-normal text-[#e2e2e9]">
              {targetFolderIdForNewTab ? 'Добавить вкладку в папку' : 'Новая вкладка'}
            </h2>

            <form onSubmit={handleAddTabSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-[#c4c7c5] mb-1.5">
                  URL адрес *
                </label>
                <input
                  type="text"
                  value={newTabUrl}
                  onChange={(e) => setNewTabUrl(e.target.value)}
                  placeholder="github.com или https://..."
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-[#181a20] border border-[#44474f] focus:border-[#a8c7fa] focus:ring-1 focus:ring-[#a8c7fa] text-white placeholder-[#8e9199] text-sm outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#c4c7c5] mb-1.5">
                  Название (необязательно)
                </label>
                <input
                  type="text"
                  value={newTabTitle}
                  onChange={(e) => setNewTabTitle(e.target.value)}
                  placeholder="Например: GitHub"
                  className="w-full px-4 py-3 rounded-xl bg-[#181a20] border border-[#44474f] focus:border-[#a8c7fa] focus:ring-1 focus:ring-[#a8c7fa] text-white placeholder-[#8e9199] text-sm outline-none transition-colors"
                />
              </div>

              {!targetFolderIdForNewTab && foldersList.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[#c4c7c5] mb-1.5">
                    Поместить в папку (необязательно)
                  </label>
                  <select
                    value={targetFolderIdForNewTab || ''}
                    onChange={(e) => setTargetFolderIdForNewTab(e.target.value || null)}
                    className="w-full px-4 py-3 rounded-xl bg-[#181a20] border border-[#44474f] focus:border-[#a8c7fa] text-white text-sm outline-none cursor-pointer"
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

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalMode('none')}
                  className="md-btn-text px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="md-btn-primary px-6 py-2.5 rounded-full text-sm font-semibold shadow cursor-pointer"
                >
                  Добавить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MATERIAL 3 DIALOG: ADD FOLDER */}
      {/* ========================================================================= */}
      {modalMode === 'add_folder' && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-md-scrim"
          onClick={() => setModalMode('none')}
        >
          <div
            className="md-dialog rounded-[28px] p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 animate-md-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-normal text-[#e2e2e9]">Новая папка</h2>

            <form onSubmit={handleAddFolderSubmit} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-[#c4c7c5] mb-1.5">
                  Название папки *
                </label>
                <input
                  type="text"
                  value={newFolderTitle}
                  onChange={(e) => setNewFolderTitle(e.target.value)}
                  placeholder="Например: Работа, Медиа, Разработка"
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-[#181a20] border border-[#44474f] focus:border-[#a8c7fa] focus:ring-1 focus:ring-[#a8c7fa] text-white placeholder-[#8e9199] text-sm outline-none transition-colors"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalMode('none')}
                  className="md-btn-text px-5 py-2.5 rounded-full text-sm font-medium cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="md-btn-primary px-6 py-2.5 rounded-full text-sm font-semibold shadow cursor-pointer"
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
