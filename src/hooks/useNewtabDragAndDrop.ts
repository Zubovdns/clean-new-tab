import React, { useState, useRef, useCallback } from 'react';

import { ChromeSection, ChromeShortcutItem } from '@app-types';

interface UseNewtabDragAndDropParams {
  sections: ChromeSection[];
  reorderSections: (sourceIndex: number, destinationIndex: number) => void;
  reorderItemsInSameSection: (sectionId: string, sourceIndex: number, destinationIndex: number) => void;
  moveItemAcrossSections: (
    sourceSectionId: string,
    sourceItemIndex: number,
    targetSectionId: string,
    targetItemIndex: number
  ) => void;
  moveItemToEndOfSection: (sourceSectionId: string, sourceItemIndex: number, targetSectionId: string) => void;
}

export const useNewtabDragAndDrop = ({
  sections,
  reorderSections,
  reorderItemsInSameSection,
  moveItemAcrossSections,
  moveItemToEndOfSection,
}: UseNewtabDragAndDropParams) => {
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
  const [dragOverSectionEndId, setDragOverSectionEndId] = useState<string | null>(null);

  const isDraggingRef = useRef(false);

  const handleSectionDragStart = useCallback((e: React.DragEvent, index: number) => {
    isDraggingRef.current = true;
    draggedSectionIndexRef.current = index;
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `sec:${index}`);
  }, []);

  const handleSectionDragOver = useCallback(
    (e: React.DragEvent, sectionIndex: number, isBottom: boolean) => {
      if (draggedSectionIndexRef.current === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const targetGap = isBottom ? sectionIndex + 1 : sectionIndex;
      if (dragOverSectionGap !== targetGap) {
        setDragOverSectionGap(targetGap);
      }
    },
    [dragOverSectionGap]
  );

  const handleSectionDragEnd = useCallback(() => {
    draggedSectionIndexRef.current = null;
    setDraggedSectionIndex(null);
    setDragOverSectionGap(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, []);

  const handleSectionDrop = useCallback(
    (e: React.DragEvent, sectionIndex: number, isBottom: boolean) => {
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
    },
    [reorderSections, handleSectionDragEnd]
  );

  const handleItemDragStart = useCallback((e: React.DragEvent, sectionId: string, itemIndex: number) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    const coords = { sectionId, itemIndex };
    draggedItemCoordsRef.current = coords;
    setDraggedItemCoords(coords);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `item:${sectionId}:${itemIndex}`);
  }, []);

  const handleItemDragOver = useCallback(
    (
      e: React.DragEvent,
      sectionId: string,
      itemIndex: number,
      _targetItem: ChromeShortcutItem,
      position: 'before' | 'after'
    ) => {
      if (draggedSectionIndexRef.current !== null) return;
      const source = draggedItemCoordsRef.current;
      if (!source) return;

      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';

      setDragOverSectionEndId(null);

      if (
        !dragOverItemInfo ||
        dragOverItemInfo.sectionId !== sectionId ||
        dragOverItemInfo.itemIndex !== itemIndex ||
        dragOverItemInfo.position !== position
      ) {
        setDragOverItemInfo({ sectionId, itemIndex, position });
      }
    },
    [dragOverItemInfo]
  );

  const handleItemDragEnd = useCallback(() => {
    draggedItemCoordsRef.current = null;
    setDraggedItemCoords(null);
    setDragOverItemInfo(null);
    setDragOverSectionEndId(null);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  }, []);

  const handleItemDrop = useCallback(
    (
      e: React.DragEvent,
      targetSectionId: string,
      targetItemIndex: number,
      _targetItem: ChromeShortcutItem,
      position: 'before' | 'after'
    ) => {
      if (draggedSectionIndexRef.current !== null) return;
      const source = draggedItemCoordsRef.current;
      if (!source) {
        handleItemDragEnd();
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Reorder within same section
      if (source.sectionId === targetSectionId) {
        const insertIndex = position === 'before' ? targetItemIndex : targetItemIndex + 1;
        const finalIndex = insertIndex > source.itemIndex ? insertIndex - 1 : insertIndex;
        if (source.itemIndex !== finalIndex) {
          reorderItemsInSameSection(targetSectionId, source.itemIndex, finalIndex);
        }
        handleItemDragEnd();
        return;
      }

      // Transfer item across sections
      const targetIndex = position === 'before' ? targetItemIndex : targetItemIndex + 1;
      moveItemAcrossSections(source.sectionId, source.itemIndex, targetSectionId, targetIndex);
      handleItemDragEnd();
    },
    [reorderItemsInSameSection, moveItemAcrossSections, handleItemDragEnd]
  );

  const handleSectionBodyDragOver = useCallback(
    (e: React.DragEvent, sectionId: string) => {
      if (draggedSectionIndexRef.current !== null) return;
      if (draggedItemCoordsRef.current === null) return;
      if (dragOverItemInfo) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverSectionEndId !== sectionId) {
        setDragOverSectionEndId(sectionId);
      }
    },
    [dragOverItemInfo, dragOverSectionEndId]
  );

  const handleSectionBodyDrop = useCallback(
    (e: React.DragEvent, targetSectionId: string) => {
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
    },
    [sections, reorderItemsInSameSection, moveItemToEndOfSection, handleItemDragEnd]
  );

  return {
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
  };
};


