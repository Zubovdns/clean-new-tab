import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  DEFAULT_SYNC_SETTINGS,
  GistHttpError,
  refreshDeviceToken,
  pullGistData,
  pushGistData,
  findOrCreateGist,
  saveSyncSettings,
  getSyncSettings,
} from '../src/utils/sync';

describe('sync utilities & token refresh', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    store = {};
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, val: string) => {
          store[key] = val;
        },
        clear: () => {
          store = {};
        },
      },
    });
    vi.stubGlobal('chrome', undefined);
  });

  describe('DEFAULT_SYNC_SETTINGS', () => {
    it('initializes with null token, refreshToken, and tokenExpiresAt', () => {
      expect(DEFAULT_SYNC_SETTINGS).toMatchObject({
        enabled: false,
        authType: 'device_flow',
        token: null,
        refreshToken: null,
        tokenExpiresAt: null,
        gistId: null,
      });
    });
  });

  describe('GistHttpError', () => {
    it('retains status and message correctly', () => {
      const error = new GistHttpError('Bad credentials', 401);
      expect(error.name).toBe('GistHttpError');
      expect(error.status).toBe(401);
      expect(error.message).toBe('Bad credentials');
    });
  });

  describe('refreshDeviceToken', () => {
    it('sends refresh_token grant and returns new tokens', async () => {
      const mockResponse = {
        access_token: 'ghu_new_token_123',
        refresh_token: 'ghr_new_token_456',
        expires_in: 28800,
        refresh_token_expires_in: 15811200,
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = fetchMock;

      const result = await refreshDeviceToken('custom_client_id', 'ghr_old_token');

      expect(fetchMock).toHaveBeenCalledWith('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'custom_client_id',
          grant_type: 'refresh_token',
          refresh_token: 'ghr_old_token',
        }),
      });

      expect(result).toEqual(mockResponse);
    });

    it('throws error when refresh fails with HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'bad_request',
      });

      await expect(refreshDeviceToken('client_id', 'invalid_refresh')).rejects.toThrow(
        /Не удалось обновить токен \(400\)/,
      );
    });

    it('throws error when GitHub returns error payload in JSON', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          error: 'bad_refresh_token',
          error_description: 'The refresh token passed is invalid',
        }),
      });

      await expect(refreshDeviceToken('client_id', 'invalid_refresh')).rejects.toThrow(
        /The refresh token passed is invalid/,
      );
    });
  });

  describe('401 handling in gistApi', () => {
    it('pullGistData throws GistHttpError with 401 status on 401 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      try {
        await pullGistData('expired_token', 'gist_123');
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GistHttpError);
        expect((err as GistHttpError).status).toBe(401);
        expect((err as GistHttpError).message).toContain('401');
      }
    });

    it('pushGistData throws GistHttpError with 401 status on 401 response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => '{"message": "Bad credentials"}',
      });

      try {
        await pushGistData('expired_token', 'gist_123', []);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GistHttpError);
        expect((err as GistHttpError).status).toBe(401);
      }
    });

    it('findOrCreateGist throws GistHttpError with 401 status when list fails with 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      try {
        await findOrCreateGist('expired_token', []);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(GistHttpError);
        expect((err as GistHttpError).status).toBe(401);
      }
    });
  });

  describe('saveSyncSettings and getSyncSettings with refresh tokens', () => {
    it('saves and restores refreshToken and tokenExpiresAt in localStorage', async () => {
      const settings = {
        ...DEFAULT_SYNC_SETTINGS,
        enabled: true,
        token: 'ghu_access',
        refreshToken: 'ghr_refresh',
        tokenExpiresAt: 1700000000000,
        gistId: 'gist_abc',
      };

      await saveSyncSettings(settings);
      const loaded = await getSyncSettings();

      expect(loaded.refreshToken).toBe('ghr_refresh');
      expect(loaded.tokenExpiresAt).toBe(1700000000000);
      expect(loaded.token).toBe('ghu_access');
    });
  });
});
