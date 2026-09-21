import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { NewtabProvider, NewtabContextType } from '@/context/NewtabContext';
import { ChromeShortcutItem, ChromeSection, EditingShortcutData } from '@app-types';
import { Icon } from '@components/common/Icon';
import { AddItemModal } from '@components/modals/AddItemModal';
import { AddSectionModal } from '@components/modals/AddSectionModal';
import { EditShortcutModal } from '@components/modals/EditShortcutModal';
import { SettingsModal } from '@components/modals/SettingsModal';
import { SectionCard } from '@components/section/SectionCard';
import { useFaviconCache } from '@hooks/useFaviconCache';
import { useNewtabDragAndDrop } from '@hooks/useNewtabDragAndDrop';
import { useSections } from '@hooks/useSections';
import { useSync } from '@hooks/useSync';
import { useTheme } from '@hooks/useTheme';
import { normalizeSafeUrl } from '@utils/security';

export const Newtab = () => {
  const isDark = useTheme();
  const { getCachedFavicon } = useFaviconCache();

  const syncNotifyRef = useRef<((s: ChromeSection[]) => void) | null>(null);

  const handleSectionsChangedLocally = useCallback((updated: ChromeSection[]) => {
    if (syncNotifyRef.current) {
      syncNotifyRef.current(updated);
    }
  }, []);

  const {
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
  } = useSections(handleSectionsChangedLocally);

  const handleRemoteSectionsLoaded = useCallback(
    (remoteSections: ChromeSection[]) => {
      replaceSections(remoteSections);
    },
    [replaceSections],
  );

  const {
    syncSettings,
    isSyncing,
    syncError,
    deviceFlow,
    startDeviceFlow,
    cancelDeviceFlow,
    connectWithPAT,
    disconnect,
    syncNow,
    notifySectionsChanged,
  } = useSync(sections, handleRemoteSectionsLoaded);

  useEffect(() => {
    syncNotifyRef.current = notifySectionsChanged;
  }, [notifySectionsChanged]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [editingShortcut, setEditingShortcut] = useState<EditingShortcutData | null>(null);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Drag and drop orchestration
  const {
    isDraggingRef,
    draggedSectionIndex,
    dragOverSectionGap,
    draggedItemCoords,
    dragOverItemInfo,
    dragOverSectionEndId,
    handleSectionDragStart,
    handleSectionDragOver,
    handleSectionDragEnd,
    handleSectionDrop,
    handleItemDragStart,
    handleItemDragOver,
    handleItemDragEnd,
    handleItemDrop,
    handleSectionBodyDragOver,
    handleSectionBodyDrop,
  } = useNewtabDragAndDrop({
    sections,
    reorderSections,
    reorderItemsInSameSection,
    moveItemAcrossSections,
    moveItemToEndOfSection,
  });

  // Close active modals and dropdowns on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddModalOpen(false);
        setIsAddSectionModalOpen(false);
        setEditingShortcut(null);
        setActiveMenuId(null);
        setEditingSectionId(null);
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStartEditingSection = useCallback((sec: ChromeSection) => {
    setEditingSectionId(sec.id);
    setEditingSectionTitle(sec.title);
    setActiveMenuId(null);
  }, []);

  const handleSaveEditingSection = useCallback(() => {
    if (!editingSectionId) return;
    updateSectionTitle(editingSectionId, editingSectionTitle);
    setEditingSectionId(null);
  }, [editingSectionId, editingSectionTitle, updateSectionTitle]);

  const handleDeleteSection = useCallback(
    (sectionId: string) => {
      const sec = sections.find((s) => s.id === sectionId);
      if (!sec) return;

      if (sec.items.length > 0) {
        const ok = window.confirm(`Удалить секцию "${sec.title}" и все элементы в ней?`);
        if (!ok) return;
      }

      deleteSection(sectionId);
      setActiveMenuId(null);
    },
    [sections, deleteSection],
  );

  const handleOpenAddModal = useCallback((sectionId: string) => {
    setTargetSectionId(sectionId);
    setIsAddModalOpen(true);
  }, []);

  const handleItemClick = useCallback(
    (item: ChromeShortcutItem) => {
      if (isDraggingRef.current) return;
      const safeUrl = normalizeSafeUrl(item.url);
      if (safeUrl) {
        window.location.href = safeUrl;
      }
    },
    [isDraggingRef],
  );

  const contextValue: NewtabContextType = useMemo(
    () => ({
      isDark,
      activeMenuId,
      setActiveMenuId,
      editingSectionId,
      editingSectionTitle,
      setEditingSectionId,
      setEditingSectionTitle,
      onStartEditingSection: handleStartEditingSection,
      onSaveEditingSection: handleSaveEditingSection,
      onDeleteSection: handleDeleteSection,
      onOpenAddModal: handleOpenAddModal,
      onEditShortcut: setEditingShortcut,
      onDeleteShortcut: deleteShortcut,
      onItemClick: handleItemClick,
      getCachedFavicon,
      draggedSectionIndex,
      dragOverSectionGap,
      draggedItemCoords,
      dragOverItemInfo,
      dragOverSectionEndId,
      onSectionDragStart: handleSectionDragStart,
      onSectionDragEnd: handleSectionDragEnd,
      onSectionDragOver: handleSectionDragOver,
      onSectionDrop: handleSectionDrop,
      onSectionBodyDragOver: handleSectionBodyDragOver,
      onSectionBodyDrop: handleSectionBodyDrop,
      onItemDragStart: handleItemDragStart,
      onItemDragEnd: handleItemDragEnd,
      onItemDragOver: handleItemDragOver,
      onItemDrop: handleItemDrop,
    }),
    [
      isDark,
      activeMenuId,
      editingSectionId,
      editingSectionTitle,
      handleStartEditingSection,
      handleSaveEditingSection,
      handleDeleteSection,
      handleOpenAddModal,
      deleteShortcut,
      handleItemClick,
      getCachedFavicon,
      draggedSectionIndex,
      dragOverSectionGap,
      draggedItemCoords,
      dragOverItemInfo,
      dragOverSectionEndId,
      handleSectionDragStart,
      handleSectionDragEnd,
      handleSectionDragOver,
      handleSectionDrop,
      handleSectionBodyDragOver,
      handleSectionBodyDrop,
      handleItemDragStart,
      handleItemDragEnd,
      handleItemDragOver,
      handleItemDrop,
    ],
  );

  if (!isLoaded) {
    return <div className={`min-h-screen ${isDark ? 'bg-[#202124]' : 'bg-white'}`} />;
  }

  return (
    <NewtabProvider value={contextValue}>
      <div
        className={`min-h-screen flex flex-col items-center justify-start font-sans transition-colors duration-150 py-12 px-6 select-none ${
          isDark ? 'bg-[#202124] text-[#e8eaed]' : 'bg-white text-[#202124]'
        }`}
        onClick={() => {
          if (activeMenuId) setActiveMenuId(null);
          if (editingSectionId) handleSaveEditingSection();
        }}
      >
        <div className="w-full max-w-[820px] flex flex-col gap-8">
          {sections.map((section, sIdx) => (
            <SectionCard
              key={section.id}
              section={section}
              sectionIndex={sIdx}
              totalSections={sections.length}
            />
          ))}

          {/* Add section button */}
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
              <Icon name="add_circle" size={18} />
              <span>Добавить секцию</span>
            </button>
          </div>
        </div>

        {/* Floating Settings & Sync Button */}
        <div className="fixed top-5 right-6 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-medium cursor-pointer transition-all shadow-xs ${
              isDark
                ? 'border-[#3c4043] bg-[#28292c]/80 hover:bg-[#35363a] text-[#e8eaed] hover:border-[#8ab4f8]'
                : 'border-[#dadce0] bg-white/90 hover:bg-[#f1f3f4] text-[#202124] hover:border-[#1a73e8]'
            }`}
            title={
              syncSettings.enabled
                ? `Синхронизация активна (@${syncSettings.userLogin || 'GitHub'})`
                : 'Настройки и синхронизация'
            }
          >
            <Icon
              name="settings"
              size={16}
              className={`transition-transform duration-300 group-hover:rotate-45 ${
                isSyncing ? 'animate-spin text-[#8ab4f8]' : ''
              }`}
            />
            {syncSettings.enabled && (
              <span
                className={`w-2 h-2 rounded-full ${
                  isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                }`}
              />
            )}
          </button>
        </div>

        <AddSectionModal
          isOpen={isAddSectionModalOpen}
          isDark={isDark}
          onClose={() => setIsAddSectionModalOpen(false)}
          onCreate={createSection}
        />

        <AddItemModal
          isOpen={isAddModalOpen}
          isDark={isDark}
          sections={sections}
          targetSectionId={targetSectionId}
          onClose={() => setIsAddModalOpen(false)}
          onSaveShortcut={addShortcut}
        />

        <EditShortcutModal
          data={editingShortcut}
          isDark={isDark}
          sections={sections}
          onClose={() => setEditingShortcut(null)}
          onSave={saveEditShortcut}
          onDelete={deleteShortcut}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          isDark={isDark}
          onClose={() => setIsSettingsOpen(false)}
          sections={sections}
          onImportSections={replaceSections}
          syncSettings={syncSettings}
          isSyncing={isSyncing}
          syncError={syncError}
          deviceFlow={deviceFlow}
          onStartDeviceFlow={startDeviceFlow}
          onCancelDeviceFlow={cancelDeviceFlow}
          onConnectWithPAT={connectWithPAT}
          onDisconnect={disconnect}
          onSyncNow={syncNow}
        />
      </div>
    </NewtabProvider>
  );
};
