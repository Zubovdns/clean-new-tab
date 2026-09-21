import React, { useState } from 'react';

import { Icon } from '@components/common/Icon';
import { DeviceFlowState } from '@hooks/useSync';

export interface SyncDeviceFlowTabProps {
  isDark: boolean;
  deviceFlow: DeviceFlowState;
  customClientId: string;
  onStartDeviceFlow: (customClientId?: string) => void;
  onCancelDeviceFlow: () => void;
  onSwitchToPat: () => void;
}

export const SyncDeviceFlowTab = React.memo(
  ({
    isDark,
    deviceFlow,
    customClientId,
    onStartDeviceFlow,
    onCancelDeviceFlow,
    onSwitchToPat,
  }: SyncDeviceFlowTabProps) => {
    const [copiedCode, setCopiedCode] = useState(false);

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

    return (
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
              Вы получите 8-значный код для ввода на github.com. Создание Gist произойдет
              автоматически.
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
            <p className="text-[#9aa0a6] text-[11px] leading-relaxed">{deviceFlow.errorMsg}</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onSwitchToPat}
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
    );
  },
);

SyncDeviceFlowTab.displayName = 'SyncDeviceFlowTab';
