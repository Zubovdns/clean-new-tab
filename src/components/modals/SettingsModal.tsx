import React, { useState, useEffect } from 'react';

import { ChromeSection, SyncSettings } from '@app-types';
import { Icon } from '@components/common/Icon';
import { BackupSection } from '@components/modals/settings/BackupSection';
import { SyncAdvancedConfig } from '@components/modals/settings/SyncAdvancedConfig';
import { SyncConnectedView } from '@components/modals/settings/SyncConnectedView';
import { SyncDeviceFlowTab } from '@components/modals/settings/SyncDeviceFlowTab';
import { SyncPatTab } from '@components/modals/settings/SyncPatTab';
import { DeviceFlowState } from '@hooks/useSync';

export interface SettingsModalProps {
  isOpen: boolean;
  isDark: boolean;
  onClose: () => void;
  sections: ChromeSection[];
  onImportSections: (sections: ChromeSection[]) => void;
  syncSettings: SyncSettings;
  isSyncing: boolean;
  syncError: string | null;
  deviceFlow: DeviceFlowState;
  onStartDeviceFlow: (customClientId?: string) => void;
  onCancelDeviceFlow: () => void;
  onConnectWithPAT: (token: string) => Promise<void>;
  onDisconnect: () => void;
  onSyncNow: () => void;
}

export const SettingsModal = React.memo(({
  isOpen,
  isDark,
  onClose,
  sections,
  onImportSections,
  syncSettings,
  isSyncing,
  syncError,
  deviceFlow,
  onStartDeviceFlow,
  onCancelDeviceFlow,
  onConnectWithPAT,
  onDisconnect,
  onSyncNow,
}: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<'device' | 'pat'>('device');
  const [customClientId, setCustomClientId] = useState('');

  useEffect(() => {
    if (!isOpen) {
      onCancelDeviceFlow();
    }
  }, [isOpen, onCancelDeviceFlow]);

  if (!isOpen) return null;

  const isConnected = Boolean(syncSettings.enabled && syncSettings.token);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl border transition-all ${
          isDark
            ? 'bg-[#28292c] border-[#3c4043] text-[#e8eaed]'
            : 'bg-white border-[#dadce0] text-[#202124]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-inherit mb-5">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${isDark ? 'bg-[#35363a] text-[#8ab4f8]' : 'bg-[#e8f0fe] text-[#1a73e8]'}`}>
              <Icon name="settings" size={20} />
            </div>
            <h2 className="text-base font-semibold">Настройки и Синхронизация</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#35363a] text-[#9aa0a6]' : 'hover:bg-[#f1f3f4] text-[#5f6368]'
            }`}
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Section 1: GitHub Synchronization */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="github" size={18} />
            <h3 className="text-sm font-semibold">Синхронизация через GitHub Gist</h3>
          </div>

          {isConnected ? (
            <SyncConnectedView
              isDark={isDark}
              syncSettings={syncSettings}
              isSyncing={isSyncing}
              syncError={syncError}
              onSyncNow={onSyncNow}
              onDisconnect={onDisconnect}
            />
          ) : (
            <div
              className={`p-4 rounded-xl border flex flex-col gap-4 ${
                isDark ? 'bg-[#303134]/80 border-[#3c4043]' : 'bg-[#f8f9fa] border-[#e8eaed]'
              }`}
            >
              <p className="text-xs text-[#9aa0a6] leading-relaxed">
                Синхронизируйте секции и закладки между браузерами и компьютерами в защищенный Secret Gist на вашем GitHub аккаунте.
              </p>

              {/* Tabs: Device Flow vs PAT */}
              <div className="flex border-b border-inherit text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('device');
                    onCancelDeviceFlow();
                  }}
                  className={`pb-2 px-3 font-medium transition-colors border-b-2 cursor-pointer ${
                    activeTab === 'device'
                      ? 'border-[#8ab4f8] text-[#8ab4f8]'
                      : 'border-transparent text-[#9aa0a6] hover:text-inherit'
                  }`}
                >
                  Код устройства (1 клик)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pat');
                    onCancelDeviceFlow();
                  }}
                  className={`pb-2 px-3 font-medium transition-colors border-b-2 cursor-pointer ${
                    activeTab === 'pat'
                      ? 'border-[#8ab4f8] text-[#8ab4f8]'
                      : 'border-transparent text-[#9aa0a6] hover:text-inherit'
                  }`}
                >
                  Личный токен (PAT)
                </button>
              </div>

              {activeTab === 'device' ? (
                <SyncDeviceFlowTab
                  isDark={isDark}
                  deviceFlow={deviceFlow}
                  customClientId={customClientId}
                  onStartDeviceFlow={onStartDeviceFlow}
                  onCancelDeviceFlow={onCancelDeviceFlow}
                  onSwitchToPat={() => {
                    setActiveTab('pat');
                    onCancelDeviceFlow();
                  }}
                />
              ) : (
                <SyncPatTab
                  isDark={isDark}
                  onConnectWithPAT={onConnectWithPAT}
                />
              )}

              <SyncAdvancedConfig
                isDark={isDark}
                customClientId={customClientId}
                setCustomClientId={setCustomClientId}
              />
            </div>
          )}
        </div>

        {/* Section 2: Backup & Restore */}
        <BackupSection
          isDark={isDark}
          sections={sections}
          onImportSections={onImportSections}
        />
      </div>
    </div>
  );
});

SettingsModal.displayName = 'SettingsModal';
