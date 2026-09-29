import React, { createContext, useContext } from 'react';

import { ChromeShortcutItem, ChromeSection, EditingShortcutData } from '@app-types';

export interface NewtabContextType {
  isDark: boolean;
  activeMenuId: string | null;
  setActiveMenuId: (id: string | null) => void;
  editingSectionId: string | null;
  editingSectionTitle: string;
  setEditingSectionId: (id: string | null) => void;
  setEditingSectionTitle: (title: string) => void;
  onStartEditingSection: (sec: ChromeSection) => void;
  onSaveEditingSection: () => void | Promise<void>;
  onDeleteSection: (sectionId: string) => void | Promise<void>;
  onOpenAddModal: (sectionId: string) => void;
  onEditShortcut: (data: EditingShortcutData) => void;
  onDeleteShortcut: (id: string, sectionId: string) => void | Promise<void>;
  onItemClick: (item: ChromeShortcutItem, sectionId: string, e?: React.MouseEvent) => void;
  getCachedFavicon: (url: string, favicon?: string) => string;
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
