import React, { useState } from 'react';

import { ChromeSection } from '@app-types';
import { Icon } from '@components/common/Icon';
import { exportSectionsToFile, importSectionsFromFile } from '@utils/backup';

export interface BackupSectionProps {
  isDark: boolean;
  sections: ChromeSection[];
  onImportSections: (sections: ChromeSection[]) => void;
}

export const BackupSection = React.memo(({
  isDark,
  sections,
  onImportSections,
}: BackupSectionProps) => {
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleImport = async () => {
    try {
      setImportStatus(null);
      const imported = await importSectionsFromFile();
      onImportSections(imported);
      setImportStatus('Закладки успешно импортированы!');
      setTimeout(() => setImportStatus(null), 3000);
    } catch (err) {
      setImportStatus(`Ошибка импорта: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="pt-4 border-t border-inherit">
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Icon name="drive_file_move" size={16} />
        <span>Резервное копирование (JSON)</span>
      </h3>
      <p className="text-xs text-[#9aa0a6] mb-3">
        Сохраните файл со всеми вашими ссылками и секциями на диск или загрузите ранее сохраненный.
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => exportSectionsToFile(sections)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
            isDark
              ? 'border-[#3c4043] bg-[#303134] hover:bg-[#3c4043] text-[#8ab4f8]'
              : 'border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-[#1a73e8]'
          }`}
        >
          <span>Экспорт в JSON</span>
        </button>
        <button
          type="button"
          onClick={handleImport}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
            isDark
              ? 'border-[#3c4043] bg-[#303134] hover:bg-[#3c4043] text-[#8ab4f8]'
              : 'border-[#dadce0] bg-white hover:bg-[#f1f3f4] text-[#1a73e8]'
          }`}
        >
          <span>Импорт из JSON</span>
        </button>
      </div>

      {importStatus && (
        <p className="text-xs text-emerald-400 mt-2 font-medium">{importStatus}</p>
      )}
    </div>
  );
});

BackupSection.displayName = 'BackupSection';
