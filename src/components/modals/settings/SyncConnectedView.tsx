import React from 'react';
import { SyncSettings } from '@app-types';
import { Icon } from '@components/common/Icon';

export interface SyncConnectedViewProps {
  isDark: boolean;
  syncSettings: SyncSettings;
  isSyncing: boolean;
  syncError: string | null;
  onSyncNow: () => void;
  onDisconnect: () => void;
}

export const SyncConnectedView = React.memo(({
  isDark,
  syncSettings,
  isSyncing,
  syncError,
  onSyncNow,
  onDisconnect,
}: SyncConnectedViewProps) => {
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Ещё не выполнялась';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className={`p-4 rounded-xl border flex flex-col gap-4 ${
        isDark ? 'bg-[#303134]/80 border-[#3c4043]' : 'bg-[#f8f9fa] border-[#e8eaed]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {syncSettings.userAvatarUrl ? (
            <img
              src={syncSettings.userAvatarUrl}
              alt={syncSettings.userLogin || 'GitHub'}
              className="w-10 h-10 rounded-full border border-inherit"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#8ab4f8] flex items-center justify-center text-[#202124] font-bold">
              {syncSettings.userLogin?.[0]?.toUpperCase() || 'G'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">@{syncSettings.userLogin}</span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xs text-[#9aa0a6]">Синхронизация активна</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDisconnect}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
            isDark
              ? 'border-[#5f6368] text-[#f28b82] hover:bg-[#3c4043]'
              : 'border-[#dadce0] text-[#d93025] hover:bg-[#fce8e6]'
          }`}
          title="Отключить синхронизацию"
        >
          <Icon name="logout" size={14} />
          <span>Отключить</span>
        </button>
      </div>

      {/* Gist and Status Info */}
      <div className="text-xs space-y-1.5 pt-2 border-t border-inherit">
        <div className="flex justify-between items-center">
          <span className="text-[#9aa0a6]">Хранилище Gist:</span>
          {syncSettings.gistId && (
            <a
              href={`https://gist.github.com/${syncSettings.userLogin || ''}/${syncSettings.gistId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[#8ab4f8] hover:underline"
            >
              <span>{syncSettings.gistId.slice(0, 10)}...</span>
              <Icon name="open_in_new" size={12} />
            </a>
          )}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9aa0a6]">Последняя синхронизация:</span>
          <span>{formatLastSync(syncSettings.lastSyncedAt)}</span>
        </div>
      </div>

      {/* Sync Actions */}
      <div className="pt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onSyncNow}
          disabled={isSyncing}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
            isDark
              ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
              : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
          } ${isSyncing ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <Icon
            name="sync"
            size={15}
            className={isSyncing ? 'animate-spin' : ''}
          />
          <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}</span>
        </button>
      </div>

      {syncError && (
        <p className="text-xs text-red-400 mt-1">{syncError}</p>
      )}
    </div>
  );
});

SyncConnectedView.displayName = 'SyncConnectedView';
