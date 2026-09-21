import { useState, useEffect, useCallback, useRef } from 'react';

import {
  ChromeSection,
  ChromeShortcutItem,
  EditingShortcutData,
} from '@app-types';
import { getDomain } from '@utils/favicon';
import { generateId, normalizeSafeUrl } from '@utils/security';
import {
  CHROME_NTP_SECTIONS_KEY,
  DEFAULT_SECTIONS,
  loadSectionsFromStorage,
  setStorageItem,
} from '@utils/storage';

export const useSections = (onSectionsChangedLocally?: (updated: ChromeSection[]) => void) => {
  const [sections, setSections] = useState<ChromeSection[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasRequestedFaviconsRef = useRef(false);
  const onSectionsChangedRef = useRef(onSectionsChangedLocally);

  useEffect(() => {
    onSectionsChangedRef.current = onSectionsChangedLocally;
  }, [onSectionsChangedLocally]);

  // Load saved sections on mount
  useEffect(() => {
    loadSectionsFromStorage().then((loadedSections) => {
      setSections(loadedSections && loadedSections.length ? loadedSections : DEFAULT_SECTIONS);
      setIsLoaded(true);
    });
  }, []);

  // Request background service worker to resolve and cache favicons once after loading
  useEffect(() => {
    if (!isLoaded || !sections || sections.length === 0 || hasRequestedFaviconsRef.current) return;
    hasRequestedFaviconsRef.current = true;

    const urls: string[] = [];
    for (const sec of sections) {
      for (const item of sec.items) {
        if (item.url && !item.favicon) {
          urls.push(item.url);
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
  }, [isLoaded, sections]);

  const saveSections = useCallback((updated: ChromeSection[]) => {
    setSections(updated);
    setStorageItem(CHROME_NTP_SECTIONS_KEY, updated);
    if (onSectionsChangedRef.current) {
      onSectionsChangedRef.current(updated);
    }
  }, []);

  const replaceSections = useCallback((updated: ChromeSection[]) => {
    setSections(updated);
    setStorageItem(CHROME_NTP_SECTIONS_KEY, updated);
  }, []);

  const createSection = useCallback((title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const newSec: ChromeSection = {
      id: generateId('sec'),
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

  const addShortcut = useCallback((
    sectionId: string,
    data: { title: string; url: string; favicon?: string }
  ) => {
    const url = normalizeSafeUrl(data.url);
    if (!url) return;

    const finalTitle = data.title.trim() || getDomain(url);
    const customIcon = data.favicon?.trim() || undefined;

    const newShortcut: ChromeShortcutItem = {
      id: generateId('sc'),
      type: 'shortcut',
      title: finalTitle,
      url,
      favicon: customIcon,
    };

    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, items: [...s.items, newShortcut] } : s
    );
    saveSections(updated);

    // Proactively request background service worker to resolve favicon
    if (!customIcon && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url }).catch(() => {});
      } catch {
        // ignore
      }
    }
  }, [sections, saveSections]);

  const saveEditShortcut = useCallback((data: EditingShortcutData) => {
    const url = normalizeSafeUrl(data.url);
    if (!url) return;

    const title = data.title.trim() || getDomain(url);
    const customIcon = data.favicon?.trim() || undefined;
    const { id, sectionId: targetSecId } = data;

    // Remove from source section and place into target section
    let foundShortcut: ChromeShortcutItem | null = null;
    const cleanSections = sections.map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        if (it.id === id) {
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

  const deleteShortcut = useCallback((id: string, sectionId: string) => {
    const updated = sections.map((s) =>
      s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== id) } : s
    );
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

  return {
    sections,
    isLoaded,
    createSection,
    updateSectionTitle,
    deleteSection,
    reorderSections,
    addShortcut,
    saveEditShortcut,
    deleteShortcut,
    reorderItemsInSameSection,
    moveItemAcrossSections,
    moveItemToEndOfSection,
    replaceSections,
  };
};


