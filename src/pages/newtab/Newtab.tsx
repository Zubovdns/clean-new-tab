import React, { useState, useEffect, useRef } from 'react';
import {
  ChromeBookmark,
  ChromeFolder,
  ChromeGridItem,
  ChromeSection,
  ChromeShortcutItem,
} from '../../types';
import {
  CHROME_NTP_SECTIONS_KEY,
  CHROME_NTP_FAVICON_CACHE_KEY,
  DEFAULT_SECTIONS,
  getFaviconCache,
  loadSectionsFromStorage,
  setStorageItem,
} from '../../utils/storage';

function getDomain(rawUrl: string): string {
  try {
    const url = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `https://${rawUrl}`;
    return new URL(url).hostname;
  } catch {
    return rawUrl;
  }
}

function getRootDomain(domain: string): string {
  const parts = domain.split('.');
  if (parts.length > 2) {
    return parts.slice(-2).join('.');
  }
  return domain;
}

function getFaviconCandidates(
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
  // This is where standard sites host their favicon (YouTube, Gemini, OpenRouter, etc.)
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
  // Note: Placed after direct sources to avoid premature net::ERR_FAILED console logs
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

interface FaviconImageProps {
  url: string;
  title: string;
  size?: number;
  className?: string;
  isDark?: boolean;
  letterClassName?: string;
  hideOnFallback?: boolean;
  customFavicon?: string;
  cachedFavicon?: string;
}

function FaviconImage({
  url,
  title,
  size = 64,
  className = 'w-6 h-6 object-contain pointer-events-none',
  isDark = true,
  letterClassName = '',
  hideOnFallback = false,
  customFavicon,
  cachedFavicon,
}: FaviconImageProps) {
  const activeCachedFavicon = customFavicon || cachedFavicon;
  const candidates = React.useMemo(
    () => getFaviconCandidates(url, size, activeCachedFavicon),
    [url, size, activeCachedFavicon]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [url, activeCachedFavicon]);

  const nextCandidate = () => {
    setCandidateIndex((prev) => prev + 1);
  };

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const currentSrc = candidates[candidateIndex] || '';
    // If it came from Google S2 and is a 16x16 or smaller image (Google's default pixelated globe), reject it if we have more candidates!
    if (
      (currentSrc.includes('google.com/s2') || currentSrc.includes('gstatic.com')) &&
      img.naturalWidth <= 16 &&
      img.naturalHeight <= 16 &&
      candidateIndex < candidates.length - 1
    ) {
      nextCandidate();
    }
  };

  if (candidateIndex >= candidates.length) {
    if (hideOnFallback) {
      return null;
    }
    const firstLetter = (title || 'G').trim().charAt(0).toUpperCase();
    return (
      <span
        className={`font-medium pointer-events-none select-none ${
          letterClassName ||
          (isDark ? 'text-[#8ab4f8] text-[18px]' : 'text-[#1a73e8] text-[18px]')
        }`}
      >
        {firstLetter}
      </span>
    );
  }

  return (
    <img
      src={candidates[candidateIndex]}
      alt={title}
      draggable={false}
      className={className}
      onError={nextCandidate}
      onLoad={handleLoad}
    />
  );
}



export default function Newtab() {
  const [sections, setSections] = useState<ChromeSection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Active folder opened in modal popup
  const [activeFolderInfo, setActiveFolderInfo] = useState<{
    sectionId: string;
    folderId: string;
  } | null>(null);

  // Add Item Modal (Shortcut or Folder)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalType, setAddModalType] = useState<'shortcut' | 'folder'>('shortcut');
  const [addTitle, setAddTitle] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addFavicon, setAddFavicon] = useState('');
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  // Favicon dynamic persistent cache
  const [faviconCache, setFaviconCache] = useState<Record<string, string>>({});

  // Helper to resolve cached favicon from storage or custom item favicon
  const getCachedFavicon = (rawUrl: string, itemFavicon?: string) => {
    if (itemFavicon) return itemFavicon;
    const domain = getDomain(rawUrl);
    let origin = '';
    try {
      origin = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).origin;
    } catch {
      // ignore
    }
    return (
      faviconCache[rawUrl] ||
      faviconCache[domain] ||
      (origin ? faviconCache[origin] : '') ||
      ''
    );
  };

  // Add Section Modal
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');

  // Inline Section Title Editing
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');

  // Edit Shortcut Modal
  const [editingShortcut, setEditingShortcut] = useState<{
    id: string;
    title: string;
    url: string;
    sectionId: string;
    folderId?: string;
    favicon?: string;
  } | null>(null);

  // Edit Folder Modal
  const [editingFolder, setEditingFolder] = useState<{
    id: string;
    title: string;
    sectionId: string;
  } | null>(null);

  // 3-dots Context Menu State (id can be item.id or section.id)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Drag and Drop for SECTIONS
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);
  const draggedSectionIndexRef = useRef<number | null>(null);

  // Drag and Drop for ITEMS (Shortcuts & Folders)
  const [draggedItemCoords, setDraggedItemCoords] = useState<{
    sectionId: string;
    itemIndex: number;
  } | null>(null);
  const draggedItemCoordsRef = useRef<{
    sectionId: string;
    itemIndex: number;
  } | null>(null);

  const [dragOverItemCoords, setDragOverItemCoords] = useState<{
    sectionId: string;
    itemIndex: number;
  } | null>(null);
  const [dragOverFolderTargetId, setDragOverFolderTargetId] = useState<string | null>(null);
  const [dragOverSectionTargetId, setDragOverSectionTargetId] = useState<string | null>(null);

  const isDraggingRef = useRef(false);

  // Drag and Drop inside Active Folder Modal
  const [draggedFolderItemIndex, setDraggedFolderItemIndex] = useState<number | null>(null);
  const [dragOverFolderItemIndex, setDragOverFolderItemIndex] = useState<number | null>(null);
  const draggedFolderItemIndexRef = useRef<number | null>(null);


  // Detect system color scheme
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(media.matches);

    const listener = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  // Load saved sections
  useEffect(() => {
    loadSectionsFromStorage().then((loadedSections) => {
      setSections(loadedSections && loadedSections.length ? loadedSections : DEFAULT_SECTIONS);
      setIsLoaded(true);
    });
  }, []);

  // Load favicon cache and subscribe to updates
  useEffect(() => {
    getFaviconCache().then(setFaviconCache);

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[CHROME_NTP_FAVICON_CACHE_KEY]?.newValue) {
        setFaviconCache(changes[CHROME_NTP_FAVICON_CACHE_KEY].newValue);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

  // Request background service worker to resolve and cache favicons for all bookmarks
  useEffect(() => {
    if (!sections || sections.length === 0) return;
    const urls: string[] = [];
    for (const sec of sections) {
      for (const item of sec.items) {
        if (item.type === 'shortcut' && item.url) {
          urls.push(item.url);
        } else if (item.type === 'folder' && Array.isArray(item.items)) {
          for (const b of item.items) {
            if (b.url) urls.push(b.url);
          }
        }
      }
    }

    if (urls.length > 0 && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICONS', urls }).catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [sections]);

  // Global Escape key listener to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveFolderInfo(null);
        setIsAddModalOpen(false);
        setIsAddSectionModalOpen(false);
        setEditingShortcut(null);
        setEditingFolder(null);
        setActiveMenuId(null);
        setEditingSectionId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save sections helper
  const saveSections = (updated: ChromeSection[]) => {
    setSections(updated);
    setStorageItem(CHROME_NTP_SECTIONS_KEY, updated);
  };

  // Find currently open folder in modal
  const activeSection = sections.find((s) => s.id === activeFolderInfo?.sectionId);
  const activeFolder = activeSection?.items.find(
    (item): item is ChromeFolder => item.id === activeFolderInfo?.folderId && item.type === 'folder'
  );

  // =========================================================================
  // SECTION MANAGEMENT ACTIONS
  // =========================================================================

  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newSectionTitle.trim();
    if (!title) return;

    const newSec: ChromeSection = {
      id: `sec-${Date.now()}`,
      title,
      items: [],
    };
    saveSections([...sections, newSec]);
    setNewSectionTitle('');
    setIsAddSectionModalOpen(false);
  };

  const handleStartEditingSection = (sec: ChromeSection) => {
    setEditingSectionId(sec.id);
    setEditingSectionTitle(sec.title);
    setActiveMenuId(null);
  };

  const handleSaveEditingSection = () => {
    if (!editingSectionId) return;
    const title = editingSectionTitle.trim();
    if (title) {
      const updated = sections.map((s) => (s.id === editingSectionId ? { ...s, title } : s));
      saveSections(updated);
    }
    setEditingSectionId(null);
  };

  const handleDeleteSection = (sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;

    if (sec.items.length > 0) {
      const ok = window.confirm(`Удалить секцию "${sec.title}" и все элементы в ней?`);
      if (!ok) return;
    }

    const updated = sections.filter((s) => s.id !== sectionId);
    saveSections(updated);
    if (activeFolderInfo?.sectionId === sectionId) {
      setActiveFolderInfo(null);
    }
    setActiveMenuId(null);
  };

  // =========================================================================
  // ITEM ADD / EDIT / DELETE ACTIONS
  // =========================================================================

  const handleOpenAddModal = (sectionId: string, folderId: string | null = null) => {
    setTargetSectionId(sectionId);
    setTargetFolderId(folderId);
    setAddModalType(folderId ? 'shortcut' : 'shortcut');
    setAddTitle('');
    setAddUrl('');
    setAddFavicon('');
    setIsAddModalOpen(true);
  };

  const handleSaveNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    const title = addTitle.trim();
    const secId = targetSectionId || sections[0]?.id;
    if (!secId) return;

    if (addModalType === 'folder') {
      if (!title) return;
      const newFolder: ChromeFolder = {
        id: `f-${Date.now()}`,
        type: 'folder',
        title,
        items: [],
      };
      const updated = sections.map((s) =>
        s.id === secId ? { ...s, items: [...s.items, newFolder] } : s
      );
      saveSections(updated);
      setIsAddModalOpen(false);
      return;
    }

    // Add Shortcut
    let url = addUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const finalTitle = title || getDomain(url);
    const customIcon = addFavicon.trim() || undefined;

    const newBookmark: ChromeBookmark = {
      id: `bm-${Date.now()}`,
      title: finalTitle,
      url,
      favicon: customIcon,
    };

    if (targetFolderId) {
      // Add inside folder
      const updated = sections.map((s) => {
        if (s.id === secId) {
          return {
            ...s,
            items: s.items.map((it) => {
              if (it.id === targetFolderId && it.type === 'folder') {
                return { ...it, items: [...it.items, newBookmark] };
              }
              return it;
            }),
          };
        }
        return s;
      });
      saveSections(updated);
    } else {
      // Add to section root
      const newShortcut: ChromeShortcutItem = {
        ...newBookmark,
        type: 'shortcut',
      };
      const updated = sections.map((s) =>
        s.id === secId ? { ...s, items: [...s.items, newShortcut] } : s
      );
      saveSections(updated);
    }

    // Proactively request background service worker to resolve favicon
    if (!customIcon && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url }).catch(() => {});
      } catch {
        // ignore
      }
    }

    setIsAddModalOpen(false);
  };

  const handleSaveEditShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShortcut) return;
    let url = editingShortcut.url.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const title = editingShortcut.title.trim() || getDomain(url);
    const customIcon = editingShortcut.favicon?.trim() || undefined;
    const { id, sectionId: targetSecId, folderId } = editingShortcut;

    // Inside folder
    if (folderId) {
      const updated = sections.map((s) => ({
        ...s,
        items: s.items.map((it) => {
          if (it.id === folderId && it.type === 'folder') {
            return {
              ...it,
              items: it.items.map((b) =>
                b.id === id ? { ...b, title, url, favicon: customIcon } : b
              ),
            };
          }
          return it;
        }),
      }));
      saveSections(updated);
      setEditingShortcut(null);
      return;
    }

    // Move to different section or update in place
    let foundShortcut: ChromeShortcutItem | null = null;
    const cleanSections = sections.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (it.id === id && it.type === 'shortcut') {
          foundShortcut = { ...it, title, url, favicon: customIcon };
          return false;
        }
        return true;
      }),
    }));

    if (foundShortcut) {
      const updated = cleanSections.map((s) => {
        if (s.id === targetSecId) {
          return { ...s, items: [...s.items, foundShortcut!] };
        }
        return s;
      });
      saveSections(updated);
    }

    // Proactively request background service worker to resolve favicon if changed
    if (!customIcon && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url }).catch(() => {});
      } catch {
        // ignore
      }
    }

    setEditingShortcut(null);
  };

  const handleDeleteShortcut = (id: string, sectionId: string, folderId?: string) => {
    if (folderId) {
      const updated = sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            items: s.items.map((it) => {
              if (it.id === folderId && it.type === 'folder') {
                return { ...it, items: it.items.filter((b) => b.id !== id) };
              }
              return it;
            }),
          };
        }
        return s;
      });
      saveSections(updated);
    } else {
      const updated = sections.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== id) } : s
      );
      saveSections(updated);
    }
    setEditingShortcut(null);
    setActiveMenuId(null);
  };

  const handleSaveEditFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder) return;
    const title = editingFolder.title.trim();
    if (!title) return;
    const { id, sectionId: targetSecId } = editingFolder;

    let foundFolder: ChromeFolder | null = null;
    const cleanSections = sections.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (it.id === id && it.type === 'folder') {
          foundFolder = { ...it, title };
          return false;
        }
        return true;
      }),
    }));

    if (foundFolder) {
      const updated = cleanSections.map((s) => {
        if (s.id === targetSecId) {
          return { ...s, items: [...s.items, foundFolder!] };
        }
        return s;
      });
      saveSections(updated);
    }

    setEditingFolder(null);
  };

  const handleDeleteFolder = (folderId: string, sectionId: string) => {
    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== folderId) } : s
    );
    saveSections(updated);
    if (activeFolderInfo?.folderId === folderId) {
      setActiveFolderInfo(null);
    }
    setEditingFolder(null);
    setActiveMenuId(null);
  };

  // =========================================================================
  // SECTION DRAG & DROP (Vertical Reordering)
  // =========================================================================

  const handleSectionDragStart = (e: React.DragEvent, index: number) => {
    isDraggingRef.current = true;
    draggedSectionIndexRef.current = index;
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `sec:${index}`);
  };

  const handleSectionDragOver = (e: React.DragEvent, index: number) => {
    if (draggedSectionIndexRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSectionIndex !== index) {
      setDragOverSectionIndex(index);
    }
  };

  const handleSectionDrop = (e: React.DragEvent, targetIndex: number) => {
    if (draggedSectionIndexRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();

    const sourceIndex = draggedSectionIndexRef.current;
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      const updated = [...sections];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      saveSections(updated);
    }
    handleSectionDragEnd();
  };

  const handleSectionDragEnd = () => {
    draggedSectionIndexRef.current = null;
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  // =========================================================================
  // ITEM DRAG & DROP (Within Section, Across Sections, Into Folders)
  // =========================================================================

  const handleItemDragStart = (e: React.DragEvent, sectionId: string, itemIndex: number) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    const coords = { sectionId, itemIndex };
    draggedItemCoordsRef.current = coords;
    setDraggedItemCoords(coords);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `item:${sectionId}:${itemIndex}`);
  };

  const handleItemDragOver = (
    e: React.DragEvent,
    sectionId: string,
    itemIndex: number,
    targetItem: ChromeGridItem
  ) => {
    if (draggedSectionIndexRef.current !== null) return;
    const source = draggedItemCoordsRef.current;
    if (!source) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const sourceSec = sections.find((s) => s.id === source.sectionId);
    const sourceItem = sourceSec?.items[source.itemIndex];

    // Case 1: Hovering a shortcut over a folder -> Highlight folder
    if (
      sourceItem &&
      sourceItem.type === 'shortcut' &&
      targetItem.type === 'folder' &&
      !(source.sectionId === sectionId && source.itemIndex === itemIndex)
    ) {
      if (dragOverFolderTargetId !== targetItem.id) {
        setDragOverFolderTargetId(targetItem.id);
        setDragOverItemCoords(null);
        setDragOverSectionTargetId(null);
      }
      return;
    }

    setDragOverFolderTargetId(null);
    setDragOverSectionTargetId(null);
    if (
      !dragOverItemCoords ||
      dragOverItemCoords.sectionId !== sectionId ||
      dragOverItemCoords.itemIndex !== itemIndex
    ) {
      setDragOverItemCoords({ sectionId, itemIndex });
    }
  };

  const handleItemDrop = (
    e: React.DragEvent,
    targetSectionId: string,
    targetItemIndex: number,
    targetItem: ChromeGridItem
  ) => {
    if (draggedSectionIndexRef.current !== null) return;
    const source = draggedItemCoordsRef.current;
    if (!source) {
      handleItemDragEnd();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const sourceSec = sections.find((s) => s.id === source.sectionId);
    const sourceItem = sourceSec?.items[source.itemIndex];
    if (!sourceItem) {
      handleItemDragEnd();
      return;
    }

    // Action A: Drop Shortcut INTO Folder
    if (
      sourceItem.type === 'shortcut' &&
      targetItem.type === 'folder' &&
      !(source.sectionId === targetSectionId && source.itemIndex === targetItemIndex)
    ) {
      const newBookmark: ChromeBookmark = {
        id: sourceItem.id,
        title: sourceItem.title,
        url: sourceItem.url,
      };

      const updated = sections.map((sec) => {
        // Remove from source section
        let secItems = sec.items;
        if (sec.id === source.sectionId) {
          secItems = secItems.filter((_, idx) => idx !== source.itemIndex);
        }
        // Add to target folder in target section
        if (sec.id === targetSectionId) {
          secItems = secItems.map((it) => {
            if (it.id === targetItem.id && it.type === 'folder') {
              return { ...it, items: [...it.items, newBookmark] };
            }
            return it;
          });
        }
        return { ...sec, items: secItems };
      });

      saveSections(updated);
      handleItemDragEnd();
      return;
    }

    // Action B: Reordering within SAME section
    if (source.sectionId === targetSectionId) {
      if (source.itemIndex !== targetItemIndex) {
        const updated = sections.map((sec) => {
          if (sec.id === targetSectionId) {
            const newItems = [...sec.items];
            const [moved] = newItems.splice(source.itemIndex, 1);
            newItems.splice(targetItemIndex, 0, moved);
            return { ...sec, items: newItems };
          }
          return sec;
        });
        saveSections(updated);
      }
      handleItemDragEnd();
      return;
    }

    // Action C: Move ACROSS sections to specific index
    const updated = sections.map((sec) => {
      if (sec.id === source.sectionId) {
        return {
          ...sec,
          items: sec.items.filter((_, idx) => idx !== source.itemIndex),
        };
      }
      if (sec.id === targetSectionId) {
        const newItems = [...sec.items];
        newItems.splice(targetItemIndex, 0, sourceItem);
        return { ...sec, items: newItems };
      }
      return sec;
    });

    saveSections(updated);
    handleItemDragEnd();
  };

  const handleSectionBodyDragOver = (e: React.DragEvent, sectionId: string) => {
    if (draggedSectionIndexRef.current !== null) return;
    if (draggedItemCoordsRef.current === null) return;
    if (dragOverFolderTargetId || dragOverItemCoords) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSectionTargetId !== sectionId) {
      setDragOverSectionTargetId(sectionId);
    }
  };

  const handleSectionBodyDrop = (e: React.DragEvent, targetSectionId: string) => {
    if (draggedSectionIndexRef.current !== null) return;
    const source = draggedItemCoordsRef.current;
    if (!source) {
      handleItemDragEnd();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // If already inside this section and not dropped on a specific item, nothing to do
    if (source.sectionId === targetSectionId) {
      handleItemDragEnd();
      return;
    }

    const sourceSec = sections.find((s) => s.id === source.sectionId);
    const sourceItem = sourceSec?.items[source.itemIndex];
    if (!sourceItem) {
      handleItemDragEnd();
      return;
    }

    // Move to end of target section
    const updated = sections.map((sec) => {
      if (sec.id === source.sectionId) {
        return {
          ...sec,
          items: sec.items.filter((_, idx) => idx !== source.itemIndex),
        };
      }
      if (sec.id === targetSectionId) {
        return {
          ...sec,
          items: [...sec.items, sourceItem],
        };
      }
      return sec;
    });

    saveSections(updated);
    handleItemDragEnd();
  };

  const handleItemDragEnd = () => {
    draggedItemCoordsRef.current = null;
    setDraggedItemCoords(null);
    setDragOverItemCoords(null);
    setDragOverFolderTargetId(null);
    setDragOverSectionTargetId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  // =========================================================================
  // INSIDE FOLDER MODAL DRAG & DROP
  // =========================================================================

  const handleFolderItemDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    draggedFolderItemIndexRef.current = index;
    setDraggedFolderItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleFolderItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderItemIndex !== index) {
      setDragOverFolderItemIndex(index);
    }
  };

  const handleFolderItemDrop = (
    e: React.DragEvent,
    targetIndex: number,
    sectionId: string,
    folderId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceIndex = draggedFolderItemIndexRef.current;
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      const updated = sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            items: s.items.map((it) => {
              if (it.id === folderId && it.type === 'folder') {
                const newFolderItems = [...it.items];
                const [moved] = newFolderItems.splice(sourceIndex, 1);
                newFolderItems.splice(targetIndex, 0, moved);
                return { ...it, items: newFolderItems };
              }
              return it;
            }),
          };
        }
        return s;
      });
      saveSections(updated);
    }
    handleFolderItemDragEnd();
  };

  const handleFolderItemDragEnd = () => {
    draggedFolderItemIndexRef.current = null;
    setDraggedFolderItemIndex(null);
    setDragOverFolderItemIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  // =========================================================================
  // CLICKS
  // =========================================================================

  const handleItemClick = (item: ChromeGridItem, sectionId: string) => {
    if (isDraggingRef.current) return;
    if (item.type === 'folder') {
      setActiveFolderInfo({ sectionId, folderId: item.id });
    } else {
      window.location.href = item.url;
    }
  };

  const handleBookmarkClick = (url: string) => {
    if (isDraggingRef.current) return;
    window.location.href = url;
  };

  if (!isLoaded) {
    return <div className={`min-h-screen ${isDark ? 'bg-[#202124]' : 'bg-white'}`} />;
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-start font-['Roboto',sans-serif] transition-colors duration-150 py-12 px-6 select-none ${
        isDark ? 'bg-[#202124] text-[#e8eaed]' : 'bg-white text-[#202124]'
      }`}
      onClick={() => {
        if (activeMenuId) setActiveMenuId(null);
        if (editingSectionId) handleSaveEditingSection();
      }}
    >
      {/* Container for vertical sections */}
      <div className="w-full max-w-[820px] flex flex-col gap-8">
        {sections.map((section, sIdx) => {
          const isDraggingThisSection = draggedSectionIndex === sIdx;
          const isSectionDropTarget =
            dragOverSectionIndex === sIdx && draggedSectionIndex !== null && !isDraggingThisSection;
          const isSectionItemHover =
            dragOverSectionTargetId === section.id && draggedItemCoords !== null;

          return (
            <div
              key={section.id}
              onDragOver={(e) => {
                if (draggedSectionIndexRef.current !== null) {
                  handleSectionDragOver(e, sIdx);
                } else if (draggedItemCoordsRef.current !== null) {
                  handleSectionBodyDragOver(e, section.id);
                }
              }}
              onDrop={(e) => {
                if (draggedSectionIndexRef.current !== null) {
                  handleSectionDrop(e, sIdx);
                } else if (draggedItemCoordsRef.current !== null && dragOverSectionTargetId === section.id) {
                  handleSectionBodyDrop(e, section.id);
                }
              }}
              className={`relative rounded-2xl p-5 border transition-all duration-150 group/section ${
                isDraggingThisSection
                  ? 'opacity-30 border-dashed border-[#8ab4f8]'
                  : isSectionDropTarget
                  ? isDark
                    ? 'border-[#8ab4f8] ring-2 ring-[#8ab4f8] bg-[#2d3034]'
                    : 'border-[#1a73e8] ring-2 ring-[#1a73e8] bg-[#f1f3f4]'
                  : isSectionItemHover
                  ? isDark
                    ? 'border-[#8ab4f8]/60 bg-[#2d3034]'
                    : 'border-[#1a73e8]/60 bg-[#f1f3f4]'
                  : isDark
                  ? 'bg-[#28292c]/50 border-[#3c4043]/50 hover:border-[#3c4043]'
                  : 'bg-[#fafafa] border-[#e4e6eb] hover:border-[#d0d3d8]'
              }`}
            >
              {/* Section Header */}
              <div className="flex items-center justify-between mb-3.5 px-1 select-none">
                <div className="flex items-center gap-2">
                  {/* Reorder Grip Handle for Section */}
                  <div
                    draggable
                    onDragStart={(e) => handleSectionDragStart(e, sIdx)}
                    onDragEnd={handleSectionDragEnd}
                    className={`cursor-grab active:cursor-grabbing p-1 rounded-md transition-colors ${
                      isDark
                        ? 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]'
                        : 'text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed]'
                    }`}
                    title="Перетащить секцию"
                  >
                    <span className="material-symbols-outlined text-[20px] leading-none block">
                      drag_indicator
                    </span>
                  </div>

                  {/* Section Title (Inline Editable) */}
                  {editingSectionId === section.id ? (
                    <input
                      type="text"
                      value={editingSectionTitle}
                      onChange={(e) => setEditingSectionTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEditingSection();
                        if (e.key === 'Escape') setEditingSectionId(null);
                      }}
                      onBlur={handleSaveEditingSection}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      className={`text-[15px] font-medium px-2 py-0.5 rounded outline-none border transition-colors ${
                        isDark
                          ? 'bg-[#303134] border-[#8ab4f8] text-[#e8eaed]'
                          : 'bg-white border-[#1a73e8] text-[#202124]'
                      }`}
                    />
                  ) : (
                    <div
                      className="flex items-center gap-2 cursor-pointer group/title"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEditingSection(section);
                      }}
                      title="Кликните, чтобы переименовать"
                    >
                      <h3 className="text-[15px] font-medium tracking-tight">
                        {section.title}
                      </h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-normal ${
                          isDark
                            ? 'bg-[#303134] text-[#9aa0a6]'
                            : 'bg-[#e8eaed] text-[#5f6368]'
                        }`}
                      >
                        {section.items.length}
                      </span>
                      <span
                        className={`material-symbols-outlined text-[15px] opacity-0 group-hover/title:opacity-100 transition-opacity ${
                          isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'
                        }`}
                      >
                        edit
                      </span>
                    </div>
                  )}
                </div>

                {/* Section Controls */}
                <div className="flex items-center gap-1">
                  {/* Quick Add Button in Header */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddModal(section.id, null);
                    }}
                    title="Добавить ярлык или папку в эту секцию"
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      isDark
                        ? 'hover:bg-[#3c4043] text-[#9aa0a6] hover:text-[#e8eaed]'
                        : 'hover:bg-[#e8eaed] text-[#5f6368] hover:text-[#202124]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>

                  {/* Section 3-dots Menu */}
                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMenuId(activeMenuId === `sec-menu-${section.id}` ? null : `sec-menu-${section.id}`)
                      }
                      title="Опции секции"
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                        isDark
                          ? 'hover:bg-[#3c4043] text-[#9aa0a6]'
                          : 'hover:bg-[#e8eaed] text-[#5f6368]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">more_vert</span>
                    </button>

                    {activeMenuId === `sec-menu-${section.id}` && (
                      <div
                        className={`absolute right-0 top-8 w-48 py-1.5 rounded-lg shadow-xl border z-30 ${
                          isDark
                            ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                            : 'bg-white border-[#dadce0] text-[#202124]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleStartEditingSection(section)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                            isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                          <span>Переименовать секцию</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuId(null);
                            handleOpenAddModal(section.id, null);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                            isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          <span>Добавить элемент</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(section.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left text-red-400 cursor-pointer ${
                            isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span>Удалить секцию</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Items Grid inside Section (Folders and Shortcuts) */}
              <div
                className="flex flex-wrap gap-y-3 gap-x-2 select-none min-h-[112px] items-center"
                onDragOver={(e) => handleSectionBodyDragOver(e, section.id)}
                onDrop={(e) => handleSectionBodyDrop(e, section.id)}
              >
                {section.items.map((item, itIdx) => {
                  const isDragging =
                    draggedItemCoords?.sectionId === section.id &&
                    draggedItemCoords?.itemIndex === itIdx;
                  const isDropTarget =
                    dragOverItemCoords?.sectionId === section.id &&
                    dragOverItemCoords?.itemIndex === itIdx &&
                    !isDragging;
                  const isFolderHoverTarget = dragOverFolderTargetId === item.id;
                  const isFolder = item.type === 'folder';

                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, section.id, itIdx)}
                      onDragEnd={handleItemDragEnd}
                      onDragOver={(e) => handleItemDragOver(e, section.id, itIdx, item)}
                      onDrop={(e) => handleItemDrop(e, section.id, itIdx, item)}
                      onClick={() => handleItemClick(item, section.id)}
                      className={`group relative w-[112px] h-[112px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 ${
                        isDragging
                          ? 'opacity-30'
                          : isFolderHoverTarget
                          ? isDark
                            ? 'bg-[#3c4043] ring-2 ring-[#8ab4f8]'
                            : 'bg-[#e8eaed] ring-2 ring-[#1a73e8]'
                          : isDropTarget
                          ? isDark
                            ? 'bg-[#3c4043] ring-2 ring-[#8ab4f8]'
                            : 'bg-[#e8eaed] ring-2 ring-[#1a73e8]'
                          : isDark
                          ? 'hover:bg-[rgba(255,255,255,0.08)]'
                          : 'hover:bg-[#ececec]'
                      }`}
                    >
                      {/* Circular Icon */}
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 overflow-hidden pointer-events-none transition-colors ${
                          isDark ? 'bg-[#303134]' : 'bg-[#f1f3f4]'
                        }`}
                      >
                        {isFolder ? (
                          item.items.length > 0 ? (
                            // 2x2 Mini Favicons Grid for Folders
                            <div className="grid grid-cols-2 gap-1 p-2 w-full h-full pointer-events-none">
                              {item.items.slice(0, 4).map((b) => (
                                <FaviconImage
                                  key={b.id}
                                  url={b.url}
                                  title={b.title}
                                  size={32}
                                  className="w-3.5 h-3.5 object-contain pointer-events-none"
                                  hideOnFallback={true}
                                  customFavicon={b.favicon}
                                  cachedFavicon={getCachedFavicon(b.url, b.favicon)}
                                />
                              ))}
                            </div>
                          ) : (
                            <span
                              className={`material-symbols-outlined text-[24px] pointer-events-none ${
                                isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'
                              }`}
                            >
                              folder
                            </span>
                          )
                        ) : (
                          <FaviconImage
                            url={item.url}
                            title={item.title}
                            size={64}
                            isDark={isDark}
                            className="w-6 h-6 object-contain pointer-events-none"
                            letterClassName={isDark ? 'text-[#8ab4f8] text-[18px]' : 'text-[#1a73e8] text-[18px]'}
                            customFavicon={item.favicon}
                            cachedFavicon={getCachedFavicon(item.url, item.favicon)}
                          />
                        )}
                      </div>

                      {/* Title */}
                      <span
                        className={`text-[12px] font-normal truncate w-full text-center px-1 pointer-events-none ${
                          isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                        }`}
                      >
                        {item.title}
                      </span>

                      {/* 3-dots Menu Button */}
                      <div
                        className="absolute top-1 right-1"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMenuId(activeMenuId === item.id ? null : item.id)
                          }
                          title="Опции"
                          aria-label="Опции"
                          className={`opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center transition-opacity cursor-pointer ${
                            isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">more_vert</span>
                        </button>

                        {/* Context Dropdown Menu */}
                        {activeMenuId === item.id && (
                          <div
                            className={`absolute right-0 top-8 w-44 py-1.5 rounded-lg shadow-xl border z-30 ${
                              isDark
                                ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                                : 'bg-white border-[#dadce0] text-[#202124]'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isFolder ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFolder({
                                      id: item.id,
                                      title: item.title,
                                      sectionId: section.id,
                                    });
                                    setActiveMenuId(null);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                                    isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                  <span>Изменить папку</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFolder(item.id, section.id)}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left text-red-400 cursor-pointer ${
                                    isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">delete</span>
                                  <span>Удалить папку</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingShortcut({
                                      id: item.id,
                                      title: item.title,
                                      url: item.url,
                                      sectionId: section.id,
                                      favicon: item.favicon,
                                    });
                                    setActiveMenuId(null);
                                  }}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left cursor-pointer ${
                                    isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">edit</span>
                                  <span>Изменить ярлык</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShortcut(item.id, section.id)}
                                  className={`w-full flex items-center gap-3 px-4 py-2 text-xs text-left text-red-400 cursor-pointer ${
                                    isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                                  }`}
                                >
                                  <span className="material-symbols-outlined text-[16px]">close</span>
                                  <span>Удалить</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* "+ Добавить" Tile inside this Section */}
                <button
                  type="button"
                  onClick={() => handleOpenAddModal(section.id, null)}
                  className={`w-[112px] h-[112px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 group ${
                    isDark ? 'hover:bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#ececec]'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                      isDark ? 'bg-[#303134] text-[#e8eaed]' : 'bg-[#f1f3f4] text-[#5f6368]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </div>
                  <span
                    className={`text-[12px] font-normal truncate w-full text-center px-1 ${
                      isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                    }`}
                  >
                    Добавить
                  </span>
                </button>
              </div>
            </div>
          );
        })}

        {/* "+ Добавить секцию" Button at Bottom */}
        <div className="flex justify-center pt-2 pb-6">
          <button
            type="button"
            onClick={() => setIsAddSectionModalOpen(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full border text-xs font-medium cursor-pointer transition-all ${
              isDark
                ? 'border-[#3c4043] bg-[#28292c]/60 hover:bg-[#35363a] text-[#8ab4f8] hover:border-[#8ab4f8]'
                : 'border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-[#1a73e8] hover:border-[#1a73e8]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Добавить секцию</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FOLDER POPUP MODAL (When clicking a folder in a section) */}
      {/* ========================================================================= */}
      {activeFolder && activeSection && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-40 p-4"
          onClick={() => setActiveFolderInfo(null)}
        >
          <div
            className={`w-full max-w-[540px] rounded-2xl p-6 shadow-2xl border transition-all ${
              isDark
                ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                : 'bg-white border-[#dadce0] text-[#202124]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Folder Header */}
            <div className="flex items-center justify-between mb-5 select-none">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#8ab4f8] text-[24px]">
                  folder
                </span>
                <h2 className="text-[18px] font-medium">{activeFolder.title}</h2>
                <span className="text-xs text-[#9aa0a6] font-normal">
                  ({activeFolder.items.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveFolderInfo(null)}
                className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#f1f3f4] text-[#5f6368]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Bookmarks Grid inside Folder */}
            <div className="flex flex-wrap gap-2 max-h-[50vh] overflow-y-auto no-scrollbar py-1 select-none">
              {activeFolder.items.map((b, bIdx) => {
                const isDragging = draggedFolderItemIndex === bIdx;
                const isDropTarget = dragOverFolderItemIndex === bIdx && !isDragging;

                return (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={(e) => handleFolderItemDragStart(e, bIdx)}
                    onDragEnd={handleFolderItemDragEnd}
                    onDragOver={(e) => handleFolderItemDragOver(e, bIdx)}
                    onDrop={(e) =>
                      handleFolderItemDrop(e, bIdx, activeSection.id, activeFolder.id)
                    }
                    onClick={() => handleBookmarkClick(b.url)}
                    className={`group relative w-[100px] h-[100px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 ${
                      isDragging
                        ? 'opacity-30'
                        : isDropTarget
                        ? isDark
                          ? 'bg-[#3c4043] ring-2 ring-[#8ab4f8]'
                          : 'bg-[#e8eaed] ring-2 ring-[#1a73e8]'
                        : isDark
                        ? 'hover:bg-[rgba(255,255,255,0.08)]'
                        : 'hover:bg-[#f1f3f4]'
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 overflow-hidden pointer-events-none transition-colors ${
                        isDark ? 'bg-[#303134]' : 'bg-[#f1f3f4]'
                      }`}
                    >
                      <FaviconImage
                        url={b.url}
                        title={b.title}
                        size={48}
                        isDark={isDark}
                        className="w-5 h-5 object-contain pointer-events-none"
                        letterClassName={isDark ? 'text-[#8ab4f8] text-[16px]' : 'text-[#1a73e8] text-[16px]'}
                        customFavicon={b.favicon}
                        cachedFavicon={getCachedFavicon(b.url, b.favicon)}
                      />
                    </div>

                    {/* Title */}
                    <span
                      className={`text-[11px] font-normal truncate w-full text-center px-0.5 pointer-events-none ${
                        isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                      }`}
                    >
                      {b.title}
                    </span>

                    {/* 3-dots Menu Button */}
                    <div
                      className="absolute top-1 right-1"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMenuId(activeMenuId === b.id ? null : b.id)
                        }
                        title="Опции"
                        className={`opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full flex items-center justify-center transition-opacity cursor-pointer ${
                          isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#e8eaed] text-[#5f6368]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">more_vert</span>
                      </button>

                      {/* Context Menu inside folder */}
                      {activeMenuId === b.id && (
                        <div
                          className={`absolute right-0 top-7 w-40 py-1.5 rounded-lg shadow-xl border z-50 ${
                            isDark
                              ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                              : 'bg-white border-[#dadce0] text-[#202124]'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingShortcut({
                                id: b.id,
                                title: b.title,
                                url: b.url,
                                sectionId: activeSection.id,
                                folderId: activeFolder.id,
                                favicon: b.favicon,
                              });
                              setActiveMenuId(null);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left cursor-pointer ${
                              isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            <span>Изменить</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteShortcut(b.id, activeSection.id, activeFolder.id)
                            }
                            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left text-red-400 cursor-pointer ${
                              isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[15px]">close</span>
                            <span>Удалить</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* "+ Добавить в эту папку" Button */}
              <button
                type="button"
                onClick={() => handleOpenAddModal(activeSection.id, activeFolder.id)}
                className={`w-[100px] h-[100px] rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer transition-colors duration-150 group ${
                  isDark ? 'hover:bg-[rgba(255,255,255,0.08)]' : 'hover:bg-[#f1f3f4]'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center mb-1.5 transition-colors ${
                    isDark ? 'bg-[#303134] text-[#e8eaed]' : 'bg-[#f1f3f4] text-[#5f6368]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </div>
                <span
                  className={`text-[11px] font-normal truncate w-full text-center px-0.5 ${
                    isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                  }`}
                >
                  Добавить
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD SECTION MODAL */}
      {/* ========================================================================= */}
      {isAddSectionModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setIsAddSectionModalOpen(false)}
        >
          <div
            className={`w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border transition-all ${
              isDark
                ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                : 'bg-white border-[#dadce0] text-[#202124]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-medium mb-4 select-none">Новая секция</h2>

            <form onSubmit={handleCreateSection} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  Название секции
                </label>
                <input
                  type="text"
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="Например, Работа или Учёба"
                  autoFocus
                  required
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 mt-4 select-none">
                <button
                  type="button"
                  onClick={() => setIsAddSectionModalOpen(false)}
                  className={`px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-[#3c4043] text-[#8ab4f8]' : 'hover:bg-[#f1f3f4] text-[#1a73e8]'
                  }`}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
                      : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                  }`}
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD ITEM MODAL (Add Shortcut or Add Folder) */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className={`w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border transition-all ${
              isDark
                ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                : 'bg-white border-[#dadce0] text-[#202124]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Tab switch: Shortcut vs Folder (only when adding to section root) */}
            {!targetFolderId && (
              <div className="flex rounded-full p-1 mb-5 bg-black/15 select-none">
                <button
                  type="button"
                  onClick={() => setAddModalType('shortcut')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all ${
                    addModalType === 'shortcut'
                      ? isDark
                        ? 'bg-[#3c4043] text-white shadow-xs'
                        : 'bg-white text-black shadow-xs'
                      : 'text-[#9aa0a6]'
                  }`}
                >
                  Ярлык
                </button>
                <button
                  type="button"
                  onClick={() => setAddModalType('folder')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-all ${
                    addModalType === 'folder'
                      ? isDark
                        ? 'bg-[#3c4043] text-white shadow-xs'
                        : 'bg-white text-black shadow-xs'
                      : 'text-[#9aa0a6]'
                  }`}
                >
                  Папка
                </button>
              </div>
            )}

            <h2 className="text-[16px] font-medium mb-4 select-none">
              {targetFolderId
                ? 'Добавить в папку'
                : addModalType === 'folder'
                ? 'Новая папка'
                : 'Добавить ярлык'}
            </h2>

            <form onSubmit={handleSaveNewItem} className="flex flex-col gap-4">
              {/* Select section if not adding to a folder */}
              {!targetFolderId && sections.length > 1 && (
                <div>
                  <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                    Секция
                  </label>
                  <select
                    value={targetSectionId}
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                      isDark
                        ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                        : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                    }`}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  Название
                </label>
                <input
                  type="text"
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder={addModalType === 'folder' ? 'Работа' : 'GitHub'}
                  autoFocus
                  required={addModalType === 'folder'}
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>

              {addModalType === 'shortcut' && (
                <>
                  <div>
                    <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                      URL
                    </label>
                    <input
                      type="text"
                      value={addUrl}
                      onChange={(e) => setAddUrl(e.target.value)}
                      placeholder="https://github.com"
                      required
                      className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                        isDark
                          ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                          : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                      Иконка (необязательно, URL или data:)
                    </label>
                    <input
                      type="text"
                      value={addFavicon}
                      onChange={(e) => setAddFavicon(e.target.value)}
                      placeholder="https://.../icon.png"
                      className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                        isDark
                          ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                          : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                      }`}
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 mt-4 select-none">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-[#3c4043] text-[#8ab4f8]' : 'hover:bg-[#f1f3f4] text-[#1a73e8]'
                  }`}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
                      : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                  }`}
                >
                  Готово
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT SHORTCUT MODAL */}
      {/* ========================================================================= */}
      {editingShortcut && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setEditingShortcut(null)}
        >
          <div
            className={`w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border transition-all ${
              isDark
                ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                : 'bg-white border-[#dadce0] text-[#202124]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-medium mb-4 select-none">Изменить ярлык</h2>

            <form onSubmit={handleSaveEditShortcut} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  Название
                </label>
                <input
                  type="text"
                  value={editingShortcut.title}
                  onChange={(e) =>
                    setEditingShortcut({ ...editingShortcut, title: e.target.value })
                  }
                  autoFocus
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={editingShortcut.url}
                  onChange={(e) =>
                    setEditingShortcut({ ...editingShortcut, url: e.target.value })
                  }
                  required
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  Иконка (необязательно, URL или data:)
                </label>
                <input
                  type="text"
                  value={editingShortcut.favicon || ''}
                  onChange={(e) =>
                    setEditingShortcut({ ...editingShortcut, favicon: e.target.value })
                  }
                  placeholder="https://.../icon.png"
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>

              {/* Move to another Section (if not in a folder) */}
              {!editingShortcut.folderId && sections.length > 1 && (
                <div>
                  <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                    Секция
                  </label>
                  <select
                    value={editingShortcut.sectionId}
                    onChange={(e) =>
                      setEditingShortcut({ ...editingShortcut, sectionId: e.target.value })
                    }
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                      isDark
                        ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                        : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                    }`}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 select-none">
                <button
                  type="button"
                  onClick={() =>
                    handleDeleteShortcut(
                      editingShortcut.id,
                      editingShortcut.sectionId,
                      editingShortcut.folderId
                    )
                  }
                  className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                >
                  Удалить
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingShortcut(null)}
                    className={`px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#3c4043] text-[#8ab4f8]' : 'hover:bg-[#f1f3f4] text-[#1a73e8]'
                    }`}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
                        : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                    }`}
                  >
                    Готово
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT FOLDER MODAL */}
      {/* ========================================================================= */}
      {editingFolder && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          onClick={() => setEditingFolder(null)}
        >
          <div
            className={`w-full max-w-[400px] rounded-2xl p-6 shadow-2xl border transition-all ${
              isDark
                ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
                : 'bg-white border-[#dadce0] text-[#202124]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[16px] font-medium mb-4 select-none">Изменить папку</h2>

            <form onSubmit={handleSaveEditFolder} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                  Название папки
                </label>
                <input
                  type="text"
                  value={editingFolder.title}
                  onChange={(e) =>
                    setEditingFolder({ ...editingFolder, title: e.target.value })
                  }
                  autoFocus
                  required
                  className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                    isDark
                      ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                      : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                  }`}
                />
              </div>

              {/* Move folder to another Section */}
              {sections.length > 1 && (
                <div>
                  <label className="block text-xs font-normal text-[#9aa0a6] mb-1">
                    Секция
                  </label>
                  <select
                    value={editingFolder.sectionId}
                    onChange={(e) =>
                      setEditingFolder({ ...editingFolder, sectionId: e.target.value })
                    }
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border transition-colors ${
                      isDark
                        ? 'bg-[#303134] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
                        : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
                    }`}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between mt-4 select-none">
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(editingFolder.id, editingFolder.sectionId)}
                  className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                >
                  Удалить папку
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingFolder(null)}
                    className={`px-4 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#3c4043] text-[#8ab4f8]' : 'hover:bg-[#f1f3f4] text-[#1a73e8]'
                    }`}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                      isDark
                        ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
                        : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                    }`}
                  >
                    Готово
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
