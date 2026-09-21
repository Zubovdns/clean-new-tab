import { useState, useEffect, useRef, useCallback } from 'react';
import { ChromeSection, SyncSettings } from '../types';
import {
  DEFAULT_SYNC_SETTINGS,
  DEFAULT_GITHUB_CLIENT_ID,
  getSyncSettings,
  saveSyncSettings,
  requestDeviceCode,
  pollDeviceToken,
  fetchUserProfile,
  findOrCreateGist,
  pullGistData,
  pushGistData,
} from '../utils/githubSync';

export interface DeviceFlowState {
  step: 'idle' | 'requesting' | 'code_ready' | 'success' | 'error';
  userCode: string | null;
  verificationUri: string;
  errorMsg: string | null;
}

export function useSync(
  sections: ChromeSection[],
  onRemoteSectionsLoaded: (remoteSections: ChromeSection[]) => void
) {
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(DEFAULT_SYNC_SETTINGS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState>({
    step: 'idle',
    userCode: null,
    verificationUri: 'https://github.com/login/device',
    errorMsg: null,
  });

  const pollingTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const sectionsRef = useRef<ChromeSection[]>(sections);
  sectionsRef.current = sections;

  const localLastUpdatedAtRef = useRef<number>(Date.now());

  // Load saved sync settings on mount
  useEffect(() => {
    getSyncSettings().then((settings) => {
      setSyncSettings(settings);
    });
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) {
        window.clearTimeout(pollingTimerRef.current);
      }
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Stop any active device flow polling
   */
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

  /**
   * Start GitHub OAuth Device Flow
   */
  const startDeviceFlow = useCallback(
    async (customClientId?: string) => {
      cancelDeviceFlow();
      setDeviceFlow({
        step: 'requesting',
        userCode: null,
        verificationUri: 'https://github.com/login/device',
        errorMsg: null,
      });

      const clientId = customClientId?.trim() || syncSettings.customClientId || DEFAULT_GITHUB_CLIENT_ID;

      try {
        const codeRes = await requestDeviceCode(clientId);

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
            const tokenRes = await pollDeviceToken(clientId, codeRes.device_code);

            if (tokenRes.access_token) {
              // Successfully authorized!
              const token = tokenRes.access_token;
              setIsSyncing(true);

              // 1. Fetch user info
              const profile = await fetchUserProfile(token);

              // 2. Find or create Gist
              const gistInfo = await findOrCreateGist(token, sectionsRef.current);

              const newSettings: SyncSettings = {
                enabled: true,
                authType: 'device_flow',
                token,
                gistId: gistInfo.gistId,
                userLogin: profile.login,
                userAvatarUrl: profile.avatar_url,
                lastSyncedAt: gistInfo.updatedAt,
                customClientId: clientId !== DEFAULT_GITHUB_CLIENT_ID ? clientId : undefined,
              };

              await saveSyncSettings(newSettings);
              setSyncSettings(newSettings);

              // If Gist already had data, apply it to the UI
              if (!gistInfo.isNew && gistInfo.sections && gistInfo.sections.length > 0) {
                onRemoteSectionsLoaded(gistInfo.sections);
              }

              setDeviceFlow({
                step: 'success',
                userCode: null,
                verificationUri: 'https://github.com/login/device',
                errorMsg: null,
              });
              setIsSyncing(false);
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
            console.warn('[useSync] Polling error:', err);
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
    [cancelDeviceFlow, syncSettings.customClientId, onRemoteSectionsLoaded]
  );

  /**
   * Connect using Personal Access Token (PAT)
   */
  const connectWithPAT = useCallback(
    async (tokenInput: string) => {
      const token = tokenInput.trim();
      if (!token) return;

      setIsSyncing(true);
      setSyncError(null);

      try {
        // 1. Fetch user profile to validate token
        const profile = await fetchUserProfile(token);

        // 2. Find or create Gist
        const gistInfo = await findOrCreateGist(token, sectionsRef.current);

        const newSettings: SyncSettings = {
          enabled: true,
          authType: 'pat',
          token,
          gistId: gistInfo.gistId,
          userLogin: profile.login,
          userAvatarUrl: profile.avatar_url,
          lastSyncedAt: gistInfo.updatedAt,
        };

        await saveSyncSettings(newSettings);
        setSyncSettings(newSettings);

        // If existing Gist found, update local data
        if (!gistInfo.isNew && gistInfo.sections && gistInfo.sections.length > 0) {
          onRemoteSectionsLoaded(gistInfo.sections);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Ошибка подключения';
        setSyncError(message);
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [onRemoteSectionsLoaded]
  );

  /**
   * Disconnect and clear sync settings
   */
  const disconnect = useCallback(async () => {
    cancelDeviceFlow();
    const newSettings: SyncSettings = {
      ...DEFAULT_SYNC_SETTINGS,
      customClientId: syncSettings.customClientId,
    };
    await saveSyncSettings(newSettings);
    setSyncSettings(newSettings);
    setSyncError(null);
  }, [cancelDeviceFlow, syncSettings.customClientId]);

  /**
   * Manual or automatic pull/push sync
   */
  const syncNow = useCallback(async () => {
    if (!syncSettings.enabled || !syncSettings.token || !syncSettings.gistId) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const remoteData = await pullGistData(syncSettings.token, syncSettings.gistId);
      const remoteUpdatedAt = remoteData.updatedAt || 0;
      const localUpdatedAt = localLastUpdatedAtRef.current;

      if (remoteUpdatedAt > localUpdatedAt) {
        // Remote is newer: update local state
        if (remoteData.sections && remoteData.sections.length > 0) {
          onRemoteSectionsLoaded(remoteData.sections);
          localLastUpdatedAtRef.current = remoteUpdatedAt;
        }
      } else if (localUpdatedAt > remoteUpdatedAt) {
        // Local is newer: push to Gist
        const pushRes = await pushGistData(
          syncSettings.token,
          syncSettings.gistId,
          sectionsRef.current
        );
        localLastUpdatedAtRef.current = pushRes.updatedAt;
      }

      const updatedSettings: SyncSettings = {
        ...syncSettings,
        lastSyncedAt: Date.now(),
      };
      await saveSyncSettings(updatedSettings);
      setSyncSettings(updatedSettings);
    } catch (err) {
      console.warn('[useSync] syncNow error:', err);
      setSyncError(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setIsSyncing(false);
    }
  }, [syncSettings, onRemoteSectionsLoaded]);

  /**
   * Debounced push when sections change locally
   */
  const notifySectionsChanged = useCallback(
    (updatedSections: ChromeSection[]) => {
      localLastUpdatedAtRef.current = Date.now();

      if (!syncSettings.enabled || !syncSettings.token || !syncSettings.gistId) {
        return;
      }

      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(async () => {
        try {
          setIsSyncing(true);
          const pushRes = await pushGistData(
            syncSettings.token!,
            syncSettings.gistId!,
            updatedSections
          );
          const newSettings: SyncSettings = {
            ...syncSettings,
            lastSyncedAt: pushRes.updatedAt,
          };
          await saveSyncSettings(newSettings);
          setSyncSettings(newSettings);
        } catch (err) {
          console.warn('[useSync] Debounced push error:', err);
          setSyncError(err instanceof Error ? err.message : 'Не удалось обновить Gist');
        } finally {
          setIsSyncing(false);
        }
      }, 1800);
    },
    [syncSettings]
  );

  // Initial pull when sync is active on mount
  const hasPulledOnMountRef = useRef(false);
  useEffect(() => {
    if (syncSettings.enabled && syncSettings.token && syncSettings.gistId && !hasPulledOnMountRef.current) {
      hasPulledOnMountRef.current = true;
      syncNow();
    }
  }, [syncSettings.enabled, syncSettings.token, syncSettings.gistId, syncNow]);

  // Window focus listener: pull latest changes if window becomes active
  useEffect(() => {
    if (!syncSettings.enabled) return;

    const handleFocus = () => {
      const now = Date.now();
      const lastSync = syncSettings.lastSyncedAt || 0;
      // Pull only if more than 45 seconds since last sync
      if (now - lastSync > 45_000) {
        syncNow();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [syncSettings.enabled, syncSettings.lastSyncedAt, syncNow]);

  return {
    syncSettings,
    isSyncing,
    syncError,
    deviceFlow,
    startDeviceFlow,
    cancelDeviceFlow,
    connectWithPAT,
    disconnect,
    syncNow,
    notifySectionsChanged,
  };
}

export default useSync;
