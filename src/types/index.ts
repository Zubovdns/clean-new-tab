export interface ChromeShortcutItem {
  id: string;
  type?: 'shortcut';
  title: string;
  url: string;
  favicon?: string;
}

export type ChromeGridItem = ChromeShortcutItem;

export interface ChromeSection {
  id: string;
  title: string;
  items: ChromeShortcutItem[];
}

export interface EditingShortcutData {
  id: string;
  title: string;
  url: string;
  sectionId: string;
  favicon?: string;
}
