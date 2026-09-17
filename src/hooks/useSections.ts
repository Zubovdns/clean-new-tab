import { useState, useEffect, useCallback } from 'react';
import {
  ChromeBookmark,
  ChromeFolder,
  ChromeSection,
  ChromeShortcutItem,
  EditingShortcutData,
  EditingFolderData,
} from '@app-types';
import {
  CHROME_NTP_SECTIONS_KEY,
  DEFAULT_SECTIONS,
  loadSectionsFromStorage,
  setStorageItem,
} from '@utils/storage';
import { getDomain } from '@utils/favicon';

export function useSections() {
  const [sections, setSections] = useState<ChromeSection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved sections on mount
  useEffect(() => {
    loadSectionsFromStorage().then((loadedSections) => {
      setSections(loadedSections && loadedSections.length ? loadedSections : DEFAULT_SECTIONS);
      setIsLoaded(true);
    });
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

  // Save sections helper
  const saveSections = useCallback((updated: ChromeSection[]) => {
    setSections(updated);
    setStorageItem(CHROME_NTP_SECTIONS_KEY, updated);
  }, []);

  // Section CRUD
  const createSection = useCallback((title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const newSec: ChromeSection = {
      id: `sec-${Date.now()}`,
      title: trimmedTitle,
      items: [],
    };
    saveSections([...sections, newSec]);
  }, [sections, saveSections]);

  const updateSectionTitle = useCallback((sectionId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const updated = sections.map((s) => (s.id === sectionId ? { ...s, title: trimmed } : s));
    saveSections(updated);
  }, [sections, saveSections]);

  const deleteSection = useCallback((sectionId: string) => {
    const updated = sections.filter((s) => s.id !== sectionId);
    saveSections(updated);
  }, [sections, saveSections]);

  const reorderSections = useCallback((sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return;
    const updated = [...sections];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);
    saveSections(updated);
  }, [sections, saveSections]);

  // Item Add
  const addFolder = useCallback((sectionId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const newFolder: ChromeFolder = {
      id: `f-${Date.now()}`,
      type: 'folder',
      title: trimmed,
      items: [],
    };
    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, items: [...s.items, newFolder] } : s
    );
    saveSections(updated);
  }, [sections, saveSections]);

  const addShortcut = useCallback((
    sectionId: string,
    folderId: string | null,
    data: { title: string; url: string; favicon?: string }
  ) => {
    let url = data.url.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const finalTitle = data.title.trim() || getDomain(url);
    const customIcon = data.favicon?.trim() || undefined;

    const newBookmark: ChromeBookmark = {
      id: `bm-${Date.now()}`,
      title: finalTitle,
      url,
      favicon: customIcon,
    };

    if (folderId) {
      // Add inside folder
      const updated = sections.map((s) => {
        if (s.id === sectionId) {
          return {
            ...s,
            items: s.items.map((it) => {
              if (it.id === folderId && it.type === 'folder') {
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
        s.id === sectionId ? { ...s, items: [...s.items, newShortcut] } : s
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
  }, [sections, saveSections]);

  // Item Edit
  const saveEditShortcut = useCallback((data: EditingShortcutData) => {
    let url = data.url.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    const title = data.title.trim() || getDomain(url);
    const customIcon = data.favicon?.trim() || undefined;
    const { id, sectionId: targetSecId, folderId } = data;

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
  }, [sections, saveSections]);

  const deleteShortcut = useCallback((id: string, sectionId: string, folderId?: string) => {
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
  }, [sections, saveSections]);

  const saveEditFolder = useCallback((data: EditingFolderData) => {
    const title = data.title.trim();
    if (!title) return;
    const { id, sectionId: targetSecId } = data;

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
  }, [sections, saveSections]);

  const deleteFolder = useCallback((folderId: string, sectionId: string) => {
    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== folderId) } : s
    );
    saveSections(updated);
  }, [sections, saveSections]);

  // Drag & Drop Helpers
  const moveItemToFolder = useCallback((
    sourceSectionId: string,
    sourceItemIndex: number,
    targetSectionId: string,
    targetFolderId: string
  ) => {
    const sourceSec = sections.find((s) => s.id === sourceSectionId);
    const sourceItem = sourceSec?.items[sourceItemIndex];
    if (!sourceItem || sourceItem.type !== 'shortcut') return;

    const newBookmark: ChromeBookmark = {
      id: sourceItem.id,
      title: sourceItem.title,
      url: sourceItem.url,
      favicon: sourceItem.favicon,
    };

    const updated = sections.map((sec) => {
      let secItems = sec.items;
      if (sec.id === sourceSectionId) {
        secItems = secItems.filter((_, idx) => idx !== sourceItemIndex);
      }
      if (sec.id === targetSectionId) {
        secItems = secItems.map((it) => {
          if (it.id === targetFolderId && it.type === 'folder') {
            return { ...it, items: [...it.items, newBookmark] };
          }
          return it;
        });
      }
      return { ...sec, items: secItems };
    });

    saveSections(updated);
  }, [sections, saveSections]);

  const reorderItemsInSameSection = useCallback((
    sectionId: string,
    sourceIndex: number,
    targetIndex: number
  ) => {
    if (sourceIndex === targetIndex) return;
    const updated = sections.map((sec) => {
      if (sec.id === sectionId) {
        const newItems = [...sec.items];
        const [moved] = newItems.splice(sourceIndex, 1);
        newItems.splice(targetIndex, 0, moved);
        return { ...sec, items: newItems };
      }
      return sec;
    });
    saveSections(updated);
  }, [sections, saveSections]);

  const moveItemAcrossSections = useCallback((
    sourceSectionId: string,
    sourceIndex: number,
    targetSectionId: string,
    targetIndex: number
  ) => {
    const sourceSec = sections.find((s) => s.id === sourceSectionId);
    const sourceItem = sourceSec?.items[sourceIndex];
    if (!sourceItem) return;

    const updated = sections.map((sec) => {
      if (sec.id === sourceSectionId) {
        return {
          ...sec,
          items: sec.items.filter((_, idx) => idx !== sourceIndex),
        };
      }
      if (sec.id === targetSectionId) {
        const newItems = [...sec.items];
        newItems.splice(targetIndex, 0, sourceItem);
        return { ...sec, items: newItems };
      }
      return sec;
    });

    saveSections(updated);
  }, [sections, saveSections]);

  const moveItemToEndOfSection = useCallback((
    sourceSectionId: string,
    sourceIndex: number,
    targetSectionId: string
  ) => {
    if (sourceSectionId === targetSectionId) return;
    const sourceSec = sections.find((s) => s.id === sourceSectionId);
    const sourceItem = sourceSec?.items[sourceIndex];
    if (!sourceItem) return;

    const updated = sections.map((sec) => {
      if (sec.id === sourceSectionId) {
        return {
          ...sec,
          items: sec.items.filter((_, idx) => idx !== sourceIndex),
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
  }, [sections, saveSections]);

  const reorderFolderItems = useCallback((
    sectionId: string,
    folderId: string,
    sourceIndex: number,
    targetIndex: number
  ) => {
    if (sourceIndex === targetIndex) return;
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
  }, [sections, saveSections]);

  return {
    sections,
    isLoaded,
    saveSections,
    createSection,
    updateSectionTitle,
    deleteSection,
    reorderSections,
    addFolder,
    addShortcut,
    saveEditShortcut,
    deleteShortcut,
    saveEditFolder,
    deleteFolder,
    moveItemToFolder,
    reorderItemsInSameSection,
    moveItemAcrossSections,
    moveItemToEndOfSection,
    reorderFolderItems,
  };
}

export default useSections;
