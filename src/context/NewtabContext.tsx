import React, { createContext, useContext } from 'react';

import {
  ChromeShortcutItem,
  ChromeSection,
  EditingShortcutData,
} from '@app-types';

export interface NewtabContextType {
  isDark: boolean;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  editingSectionId: string | null;
  editingSectionTitle: string;
  setEditingSectionId: (id: string | null) => void;
  setEditingSectionTitle: (title: string) => void;
  onStartEditingSection: (sec: ChromeSection) => void;
  onSaveEditingSection: () => void;
  onDeleteSection: (sectionId: string) => void;
  onOpenAddModal: (sectionId: string) => void;
  onEditShortcut: (data: EditingShortcutData) => void;
  onDeleteShortcut: (id: string, sectionId: string) => void;
  onItemClick: (item: ChromeShortcutItem, sectionId: string) => void;
  getCachedFavicon: (url: string, favicon?: string) => string;

  // Drag and Drop Orchestration
  draggedSectionIndex: number | null;
  dragOverSectionGap: number | null;
  draggedItemCoords: { sectionId: string; itemIndex: number } | null;
  dragOverItemInfo: { sectionId: string; itemIndex: number; position: 'before' | 'after' } | null;
  dragOverSectionEndId: string | null;
  onSectionDragStart: (e: React.DragEvent, index: number) => void;
  onSectionDragEnd: () => void;
  onSectionDragOver: (e: React.DragEvent, sectionIndex: number, isBottom: boolean) => void;
  onSectionDrop: (e: React.DragEvent, sectionIndex: number, isBottom: boolean) => void;
  onSectionBodyDragOver: (e: React.DragEvent, sectionId: string) => void;
  onSectionBodyDrop: (e: React.DragEvent, sectionId: string) => void;
  onItemDragStart: (e: React.DragEvent, sectionId: string, itemIndex: number) => void;
  onItemDragEnd: () => void;
  onItemDragOver: (
    e: React.DragEvent,
    sectionId: string,
    itemIndex: number,
    item: ChromeShortcutItem,
    position: 'before' | 'after'
  ) => void;
  onItemDrop: (
    e: React.DragEvent,
    sectionId: string,
    itemIndex: number,
    item: ChromeShortcutItem,
    position: 'before' | 'after'
  ) => void;
}

const NewtabContext = createContext<NewtabContextType | null>(null);

export const NewtabProvider: React.FC<{
  value: NewtabContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return <NewtabContext.Provider value={value}>{children}</NewtabContext.Provider>;
};

export const useNewtabContext = (): NewtabContextType => {
  const context = useContext(NewtabContext);
  if (!context) {
    throw new Error('useNewtabContext must be used within a NewtabProvider');
  }
  return context;
};
