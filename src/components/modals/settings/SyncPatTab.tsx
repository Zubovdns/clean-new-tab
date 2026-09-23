import React, { useState } from 'react';

import { Icon } from '@components/common/Icon';

export interface SyncPatTabProps {
  isDark: boolean;
  onConnectWithPAT: (token: string) => Promise<void>;
}

export const SyncPatTab = React.memo(({ isDark, onConnectWithPAT }: SyncPatTabProps) => {
  const [patInput, setPatInput] = useState('');
  const [isPatSubmitting, setIsPatSubmitting] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);

  const handlePatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) return;
    setIsPatSubmitting(true);
    setPatError(null);
    try {
      await onConnectWithPAT(patInput.trim());
      setPatInput('');
    } catch (err) {
      setPatError(err instanceof Error ? err.message : 'Ошибка подключения с токеном');
    } finally {
      setIsPatSubmitting(false);
    }
  };

  return (
    <form onSubmit={handlePatSubmit} className="flex flex-col gap-3">
      <div>
        <label className="block text-xs text-[#9aa0a6] mb-1">
          GitHub Personal Access Token (PAT)
        </label>
        <input
          type="password"
          value={patInput}
          onChange={(e) => setPatInput(e.target.value)}
          placeholder="ghp_xxxxxxxxxxxx"
          required
          className={`w-full px-3 py-2 text-xs font-mono rounded-lg outline-none border transition-colors ${
            isDark
              ? 'bg-[#202124] border-[#3c4043] focus:border-[#8ab4f8] text-[#e8eaed]'
              : 'bg-white border-[#dadce0] focus:border-[#1a73e8] text-[#202124]'
          }`}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <a
          href="https://github.com/settings/tokens/new?scopes=gist&description=Clean+New+Tab+Sync"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8ab4f8] hover:underline flex items-center gap-1"
        >
          <span>Создать токен на GitHub (scope: gist)</span>
          <Icon name="open_in_new" size={11} />
        </a>
      </div>

      {patError && <p className="text-xs text-red-400">{patError}</p>}

      <button
        type="submit"
        disabled={isPatSubmitting || !patInput.trim()}
        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
          isDark
            ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
            : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
        } ${isPatSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {isPatSubmitting && <Icon name="sync" size={14} className="animate-spin" />}
        <span>Подключить токен</span>
      </button>
    </form>
  );
});

SyncPatTab.displayName = 'SyncPatTab';
