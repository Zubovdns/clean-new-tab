import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActiveFolderInfo,
  ChromeFolder,
  ChromeGridItem,
  ChromeSection,
  EditingFolderData,
  EditingShortcutData,
} from '@app-types';
import useTheme from '@hooks/useTheme';
import useFaviconCache from '@hooks/useFaviconCache';
import useSections from '@hooks/useSections';
import SectionCard from '@components/section/SectionCard';
import AddSectionModal from '@components/modals/AddSectionModal';
import AddItemModal from '@components/modals/AddItemModal';
import EditShortcutModal from '@components/modals/EditShortcutModal';
import EditFolderModal from '@components/modals/EditFolderModal';
import FolderModal from '@components/modals/FolderModal';
import Icon from '@components/common/Icon';

export default function Newtab() {
  const isDark = useTheme();
  const { getCachedFavicon } = useFaviconCache();
  const {
    sections,
    isLoaded,
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
  } = useSections();

  const [activeFolderInfo, setActiveFolderInfo] = useState<ActiveFolderInfo | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [editingShortcut, setEditingShortcut] = useState<EditingShortcutData | null>(null);
  const [editingFolder, setEditingFolder] = useState<EditingFolderData | null>(null);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionGap, setDragOverSectionGap] = useState<number | null>(null);
  const draggedSectionIndexRef = useRef<number | null>(null);

  const [draggedItemCoords, setDraggedItemCoords] = useState<{
    sectionId: string;
    itemIndex: number;
  } | null>(null);
  const draggedItemCoordsRef = useRef<{
    sectionId: string;
    itemIndex: number;
  } | null>(null);

  const [dragOverItemInfo, setDragOverItemInfo] = useState<{
    sectionId: string;
    itemIndex: number;
    position: 'before' | 'after';
  } | null>(null);
  const [dragOverFolderTargetId, setDragOverFolderTargetId] = useState<string | null>(null);
  const [dragOverSectionEndId, setDragOverSectionEndId] = useState<string | null>(null);

  const isDraggingRef = useRef(false);

  // Close active modals and dropdowns on Escape
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

  const activeSection = sections.find((s) => s.id === activeFolderInfo?.sectionId) || null;
  const activeFolder = (activeSection?.items.find(
    (item): item is ChromeFolder => item.id === activeFolderInfo?.folderId && item.type === 'folder'
  ) as ChromeFolder | undefined) || null;

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

  const handleDeleteSection = useCallback((sectionId: string) => {
    const sec = sections.find((s) => s.id === sectionId);
    if (!sec) return;

    if (sec.items.length > 0) {
      const ok = window.confirm(`Удалить секцию "${sec.title}" и все элементы в ней?`);
      if (!ok) return;
    }

    deleteSection(sectionId);
    if (activeFolderInfo?.sectionId === sectionId) {
      setActiveFolderInfo(null);
    }
    setActiveMenuId(null);
  }, [sections, deleteSection, activeFolderInfo]);

  const handleOpenAddModal = useCallback((sectionId: string, folderId: string | null = null) => {
    setTargetSectionId(sectionId);
    setTargetFolderId(folderId);
    setIsAddModalOpen(true);
  }, []);

  const handleSectionDragStart = useCallback((e: React.DragEvent, index: number) => {
    isDraggingRef.current = true;
    draggedSectionIndexRef.current = index;
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `sec:${index}`);
  }, []);

  const handleSectionDragOver = useCallback((
    e: React.DragEvent,
    sectionIndex: number,
    isBottom: boolean
  ) => {
    if (draggedSectionIndexRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetGap = isBottom ? sectionIndex + 1 : sectionIndex;
    if (dragOverSectionGap !== targetGap) {
      setDragOverSectionGap(targetGap);
    }
  }, [dragOverSectionGap]);

  const handleSectionDragEnd = useCallback(() => {
    draggedSectionIndexRef.current = null;
    setDraggedSectionIndex(null);
    setDragOverSectionGap(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, []);

  const handleSectionDrop = useCallback((
    e: React.DragEvent,
    sectionIndex: number,
    isBottom: boolean
  ) => {
    if (draggedSectionIndexRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();

    const sourceIndex = draggedSectionIndexRef.current;
    const targetGap = isBottom ? sectionIndex + 1 : sectionIndex;

    if (targetGap !== sourceIndex && targetGap !== sourceIndex + 1) {
      const finalIndex = targetGap > sourceIndex ? targetGap - 1 : targetGap;
      reorderSections(sourceIndex, finalIndex);
    }
    handleSectionDragEnd();
  }, [reorderSections, handleSectionDragEnd]);

  const handleItemDragStart = useCallback((e: React.DragEvent, sectionId: string, itemIndex: number) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    const coords = { sectionId, itemIndex };
    draggedItemCoordsRef.current = coords;
    setDraggedItemCoords(coords);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `item:${sectionId}:${itemIndex}`);
  }, []);

  const handleItemDragOver = useCallback((
    e: React.DragEvent,
    sectionId: string,
    itemIndex: number,
    targetItem: ChromeGridItem,
    position: 'before' | 'after' | 'inside'
  ) => {
    if (draggedSectionIndexRef.current !== null) return;
    const source = draggedItemCoordsRef.current;
    if (!source) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const sourceSec = sections.find((s) => s.id === source.sectionId);
    const sourceItem = sourceSec?.items[source.itemIndex];
    const canNestInFolder =
      sourceItem?.type === 'shortcut' &&
      targetItem.type === 'folder' &&
      !(source.sectionId === sectionId && source.itemIndex === itemIndex);

    if (position === 'inside' && canNestInFolder) {
      if (dragOverFolderTargetId !== targetItem.id) {
        setDragOverFolderTargetId(targetItem.id);
        setDragOverItemInfo(null);
        setDragOverSectionEndId(null);
      }
      return;
    }

    const effectivePosition: 'before' | 'after' = position === 'inside' ? 'after' : position;

    setDragOverFolderTargetId(null);
    setDragOverSectionEndId(null);

    if (
      !dragOverItemInfo ||
      dragOverItemInfo.sectionId !== sectionId ||
      dragOverItemInfo.itemIndex !== itemIndex ||
      dragOverItemInfo.position !== effectivePosition
    ) {
      setDragOverItemInfo({ sectionId, itemIndex, position: effectivePosition });
    }
  }, [sections, dragOverFolderTargetId, dragOverItemInfo]);

  const handleItemDragEnd = useCallback(() => {
    draggedItemCoordsRef.current = null;
    setDraggedItemCoords(null);
    setDragOverItemInfo(null);
    setDragOverFolderTargetId(null);
    setDragOverSectionEndId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, []);

  const handleItemDrop = useCallback((
    e: React.DragEvent,
    targetSectionId: string,
    targetItemIndex: number,
    targetItem: ChromeGridItem,
    position: 'before' | 'after' | 'inside'
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

    // Nest shortcut into folder when dropped directly inside a folder
    if (
      position === 'inside' &&
      sourceItem.type === 'shortcut' &&
      targetItem.type === 'folder' &&
      !(source.sectionId === targetSectionId && source.itemIndex === targetItemIndex)
    ) {
      moveItemToFolder(source.sectionId, source.itemIndex, targetSectionId, targetItem.id);
      handleItemDragEnd();
      return;
    }

    const effectivePosition: 'before' | 'after' = position === 'inside' ? 'after' : position;

    // Reorder within same section
    if (source.sectionId === targetSectionId) {
      const insertIndex = effectivePosition === 'before' ? targetItemIndex : targetItemIndex + 1;
      const finalIndex = insertIndex > source.itemIndex ? insertIndex - 1 : insertIndex;
      if (source.itemIndex !== finalIndex) {
        reorderItemsInSameSection(targetSectionId, source.itemIndex, finalIndex);
      }
      handleItemDragEnd();
      return;
    }

    // Transfer item across sections
    const targetIndex = effectivePosition === 'before' ? targetItemIndex : targetItemIndex + 1;
    moveItemAcrossSections(source.sectionId, source.itemIndex, targetSectionId, targetIndex);
    handleItemDragEnd();
  }, [sections, moveItemToFolder, reorderItemsInSameSection, moveItemAcrossSections, handleItemDragEnd]);

  const handleSectionBodyDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    if (draggedSectionIndexRef.current !== null) return;
    if (draggedItemCoordsRef.current === null) return;
    if (dragOverFolderTargetId || dragOverItemInfo) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSectionEndId !== sectionId) {
      setDragOverSectionEndId(sectionId);
    }
  }, [dragOverFolderTargetId, dragOverItemInfo, dragOverSectionEndId]);

  const handleSectionBodyDrop = useCallback((e: React.DragEvent, targetSectionId: string) => {
    if (draggedSectionIndexRef.current !== null) return;
    const source = draggedItemCoordsRef.current;
    if (!source) {
      handleItemDragEnd();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const targetSec = sections.find((s) => s.id === targetSectionId);
    if (!targetSec) {
      handleItemDragEnd();
      return;
    }

    if (source.sectionId === targetSectionId) {
      const finalIndex = targetSec.items.length - 1;
      if (source.itemIndex !== finalIndex) {
        reorderItemsInSameSection(targetSectionId, source.itemIndex, finalIndex);
      }
      handleItemDragEnd();
      return;
    }

    moveItemToEndOfSection(source.sectionId, source.itemIndex, targetSectionId);
    handleItemDragEnd();
  }, [sections, reorderItemsInSameSection, moveItemToEndOfSection, handleItemDragEnd]);

  const handleItemClick = useCallback((item: ChromeGridItem, sectionId: string) => {
    if (isDraggingRef.current) return;
    if (item.type === 'folder') {
      setActiveFolderInfo({ sectionId, folderId: item.id });
    } else {
      window.location.href = item.url;
    }
  }, []);

  const handleBookmarkClick = useCallback((url: string) => {
    if (isDraggingRef.current) return;
    window.location.href = url;
  }, []);

  if (!isLoaded) {
    return <div className={`min-h-screen ${isDark ? 'bg-[#202124]' : 'bg-white'}`} />;
  }

  return (
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
        {sections.map((section, sIdx) => {
          const isDraggingThisSection = draggedSectionIndex === sIdx;
          const isLastSection = sIdx === sections.length - 1;
          const isSelfGap =
            draggedSectionIndex !== null &&
            (dragOverSectionGap === draggedSectionIndex || dragOverSectionGap === draggedSectionIndex + 1);

          const showSectionDropIndicatorBefore =
            draggedSectionIndex !== null &&
            !isDraggingThisSection &&
            !isSelfGap &&
            dragOverSectionGap === sIdx;

          const showSectionDropIndicatorAfter =
            draggedSectionIndex !== null &&
            !isDraggingThisSection &&
            !isSelfGap &&
            isLastSection &&
            dragOverSectionGap === sections.length;

          return (
            <SectionCard
              key={section.id}
              section={section}
              sectionIndex={sIdx}
              isDark={isDark}
              isDraggingThisSection={isDraggingThisSection}
              draggedSectionIndex={draggedSectionIndex}
              showSectionDropIndicatorBefore={showSectionDropIndicatorBefore}
              showSectionDropIndicatorAfter={showSectionDropIndicatorAfter}
              draggedItemCoords={draggedItemCoords}
              dragOverItemInfo={dragOverItemInfo}
              dragOverFolderTargetId={dragOverFolderTargetId}
              dragOverSectionEndId={dragOverSectionEndId}
              onSectionDragStart={handleSectionDragStart}
              onSectionDragEnd={handleSectionDragEnd}
              onSectionDragOver={handleSectionDragOver}
              onSectionDrop={handleSectionDrop}
              onSectionBodyDragOver={handleSectionBodyDragOver}
              onSectionBodyDrop={handleSectionBodyDrop}
              onItemClick={handleItemClick}
              onItemDragStart={handleItemDragStart}
              onItemDragEnd={handleItemDragEnd}
              onItemDragOver={handleItemDragOver}
              onItemDrop={handleItemDrop}
              onOpenAddModal={handleOpenAddModal}
              onStartEditingSection={handleStartEditingSection}
              onSaveEditingSection={handleSaveEditingSection}
              onDeleteSection={handleDeleteSection}
              editingSectionId={editingSectionId}
              editingSectionTitle={editingSectionTitle}
              setEditingSectionTitle={setEditingSectionTitle}
              setEditingSectionId={setEditingSectionId}
              onEditShortcut={setEditingShortcut}
              onDeleteShortcut={deleteShortcut}
              onEditFolder={setEditingFolder}
              onDeleteFolder={deleteFolder}
              getCachedFavicon={getCachedFavicon}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
            />
          );
        })}

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

      <FolderModal
        isOpen={Boolean(activeFolder && activeSection)}
        isDark={isDark}
        activeSection={activeSection}
        activeFolder={activeFolder}
        onClose={() => setActiveFolderInfo(null)}
        onBookmarkClick={handleBookmarkClick}
        onOpenAddModal={(secId, fId) => handleOpenAddModal(secId, fId)}
        onOpenEditModal={setEditingShortcut}
        onDeleteBookmark={(id, secId, fId) => deleteShortcut(id, secId, fId)}
        onReorderBookmarks={reorderFolderItems}
        getCachedFavicon={getCachedFavicon}
        activeMenuId={activeMenuId}
        setActiveMenuId={setActiveMenuId}
      />

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
        targetFolderId={targetFolderId}
        onClose={() => setIsAddModalOpen(false)}
        onSaveShortcut={addShortcut}
        onSaveFolder={addFolder}
      />

      <EditShortcutModal
        data={editingShortcut}
        isDark={isDark}
        sections={sections}
        onClose={() => setEditingShortcut(null)}
        onSave={saveEditShortcut}
        onDelete={deleteShortcut}
      />

      <EditFolderModal
        data={editingFolder}
        isDark={isDark}
        sections={sections}
        onClose={() => setEditingFolder(null)}
        onSave={saveEditFolder}
        onDelete={deleteFolder}
      />
    </div>
  );
}
