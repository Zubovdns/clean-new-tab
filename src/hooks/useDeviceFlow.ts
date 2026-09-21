import { useState, useRef, useEffect, useCallback } from 'react';
import {
  DEFAULT_GITHUB_CLIENT_ID,
  requestDeviceCode,
  pollDeviceToken,
} from '@utils/sync';

export interface DeviceFlowState {
  step: 'idle' | 'requesting' | 'code_ready' | 'success' | 'error';
  userCode: string | null;
  verificationUri: string;
  errorMsg: string | null;
}

export interface UseDeviceFlowParams {
  customClientId?: string;
  onTokenReceived: (token: string, clientId: string) => Promise<void>;
}

export const useDeviceFlow = ({
  customClientId,
  onTokenReceived,
}: UseDeviceFlowParams) => {
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState>({
    step: 'idle',
    userCode: null,
    verificationUri: 'https://github.com/login/device',
    errorMsg: null,
  });

  const pollingTimerRef = useRef<number | null>(null);

  // Cleanup polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  const cancelDeviceFlow = useCallback(() => {
    if (pollingTimerRef.current) {
      window.clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    setDeviceFlow({
      step: 'idle',
      userCode: null,
      verificationUri: 'https://github.com/login/device',
      errorMsg: null,
    });
  }, []);

  const startDeviceFlow = useCallback(
    async (overrideClientId?: string) => {
      cancelDeviceFlow();
      setDeviceFlow({
        step: 'requesting',
        userCode: null,
        verificationUri: 'https://github.com/login/device',
        errorMsg: null,
      });

      const targetClientId = overrideClientId?.trim() || customClientId || DEFAULT_GITHUB_CLIENT_ID;

      try {
        const codeRes = await requestDeviceCode(targetClientId);

        setDeviceFlow({
          step: 'code_ready',
          userCode: codeRes.user_code,
          verificationUri: codeRes.verification_uri || 'https://github.com/login/device',
          errorMsg: null,
        });

        // Start polling loop
        const startTime = Date.now();
        const maxDurationMs = (codeRes.expires_in || 900) * 1000;
        let pollIntervalMs = Math.max(codeRes.interval || 5, 5) * 1000;

        const poll = async () => {
          if (Date.now() - startTime > maxDurationMs) {
            setDeviceFlow((prev) => ({
              ...prev,
              step: 'error',
              errorMsg: 'Время действия кода истекло. Пожалуйста, попробуйте снова.',
            }));
            return;
          }

          try {
            const tokenRes = await pollDeviceToken(targetClientId, codeRes.device_code);

            if (tokenRes.access_token) {
              await onTokenReceived(tokenRes.access_token, targetClientId);
              setDeviceFlow({
                step: 'success',
                userCode: null,
                verificationUri: 'https://github.com/login/device',
                errorMsg: null,
              });
              return;
            }

            if (tokenRes.error === 'slow_down') {
              pollIntervalMs += 5000;
            } else if (tokenRes.error === 'authorization_pending') {
              // Still waiting, keep standard interval
            } else if (tokenRes.error) {
              setDeviceFlow((prev) => ({
                ...prev,
                step: 'error',
                errorMsg: `Авторизация отклонена: ${tokenRes.error}`,
              }));
              return;
            }
          } catch (err) {
            console.warn('[useDeviceFlow] Polling error:', err);
          }

          pollingTimerRef.current = window.setTimeout(poll, pollIntervalMs);
        };

        pollingTimerRef.current = window.setTimeout(poll, pollIntervalMs);
      } catch (err) {
        setDeviceFlow({
          step: 'error',
          userCode: null,
          verificationUri: 'https://github.com/login/device',
          errorMsg: err instanceof Error ? err.message : 'Не удалось связаться с GitHub',
        });
      }
    },
    [cancelDeviceFlow, customClientId, onTokenReceived]
  );

  return {
    deviceFlow,
    startDeviceFlow,
    cancelDeviceFlow,
  };
};


