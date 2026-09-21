import { ChromeSection } from '../types';
import { CHROME_NTP_SECTIONS_KEY, setStorageItem } from './storage';

/**
 * Export sections to a downloadable JSON file
 */
export function exportSectionsToFile(sections: ChromeSection[]): void {
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
