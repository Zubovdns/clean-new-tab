import { useState, useEffect, useRef, useCallback } from 'react';

import { ChromeSection, SyncSettings } from '@app-types';
import { useDeviceFlow, DeviceFlowState, DeviceFlowTokenData } from '@hooks/useDeviceFlow';
import {
  DEFAULT_SYNC_SETTINGS,
  DEFAULT_GITHUB_CLIENT_ID,
  getSyncSettings,
  saveSyncSettings,
  fetchUserProfile,
  findOrCreateGist,
  pullGistData,
  pushGistData,
  refreshDeviceToken,
  GistHttpError,
} from '@utils/sync';

export type { DeviceFlowState };

export const useSync = (
  sections: ChromeSection[],
  onRemoteSectionsLoaded: (remoteSections: ChromeSection[]) => void,
) => {
  const [syncSettings, setSyncSettings] = useState<SyncSettings>(DEFAULT_SYNC_SETTINGS);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const debounceTimerRef = useRef<number | null>(null);
  const sectionsRef = useRef<ChromeSection[]>(sections);
  const syncSettingsRef = useRef<SyncSettings>(syncSettings);
  const syncErrorRef = useRef<string | null>(null);
  const refreshingPromiseRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    syncSettingsRef.current = syncSettings;
  }, [syncSettings]);

  useEffect(() => {
    syncErrorRef.current = syncError;
  }, [syncError]);

  const localLastUpdatedAtRef = useRef<number>(0);

  // Load saved sync settings on mount
  useEffect(() => {
    getSyncSettings().then((settings) => {
      setSyncSettings(settings);
      syncSettingsRef.current = settings;
    });
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Refreshes OAuth access token if a refreshToken is available.
   * Ensures only one concurrent refresh request runs at a time.
   */
  const refreshTokenInternal = useCallback(async (): Promise<string> => {
    if (refreshingPromiseRef.current) {
      return refreshingPromiseRef.current;
    }

    const currentSettings = syncSettingsRef.current;
    if (currentSettings.authType !== 'device_flow' || !currentSettings.refreshToken) {
      throw new Error(
        'Токен устарел и не может быть обновлён автоматически. Пожалуйста, войдите снова.',
      );
    }

    const refreshPromise = (async () => {
      try {
        const targetClientId = currentSettings.customClientId || DEFAULT_GITHUB_CLIENT_ID;
        const res = await refreshDeviceToken(targetClientId, currentSettings.refreshToken!);

        const newTokenExpiresAt = res.expires_in ? Date.now() + res.expires_in * 1000 : undefined;

        const updatedSettings: SyncSettings = {
          ...currentSettings,
          token: res.access_token,
          refreshToken: res.refresh_token || currentSettings.refreshToken,
          tokenExpiresAt: newTokenExpiresAt,
        };

        await saveSyncSettings(updatedSettings);
        setSyncSettings(updatedSettings);
        syncSettingsRef.current = updatedSettings;
        setSyncError(null);

        return res.access_token;
      } catch (err) {
        console.warn('[useSync] Failed to refresh token:', err);
        const message = 'Сессия GitHub истекла. Требуется повторный вход в настройках.';
        setSyncError(message);
        throw new Error(message);
      } finally {
        refreshingPromiseRef.current = null;
      }
    })();

    refreshingPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  /**
   * Execute an operation with valid token, refreshing automatically if expiring or upon 401
   */
  const executeWithToken = useCallback(
    async <T>(operation: (token: string) => Promise<T>): Promise<T> => {
      const currentSettings = syncSettingsRef.current;
      let token = currentSettings.token;
      if (!token) throw new Error('Токен синхронизации отсутствует');

      // Proactively refresh if token expires in less than 60 seconds
      const isExpiringSoon =
        currentSettings.authType === 'device_flow' &&
        currentSettings.refreshToken &&
        currentSettings.tokenExpiresAt &&
        Date.now() >= currentSettings.tokenExpiresAt - 60_000;

      if (isExpiringSoon) {
        try {
          token = await refreshTokenInternal();
        } catch {
          token = syncSettingsRef.current.token || token;
        }
      }

      try {
        return await operation(token);
      } catch (err: unknown) {
        const is401 =
          (err instanceof GistHttpError && err.status === 401) ||
          (err instanceof Error && err.message.includes('401'));

        if (
          is401 &&
          syncSettingsRef.current.authType === 'device_flow' &&
          syncSettingsRef.current.refreshToken
        ) {
          console.log('[useSync] 401 received, attempting automatic token refresh...');
          const refreshedToken = await refreshTokenInternal();
          return await operation(refreshedToken);
        }

        if (is401) {
          throw new Error(
            'Токен GitHub недействителен (401). Пожалуйста, переподключитесь в настройках.',
          );
        }

        throw err;
      }
    },
    [refreshTokenInternal],
  );

  /**
   * Handle token received from Device Flow
   */
  const handleTokenFromDeviceFlow = useCallback(
    async (tokenData: DeviceFlowTokenData, clientId: string) => {
      setIsSyncing(true);
      setSyncError(null);
      try {
        const profile = await fetchUserProfile(tokenData.accessToken);
        const gistInfo = await findOrCreateGist(tokenData.accessToken, sectionsRef.current);

        const tokenExpiresAt = tokenData.expiresIn
          ? Date.now() + tokenData.expiresIn * 1000
          : undefined;

        const newSettings: SyncSettings = {
          enabled: true,
          authType: 'device_flow',
          token: tokenData.accessToken,
          refreshToken: tokenData.refreshToken || null,
          tokenExpiresAt: tokenExpiresAt || null,
          gistId: gistInfo.gistId,
          userLogin: profile.login,
          userAvatarUrl: profile.avatar_url,
          lastSyncedAt: gistInfo.updatedAt,
          customClientId: clientId !== DEFAULT_GITHUB_CLIENT_ID ? clientId : undefined,
        };

        await saveSyncSettings(newSettings);
        setSyncSettings(newSettings);
        syncSettingsRef.current = newSettings;

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
    [onRemoteSectionsLoaded],
  );

  const { deviceFlow, startDeviceFlow, cancelDeviceFlow } = useDeviceFlow({
    customClientId: syncSettings.customClientId,
    onTokenReceived: handleTokenFromDeviceFlow,
  });

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
        const profile = await fetchUserProfile(token);
        const gistInfo = await findOrCreateGist(token, sectionsRef.current);

        const newSettings: SyncSettings = {
          enabled: true,
          authType: 'pat',
          token,
          refreshToken: null,
          tokenExpiresAt: null,
          gistId: gistInfo.gistId,
          userLogin: profile.login,
          userAvatarUrl: profile.avatar_url,
          lastSyncedAt: gistInfo.updatedAt,
        };

        await saveSyncSettings(newSettings);
        setSyncSettings(newSettings);
        syncSettingsRef.current = newSettings;

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
    [onRemoteSectionsLoaded],
  );

  /**
   * Disconnect and clear sync settings
   */
  const disconnect = useCallback(async () => {
    cancelDeviceFlow();
    const newSettings: SyncSettings = {
      ...DEFAULT_SYNC_SETTINGS,
      customClientId: syncSettingsRef.current.customClientId,
    };
    await saveSyncSettings(newSettings);
    setSyncSettings(newSettings);
    syncSettingsRef.current = newSettings;
    setSyncError(null);
  }, [cancelDeviceFlow]);

  /**
   * Manual or automatic pull/push sync
   */
  const syncNow = useCallback(async () => {
    const currentSettings = syncSettingsRef.current;
    if (!currentSettings.enabled || !currentSettings.token || !currentSettings.gistId) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const remoteData = await executeWithToken((token) =>
        pullGistData(token, currentSettings.gistId!),
      );
      const remoteUpdatedAt = remoteData.updatedAt || 0;
      const localUpdatedAt = localLastUpdatedAtRef.current;

      if (remoteUpdatedAt > localUpdatedAt) {
        if (remoteData.sections && remoteData.sections.length > 0) {
          onRemoteSectionsLoaded(remoteData.sections);
          localLastUpdatedAtRef.current = remoteUpdatedAt;
        }
      } else if (localUpdatedAt > remoteUpdatedAt) {
        const pushRes = await executeWithToken((token) =>
          pushGistData(token, currentSettings.gistId!, sectionsRef.current),
        );
        localLastUpdatedAtRef.current = pushRes.updatedAt;
      }

      const updatedSettings: SyncSettings = {
        ...syncSettingsRef.current,
        lastSyncedAt: Date.now(),
      };
      await saveSyncSettings(updatedSettings);
      setSyncSettings(updatedSettings);
      syncSettingsRef.current = updatedSettings;
    } catch (err) {
      console.warn('[useSync] syncNow error:', err);
      setSyncError(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setIsSyncing(false);
    }
  }, [executeWithToken, onRemoteSectionsLoaded]);

  /**
   * Debounced push when sections change locally
   */
  const notifySectionsChanged = useCallback(
    (updatedSections: ChromeSection[]) => {
      localLastUpdatedAtRef.current = Date.now();

      const currentSettings = syncSettingsRef.current;
      if (!currentSettings.enabled || !currentSettings.token || !currentSettings.gistId) {
        return;
      }

      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout(async () => {
        const settings = syncSettingsRef.current;
        if (!settings.enabled || !settings.token || !settings.gistId) {
          return;
        }

        try {
          setIsSyncing(true);
          const pushRes = await executeWithToken((token) =>
            pushGistData(token, settings.gistId!, updatedSections),
          );
          const newSettings: SyncSettings = {
            ...syncSettingsRef.current,
            lastSyncedAt: pushRes.updatedAt,
          };
          await saveSyncSettings(newSettings);
          setSyncSettings(newSettings);
          syncSettingsRef.current = newSettings;
          setSyncError(null);
        } catch (err) {
          console.warn('[useSync] Debounced push error:', err);
          setSyncError(err instanceof Error ? err.message : 'Не удалось обновить Gist');
        } finally {
          setIsSyncing(false);
        }
      }, 1800);
    },
    [executeWithToken],
  );

  // Initial pull when sync is active on mount
  const hasPulledOnMountRef = useRef(false);
  useEffect(() => {
    if (
      syncSettings.enabled &&
      syncSettings.token &&
      syncSettings.gistId &&
      !hasPulledOnMountRef.current
    ) {
      hasPulledOnMountRef.current = true;
      syncNow();
    }
  }, [syncSettings.enabled, syncSettings.token, syncSettings.gistId, syncNow]);

  // Window focus listener: pull latest changes if window becomes active
  useEffect(() => {
    if (!syncSettings.enabled) return;

    const handleFocus = () => {
      // Don't repeatedly poll if sync is in error state (e.g. unrecoverable 401)
      if (syncErrorRef.current) return;

      const now = Date.now();
      const lastSync = syncSettingsRef.current.lastSyncedAt || 0;
      if (now - lastSync > 45_000) {
        syncNow();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [syncSettings.enabled, syncNow]);

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
};
