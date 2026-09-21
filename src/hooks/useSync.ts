import { useState, useEffect, useRef, useCallback } from 'react';

import { ChromeSection, SyncSettings } from '@app-types';
import { useDeviceFlow, DeviceFlowState } from '@hooks/useDeviceFlow';
import {
  DEFAULT_SYNC_SETTINGS,
  DEFAULT_GITHUB_CLIENT_ID,
  getSyncSettings,
  saveSyncSettings,
  fetchUserProfile,
  findOrCreateGist,
  pullGistData,
  pushGistData,
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

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  const localLastUpdatedAtRef = useRef<number>(0);

  // Load saved sync settings on mount
  useEffect(() => {
    getSyncSettings().then(setSyncSettings);
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
   * Handle token received from Device Flow
   */
  const handleTokenFromDeviceFlow = useCallback(
    async (token: string, clientId: string) => {
      setIsSyncing(true);
      try {
        const profile = await fetchUserProfile(token);
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

        if (!gistInfo.isNew && gistInfo.sections && gistInfo.sections.length > 0) {
          onRemoteSectionsLoaded(gistInfo.sections);
        }
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
          gistId: gistInfo.gistId,
          userLogin: profile.login,
          userAvatarUrl: profile.avatar_url,
          lastSyncedAt: gistInfo.updatedAt,
        };

        await saveSyncSettings(newSettings);
        setSyncSettings(newSettings);

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
        if (remoteData.sections && remoteData.sections.length > 0) {
          onRemoteSectionsLoaded(remoteData.sections);
          localLastUpdatedAtRef.current = remoteUpdatedAt;
        }
      } else if (localUpdatedAt > remoteUpdatedAt) {
        const pushRes = await pushGistData(
          syncSettings.token,
          syncSettings.gistId,
          sectionsRef.current,
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
            updatedSections,
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
    [syncSettings],
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
      const now = Date.now();
      const lastSync = syncSettings.lastSyncedAt || 0;
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
};
