import { SyncSettings } from '@app-types';

export const CHROME_NTP_SYNC_SETTINGS_KEY = 'chrome_ntp_sync_settings_v1';

export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
	enabled: false,
	authType: 'device_flow',
	token: null,
	gistId: null,
	userLogin: null,
	userAvatarUrl: null,
	lastSyncedAt: null,
	customClientId: '',
};

/**
 * Load sync settings from storage
 */
export const getSyncSettings = async (): Promise<SyncSettings> => {
	try {
		if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
			const result = await chrome.storage.local.get([
				CHROME_NTP_SYNC_SETTINGS_KEY,
			]);
			if (result[CHROME_NTP_SYNC_SETTINGS_KEY]) {
				return {
					...DEFAULT_SYNC_SETTINGS,
					...result[CHROME_NTP_SYNC_SETTINGS_KEY],
				};
			}
		} else if (typeof window !== 'undefined' && window.localStorage) {
			const item = window.localStorage.getItem(CHROME_NTP_SYNC_SETTINGS_KEY);
			if (item) {
				return { ...DEFAULT_SYNC_SETTINGS, ...JSON.parse(item) };
			}
		}
	} catch (err) {
		console.warn('[githubSync] Error loading sync settings:', err);
	}
	return DEFAULT_SYNC_SETTINGS;
};

/**
 * Save sync settings to storage
 */
export const saveSyncSettings = async (settings: SyncSettings): Promise<void> => {
	try {
		if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
			await chrome.storage.local.set({
				[CHROME_NTP_SYNC_SETTINGS_KEY]: settings,
			});
		} else if (typeof window !== 'undefined' && window.localStorage) {
			window.localStorage.setItem(
				CHROME_NTP_SYNC_SETTINGS_KEY,
				JSON.stringify(settings),
			);
		}
	} catch (err) {
		console.warn('[githubSync] Error saving sync settings:', err);
	}
};
