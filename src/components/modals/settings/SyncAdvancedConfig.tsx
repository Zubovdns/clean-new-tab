import React, { useState } from 'react';
import Icon from '../../common/Icon';

export interface SyncAdvancedConfigProps {
  isDark: boolean;
  customClientId: string;
  setCustomClientId: (id: string) => void;
}

export function SyncAdvancedConfig({
  isDark,
  customClientId,
  setCustomClientId,
}: SyncAdvancedConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="pt-2 border-t border-inherit">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[11px] text-[#9aa0a6] hover:text-inherit flex items-center gap-1 cursor-pointer"
      >
        <span>{showAdvanced ? '▾ Скрыть доп. параметры' : '▸ Свой GitHub OAuth Client ID (опционально)'}</span>
      </button>
      {showAdvanced && (
        <div className="mt-2 text-xs flex flex-col gap-2 p-3 rounded-xl bg-inherit border border-inherit">
          <label className="block text-xs font-medium text-[#9aa0a6]">
            Client ID приложения GitHub:
          </label>
          <input
            type="text"
            value={customClientId}
            onChange={(e) => setCustomClientId(e.target.value)}
            placeholder="Например: Ov23li..."
            className={`w-full px-2.5 py-1.5 text-xs font-mono rounded-lg outline-none border transition-colors ${
              isDark
                ? 'bg-[#202124] border-[#3c4043] focus:border-[#8ab4f8]'
                : 'bg-white border-[#dadce0] focus:border-[#1a73e8]'
            }`}
          />
          <div className="text-[11px] text-[#9aa0a6] space-y-1 pt-1">
            <p className="font-medium text-inherit">
              Как включить вход по коду (30 сек):
            </p>
            <a
              href="https://github.com/settings/applications/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8ab4f8] hover:underline flex items-center gap-1 font-medium"
            >
              <span>1. Открыть регистрацию OAuth App на GitHub</span>
              <Icon name="open_in_new" size={11} />
            </a>
            <p>2. Заполните любое имя (Clean New Tab), Homepage URL (https://github.com).</p>
            <p>3. Обязательно отметьте галочку <b>«Enable Device Flow»</b> ✅</p>
            <p>4. Скопируйте полученный <b>Client ID</b> и вставьте сюда.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(SyncAdvancedConfig);
