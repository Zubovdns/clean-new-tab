import {
	ChromeSection,
	DeviceCodeResponse,
	SyncPayload,
	SyncSettings,
} from '../types';
import { CHROME_NTP_SECTIONS_KEY, setStorageItem } from './storage';

export const CHROME_NTP_SYNC_SETTINGS_KEY = 'chrome_ntp_sync_settings_v1';
export const GIST_FILENAME = 'clean-new-tab.json';

// Pre-configured public OAuth Client ID for Clean New Tab (or user can specify their own)
export const DEFAULT_GITHUB_CLIENT_ID = 'Ov23liTCaImxCmJuli70';

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
export async function getSyncSettings(): Promise<SyncSettings> {
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
}

/**
 * Save sync settings to storage
 */
export async function saveSyncSettings(settings: SyncSettings): Promise<void> {
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
}

/**
 * 1. Request device and user verification code (GitHub OAuth Device Flow)
 */
export async function requestDeviceCode(
	clientId: string,
): Promise<DeviceCodeResponse> {
	const targetClientId = clientId.trim() || DEFAULT_GITHUB_CLIENT_ID;
	const res = await fetch('https://github.com/login/device/code', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			client_id: targetClientId,
			scope: 'gist',
		}),
	});

	if (!res.ok) {
		if (res.status === 404) {
			throw new Error(
				'Client ID не зарегистрирован на GitHub или не включен Device Flow. Зарегистрируйте OAuth App или используйте вкладку "Личный токен (PAT)".',
			);
		}
		const errorText = await res.text();
		throw new Error(
			`Не удалось запросить код устройства (${res.status}): ${errorText}`,
		);
	}

	const data = await res.json();
	if (data.error) {
		throw new Error(`Ошибка GitHub: ${data.error_description || data.error}`);
	}

	return data as DeviceCodeResponse;
}

export interface PollTokenResult {
	access_token?: string;
	error?:
		| 'authorization_pending'
		| 'slow_down'
		| 'expired_token'
		| 'access_denied'
		| string;
	interval?: number;
}

/**
 * 2. Poll GitHub token endpoint while user enters code
 */
export async function pollDeviceToken(
	clientId: string,
	deviceCode: string,
): Promise<PollTokenResult> {
	const targetClientId = clientId.trim() || DEFAULT_GITHUB_CLIENT_ID;
	const res = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			client_id: targetClientId,
			device_code: deviceCode,
			grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
		}),
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`Ошибка при проверке токена: ${errorText}`);
	}

	const data = await res.json();
	return data as PollTokenResult;
}

/**
 * Fetch authenticated GitHub user profile
 */
export async function fetchUserProfile(
	token: string,
): Promise<{ login: string; avatar_url: string; name?: string }> {
	const res = await fetch('https://api.github.com/user', {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github.v3+json',
		},
	});

	if (!res.ok) {
		throw new Error(`Неверный токен или ошибка профиля (${res.status})`);
	}

	return res.json();
}

/**
 * Find existing Clean New Tab Gist or create a new secret one
 */
export async function findOrCreateGist(
	token: string,
	currentSections: ChromeSection[],
): Promise<{
	gistId: string;
	sections: ChromeSection[];
	isNew: boolean;
	updatedAt: number;
}> {
	// 1. List user gists
	const listRes = await fetch('https://api.github.com/gists?per_page=100', {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github.v3+json',
		},
	});

	if (!listRes.ok) {
		throw new Error(`Ошибка при запросе списка Gist (${listRes.status})`);
	}

	const gists = (await listRes.json()) as Array<{
		id?: string;
		files?: Record<string, { content?: string }>;
	}>;
	const existingGist = Array.isArray(gists)
		? gists.find((g) => g.files && g.files[GIST_FILENAME])
		: null;

	if (existingGist && existingGist.id) {
		// Found existing Gist! Fetch its full content
		const remoteData = await pullGistData(token, existingGist.id);
		return {
			gistId: existingGist.id,
			sections: remoteData.sections,
			updatedAt: remoteData.updatedAt || Date.now(),
			isNew: false,
		};
	}

	// 2. Not found -> Create a secret Gist with current sections
	const now = Date.now();
	const payload: SyncPayload = {
		version: 1,
		updatedAt: now,
		sections: currentSections,
	};

	const createRes = await fetch('https://api.github.com/gists', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github.v3+json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			description: 'Clean New Tab - Synchronized Data',
			public: false,
			files: {
				[GIST_FILENAME]: {
					content: JSON.stringify(payload, null, 2),
				},
			},
		}),
	});

	if (!createRes.ok) {
		const errorText = await createRes.text();
		throw new Error(
			`Ошибка при создании Gist (${createRes.status}): ${errorText}`,
		);
	}

	const created = await createRes.json();
	return {
		gistId: created.id,
		sections: currentSections,
		updatedAt: now,
		isNew: true,
	};
}

/**
 * Pull sections data from Gist
 */
export async function pullGistData(
	token: string,
	gistId: string,
): Promise<SyncPayload> {
	const res = await fetch(`https://api.github.com/gists/${gistId}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github.v3+json',
		},
	});

	if (!res.ok) {
		throw new Error(`Не удалось загрузить данные из Gist (${res.status})`);
	}

	const gist = await res.json();
	const file = gist.files?.[GIST_FILENAME];

	if (!file || !file.content) {
		throw new Error(`Файл ${GIST_FILENAME} отсутствует в данном Gist`);
	}

	const parsed = JSON.parse(file.content);
	if (!parsed || !Array.isArray(parsed.sections)) {
		throw new Error('Некорректный формат данных в Gist');
	}

	return {
		version: parsed.version || 1,
		updatedAt:
			typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
		sections: parsed.sections,
	};
}

/**
 * Push sections data to Gist
 */
export async function pushGistData(
	token: string,
	gistId: string,
	sections: ChromeSection[],
): Promise<{ updatedAt: number }> {
	const now = Date.now();
	const payload: SyncPayload = {
		version: 1,
		updatedAt: now,
		sections,
	};

	const res = await fetch(`https://api.github.com/gists/${gistId}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github.v3+json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			files: {
				[GIST_FILENAME]: {
					content: JSON.stringify(payload, null, 2),
				},
			},
		}),
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`Не удалось обновить Gist (${res.status}): ${errorText}`);
	}

	return { updatedAt: now };
}

/**
 * Export sections to a downloadable JSON file
 */
export function exportSectionsToFile(sections: ChromeSection[]) {
	const data = JSON.stringify(
		{
			exportedAt: new Date().toISOString(),
			version: 1,
			sections,
		},
		null,
		2,
	);
	const blob = new Blob([data], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `clean-new-tab-backup-${new Date().toISOString().slice(0, 10)}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Import sections from a JSON file
 */
export function importSectionsFromFile(): Promise<ChromeSection[]> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json,application/json';
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return reject(new Error('Файл не выбран'));

			try {
				const text = await file.text();
				const json = JSON.parse(text);
				const importedSections = Array.isArray(json) ? json : json.sections;
				if (!Array.isArray(importedSections)) {
					throw new Error('Файл не содержит корректных секций Clean New Tab');
				}
				await setStorageItem(CHROME_NTP_SECTIONS_KEY, importedSections);
				resolve(importedSections);
			} catch (err) {
				reject(err);
			}
		};
		input.click();
	});
}
