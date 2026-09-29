import { useState, useEffect, useCallback, useRef } from 'react';

import { ChromeSection, ChromeShortcutItem, EditingShortcutData } from '@app-types';
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
  const sectionsRef = useRef<ChromeSection[]>(sections);
  const hasRequestedFaviconsRef = useRef(false);
  const onSectionsChangedRef = useRef(onSectionsChangedLocally);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    onSectionsChangedRef.current = onSectionsChangedLocally;
  }, [onSectionsChangedLocally]);

  // Load saved sections on mount
  useEffect(() => {
    loadSectionsFromStorage().then((loadedSections) => {
      const initial = loadedSections && loadedSections.length ? loadedSections : DEFAULT_SECTIONS;
      sectionsRef.current = initial;
      setSections(initial);
      setIsLoaded(true);
    });
  }, []);

  // Listen to chrome.storage.onChanged and window storage event for real-time cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === 'local' && CHROME_NTP_SECTIONS_KEY in changes) {
        const change = changes[CHROME_NTP_SECTIONS_KEY];
        const newSections = change.newValue as ChromeSection[] | undefined;
        const validSections =
          newSections && Array.isArray(newSections) ? newSections : DEFAULT_SECTIONS;

        // Skip update if content is structurally identical to prevent unnecessary re-renders
        if (JSON.stringify(sectionsRef.current) === JSON.stringify(validSections)) {
          return;
        }

        sectionsRef.current = validSections;
        setSections(validSections);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    } else if (typeof window !== 'undefined') {
      const handleWindowStorage = (e: StorageEvent) => {
        if (e.key === CHROME_NTP_SECTIONS_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue) as ChromeSection[];
            if (Array.isArray(parsed)) {
              if (JSON.stringify(sectionsRef.current) === JSON.stringify(parsed)) {
                return;
              }
              sectionsRef.current = parsed;
              setSections(parsed);
            }
          } catch {
            // ignore
          }
        }
      };

      window.addEventListener('storage', handleWindowStorage);
      return () => {
        window.removeEventListener('storage', handleWindowStorage);
      };
    }
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

  const saveSections = useCallback(async (updated: ChromeSection[]): Promise<void> => {
    sectionsRef.current = updated;
    setSections(updated);
    await setStorageItem(CHROME_NTP_SECTIONS_KEY, updated);
    if (onSectionsChangedRef.current) {
      onSectionsChangedRef.current(updated);
    }
  }, []);

  const replaceSections = useCallback(async (updated: ChromeSection[]): Promise<void> => {
    if (JSON.stringify(sectionsRef.current) === JSON.stringify(updated)) {
      return;
    }
    sectionsRef.current = updated;
    setSections(updated);
    await setStorageItem(CHROME_NTP_SECTIONS_KEY, updated);
  }, []);

  const setSectionsLocally = useCallback((updated: ChromeSection[]): void => {
    sectionsRef.current = updated;
    setSections(updated);
  }, []);

  const commitSections = useCallback(
    async (updated: ChromeSection[]): Promise<void> => {
      await saveSections(updated);
    },
    [saveSections],
  );

  const createSection = useCallback(
    async (title: string): Promise<void> => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const newSec: ChromeSection = {
        id: generateId('sec'),
        title: trimmedTitle,
        items: [],
      };
      await saveSections([...sectionsRef.current, newSec]);
    },
    [saveSections],
  );

  const updateSectionTitle = useCallback(
    async (sectionId: string, title: string): Promise<void> => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const updated = sectionsRef.current.map((s) =>
        s.id === sectionId ? { ...s, title: trimmed } : s,
      );
      await saveSections(updated);
    },
    [saveSections],
  );

  const deleteSection = useCallback(
    async (sectionId: string): Promise<void> => {
      const updated = sectionsRef.current.filter((s) => s.id !== sectionId);
      await saveSections(updated);
    },
    [saveSections],
  );

  const reorderSections = useCallback(
    async (sourceIndex: number, targetIndex: number): Promise<void> => {
      if (sourceIndex === targetIndex) return;
      const updated = [...sectionsRef.current];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      await saveSections(updated);
    },
    [saveSections],
  );

  const addShortcut = useCallback(
    async (
      sectionId: string,
      data: { title: string; url: string; favicon?: string },
    ): Promise<void> => {
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

      const updated = sectionsRef.current.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, newShortcut] } : s,
      );
      await saveSections(updated);

      // Proactively request background service worker to resolve favicon
      if (!customIcon && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url }).catch(() => {});
        } catch {
          // ignore
        }
      }
    },
    [saveSections],
  );

  const saveEditShortcut = useCallback(
    async (data: EditingShortcutData): Promise<void> => {
      const url = normalizeSafeUrl(data.url);
      if (!url) return;

      const title = data.title.trim() || getDomain(url);
      const customIcon = data.favicon?.trim() || undefined;
      const { id, sectionId: targetSecId } = data;

      // Ensure target section exists
      if (!sectionsRef.current.some((s) => s.id === targetSecId)) return;

      let foundShortcut: ChromeShortcutItem | null = null;
      let sourceSectionId: string | null = null;

      for (const s of sectionsRef.current) {
        const item = s.items.find((it) => it.id === id);
        if (item) {
          sourceSectionId = s.id;
          foundShortcut = { ...item, title, url, favicon: customIcon };
          break;
        }
      }

      if (!foundShortcut || !sourceSectionId) return;

      let updated: ChromeSection[];

      if (sourceSectionId === targetSecId) {
        // Edit within same section: preserve original position
        updated = sectionsRef.current.map((s) => {
          if (s.id === targetSecId) {
            return {
              ...s,
              items: s.items.map((it) => (it.id === id ? foundShortcut! : it)),
            };
          }
          return s;
        });
      } else {
        // Moved to another section: remove from source, append to target
        updated = sectionsRef.current.map((s) => {
          if (s.id === sourceSectionId) {
            return {
              ...s,
              items: s.items.filter((it) => it.id !== id),
            };
          }
          if (s.id === targetSecId) {
            return {
              ...s,
              items: [...s.items, foundShortcut!],
            };
          }
          return s;
        });
      }

      await saveSections(updated);

      // Proactively request background service worker to resolve favicon if changed
      if (!customIcon && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({ type: 'RESOLVE_FAVICON', url }).catch(() => {});
        } catch {
          // ignore
        }
      }
    },
    [saveSections],
  );

  const deleteShortcut = useCallback(
    async (id: string, sectionId: string): Promise<void> => {
      const updated = sectionsRef.current.map((s) =>
        s.id === sectionId ? { ...s, items: s.items.filter((it) => it.id !== id) } : s,
      );
      await saveSections(updated);
    },
    [saveSections],
  );

  const reorderItemsInSameSection = useCallback(
    async (sectionId: string, sourceIndex: number, targetIndex: number): Promise<void> => {
      if (sourceIndex === targetIndex) return;
      const updated = sectionsRef.current.map((sec) => {
        if (sec.id === sectionId) {
          const newItems = [...sec.items];
          const [moved] = newItems.splice(sourceIndex, 1);
          newItems.splice(targetIndex, 0, moved);
          return { ...sec, items: newItems };
        }
        return sec;
      });
      await saveSections(updated);
    },
    [saveSections],
  );

  const moveItemAcrossSections = useCallback(
    async (
      sourceSectionId: string,
      sourceIndex: number,
      targetSectionId: string,
      targetIndex: number,
    ): Promise<void> => {
      const sourceSec = sectionsRef.current.find((s) => s.id === sourceSectionId);
      const sourceItem = sourceSec?.items[sourceIndex];
      if (!sourceItem) return;

      const updated = sectionsRef.current.map((sec) => {
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

      await saveSections(updated);
    },
    [saveSections],
  );

  const moveItemToEndOfSection = useCallback(
    async (
      sourceSectionId: string,
      sourceIndex: number,
      targetSectionId: string,
    ): Promise<void> => {
      if (sourceSectionId === targetSectionId) return;
      const sourceSec = sectionsRef.current.find((s) => s.id === sourceSectionId);
      const sourceItem = sourceSec?.items[sourceIndex];
      if (!sourceItem) return;

      const updated = sectionsRef.current.map((sec) => {
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

      await saveSections(updated);
    },
    [saveSections],
  );

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
    setSectionsLocally,
    commitSections,
  };
};
