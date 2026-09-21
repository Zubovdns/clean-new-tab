import { ChromeSection, SyncPayload } from '../../types';

export const GIST_FILENAME = 'clean-new-tab.json';

/**
 * Pull sections data from Gist
 */
export const pullGistData = async (
	token: string,
	gistId: string,
): Promise<SyncPayload> => {
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
};

/**
 * Push sections data to Gist
 */
export const pushGistData = async (
	token: string,
	gistId: string,
	sections: ChromeSection[],
): Promise<{ updatedAt: number }> => {
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
};

/**
 * Find existing Clean New Tab Gist or create a new secret one
 */
export const findOrCreateGist = async (
	token: string,
	currentSections: ChromeSection[],
): Promise<{
	gistId: string;
	sections: ChromeSection[];
	isNew: boolean;
	updatedAt: number;
}> => {
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
};
