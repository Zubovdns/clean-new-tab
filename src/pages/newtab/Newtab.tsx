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

  // Active folder opened in modal popup
  const [activeFolderInfo, setActiveFolderInfo] = useState<ActiveFolderInfo | null>(null);

  // Add Item Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetSectionId, setTargetSectionId] = useState<string>('');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);

  // Add Section Modal
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);

  // Inline Section Title Editing
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');

  // Edit Modals
  const [editingShortcut, setEditingShortcut] = useState<EditingShortcutData | null>(null);
  const [editingFolder, setEditingFolder] = useState<EditingFolderData | null>(null);

  // 3-dots Context Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Drag and Drop for SECTIONS
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);
  const draggedSectionIndexRef = useRef<number | null>(null);

  // Drag and Drop for ITEMS
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

  // Find currently open folder in modal
  const activeSection = sections.find((s) => s.id === activeFolderInfo?.sectionId) || null;
  const activeFolder = (activeSection?.items.find(
    (item): item is ChromeFolder => item.id === activeFolderInfo?.folderId && item.type === 'folder'
  ) as ChromeFolder | undefined) || null;

  // =========================================================================
  // SECTION ACTIONS
  // =========================================================================

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

  // =========================================================================
  // SECTION DRAG & DROP
  // =========================================================================

  const handleSectionDragStart = useCallback((e: React.DragEvent, index: number) => {
    isDraggingRef.current = true;
    draggedSectionIndexRef.current = index;
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `sec:${index}`);
  }, []);

  const handleSectionDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (draggedSectionIndexRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSectionIndex !== index) {
      setDragOverSectionIndex(index);
    }
  }, [dragOverSectionIndex]);

  const handleSectionDragEnd = useCallback(() => {
    draggedSectionIndexRef.current = null;
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, []);

  const handleSectionDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    if (draggedSectionIndexRef.current === null) return;
    e.preventDefault();
    e.stopPropagation();

    const sourceIndex = draggedSectionIndexRef.current;
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      reorderSections(sourceIndex, targetIndex);
    }
    handleSectionDragEnd();
  }, [reorderSections, handleSectionDragEnd]);

  // =========================================================================
  // ITEM DRAG & DROP
  // =========================================================================

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
  }, [sections, dragOverFolderTargetId, dragOverItemCoords]);

  const handleItemDragEnd = useCallback(() => {
    draggedItemCoordsRef.current = null;
    setDraggedItemCoords(null);
    setDragOverItemCoords(null);
    setDragOverFolderTargetId(null);
    setDragOverSectionTargetId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, []);

  const handleItemDrop = useCallback((
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

    // Drop Shortcut INTO Folder
    if (
      sourceItem.type === 'shortcut' &&
      targetItem.type === 'folder' &&
      !(source.sectionId === targetSectionId && source.itemIndex === targetItemIndex)
    ) {
      moveItemToFolder(source.sectionId, source.itemIndex, targetSectionId, targetItem.id);
      handleItemDragEnd();
      return;
    }

    // Reordering within SAME section
    if (source.sectionId === targetSectionId) {
      reorderItemsInSameSection(targetSectionId, source.itemIndex, targetItemIndex);
      handleItemDragEnd();
      return;
    }

    // Move ACROSS sections
    moveItemAcrossSections(source.sectionId, source.itemIndex, targetSectionId, targetItemIndex);
    handleItemDragEnd();
  }, [sections, moveItemToFolder, reorderItemsInSameSection, moveItemAcrossSections, handleItemDragEnd]);

  const handleSectionBodyDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    if (draggedSectionIndexRef.current !== null) return;
    if (draggedItemCoordsRef.current === null) return;
    if (dragOverFolderTargetId || dragOverItemCoords) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSectionTargetId !== sectionId) {
      setDragOverSectionTargetId(sectionId);
    }
  }, [dragOverFolderTargetId, dragOverItemCoords, dragOverSectionTargetId]);

  const handleSectionBodyDrop = useCallback((e: React.DragEvent, targetSectionId: string) => {
    if (draggedSectionIndexRef.current !== null) return;
    const source = draggedItemCoordsRef.current;
    if (!source) {
      handleItemDragEnd();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (source.sectionId === targetSectionId) {
      handleItemDragEnd();
      return;
    }

    moveItemToEndOfSection(source.sectionId, source.itemIndex, targetSectionId);
    handleItemDragEnd();
  }, [moveItemToEndOfSection, handleItemDragEnd]);

  // =========================================================================
  // CLICKS
  // =========================================================================

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
            <SectionCard
              key={section.id}
              section={section}
              sectionIndex={sIdx}
              isDark={isDark}
              isDraggingThisSection={isDraggingThisSection}
              isSectionDropTarget={isSectionDropTarget}
              isSectionItemHover={isSectionItemHover}
              draggedItemCoords={draggedItemCoords}
              dragOverItemCoords={dragOverItemCoords}
              dragOverFolderTargetId={dragOverFolderTargetId}
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
            <Icon name="add_circle" size={18} />
            <span>Добавить секцию</span>
          </button>
        </div>
      </div>

      {/* Folder Popup Modal */}
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

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={isAddSectionModalOpen}
        isDark={isDark}
        onClose={() => setIsAddSectionModalOpen(false)}
        onCreate={createSection}
      />

      {/* Add Item Modal */}
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

      {/* Edit Shortcut Modal */}
      <EditShortcutModal
        data={editingShortcut}
        isDark={isDark}
        sections={sections}
        onClose={() => setEditingShortcut(null)}
        onSave={saveEditShortcut}
        onDelete={deleteShortcut}
      />

      {/* Edit Folder Modal */}
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
