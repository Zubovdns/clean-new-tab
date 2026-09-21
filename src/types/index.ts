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

export interface SyncPayload {
  version: number;
  updatedAt: number;
  sections: ChromeSection[];
}

export interface SyncSettings {
  enabled: boolean;
  authType: 'device_flow' | 'pat';
  token: string | null;
  gistId: string | null;
  userLogin: string | null;
  userAvatarUrl: string | null;
  lastSyncedAt: number | null;
  customClientId?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

