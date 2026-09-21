import React, { useState, useEffect } from 'react';
import { ChromeSection, SyncSettings } from '../../types';
import Icon from '../common/Icon';
import { DeviceFlowState } from '../../hooks/useSync';
import { exportSectionsToFile, importSectionsFromFile } from '../../utils/githubSync';

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

export function SettingsModal({
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
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'device' | 'pat'>('device');
  const [patInput, setPatInput] = useState('');
  const [isPatSubmitting, setIsPatSubmitting] = useState(false);
  const [patError, setPatError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      onCancelDeviceFlow();
      setPatInput('');
      setPatError(null);
      setCopiedCode(false);
      setImportStatus(null);
    }
  }, [isOpen, onCancelDeviceFlow]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    if (!deviceFlow.userCode) return;
    navigator.clipboard.writeText(deviceFlow.userCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleOpenGitHubDevicePage = () => {
    if (deviceFlow.userCode) {
      navigator.clipboard.writeText(deviceFlow.userCode);
      setCopiedCode(true);
    }
    window.open(deviceFlow.verificationUri, '_blank', 'noopener,noreferrer');
  };

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

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Ещё не выполнялась';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

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

          {syncSettings.enabled && syncSettings.token ? (
            /* Connected State */
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
          ) : (
            /* Not Connected State */
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

              {/* Tab 1: Device Flow */}
              {activeTab === 'device' && (
                <div className="flex flex-col gap-3">
                  {deviceFlow.step === 'idle' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onStartDeviceFlow(customClientId)}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
                            : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                        }`}
                      >
                        <Icon name="github" size={16} />
                        <span>Войти через GitHub</span>
                      </button>
                      <p className="text-[11px] text-[#9aa0a6] text-center">
                        Вы получите 8-значный код для ввода на github.com. Создание Gist произойдет автоматически.
                      </p>
                    </>
                  )}

                  {deviceFlow.step === 'requesting' && (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#9aa0a6]">
                      <Icon name="sync" size={16} className="animate-spin text-[#8ab4f8]" />
                      <span>Запрос кода авторизации у GitHub...</span>
                    </div>
                  )}

                  {deviceFlow.step === 'code_ready' && (
                    <div className="flex flex-col items-center gap-4 py-2">
                      <div className="text-center">
                        <span className="text-xs text-[#9aa0a6] block mb-1">
                          Ваш одноразовый код авторизации:
                        </span>
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-mono text-2xl font-bold tracking-wider text-[#8ab4f8] bg-[#202124] px-4 py-2 rounded-lg border border-[#3c4043]">
                            {deviceFlow.userCode}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyCode}
                            className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                              copiedCode
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                : isDark
                                ? 'bg-[#35363a] border-[#3c4043] hover:bg-[#3c4043]'
                                : 'bg-white border-[#dadce0] hover:bg-[#f1f3f4]'
                            }`}
                            title="Скопировать код"
                          >
                            <Icon name={copiedCode ? 'check' : 'copy'} size={18} />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenGitHubDevicePage}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-medium text-xs transition-colors cursor-pointer ${
                          isDark
                            ? 'bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#202124]'
                            : 'bg-[#1a73e8] hover:bg-[#1557b0] text-white'
                        }`}
                      >
                        <span>1. Скопировать и открыть GitHub</span>
                        <Icon name="open_in_new" size={14} />
                      </button>

                      <div className="flex items-center gap-2 text-xs text-[#9aa0a6]">
                        <Icon name="sync" size={14} className="animate-spin text-[#8ab4f8]" />
                        <span>2. Ожидание подтверждения на GitHub...</span>
                      </div>

                      <button
                        type="button"
                        onClick={onCancelDeviceFlow}
                        className="text-xs text-[#9aa0a6] hover:text-inherit underline cursor-pointer mt-1"
                      >
                        Отмена
                      </button>
                    </div>
                  )}

                  {deviceFlow.step === 'error' && (
                    <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs">
                      <div className="flex items-center gap-1.5 text-red-400 font-medium">
                        <span>Ошибка авторизации</span>
                      </div>
                      <p className="text-[#9aa0a6] text-[11px] leading-relaxed">
                        {deviceFlow.errorMsg}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('pat');
                            onCancelDeviceFlow();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isDark
                              ? 'bg-[#8ab4f8] text-[#202124] hover:bg-[#a8c7fa]'
                              : 'bg-[#1a73e8] text-white hover:bg-[#1557b0]'
                          }`}
                        >
                          Использовать личный токен (PAT)
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartDeviceFlow(customClientId)}
                          className="text-[#9aa0a6] hover:text-inherit underline text-xs cursor-pointer px-2"
                        >
                          Попробовать снова
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Personal Access Token (PAT) */}
              {activeTab === 'pat' && (
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

                  {patError && (
                    <p className="text-xs text-red-400">{patError}</p>
                  )}

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
              )}

              {/* Advanced toggle for custom OAuth Client ID */}
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
            </div>
          )}
        </div>

        {/* Section 2: Backup & Restore */}
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
      </div>
    </div>
  );
}

export default React.memo(SettingsModal);
