export interface ChromeBookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}

export interface ChromeFolder {
  id: string;
  type: 'folder';
  title: string;
  items: ChromeBookmark[];
}

export interface ChromeShortcutItem {
  id: string;
  type: 'shortcut';
  title: string;
  url: string;
  favicon?: string;
}

export type ChromeGridItem = ChromeShortcutItem | ChromeFolder;

export interface ChromeSection {
  id: string;
  title: string;
  items: ChromeGridItem[];
}
