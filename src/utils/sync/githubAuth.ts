import { DeviceCodeResponse } from '@app-types';

// Pre-configured public OAuth Client ID for Clean New Tab (or user can specify their own)
export const DEFAULT_GITHUB_CLIENT_ID = 'Ov23liTCaImxCmJuli70';

export interface PollTokenResult {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: 'authorization_pending' | 'slow_down' | 'expired_token' | 'access_denied' | string;
  error_description?: string;
  interval?: number;
}

export interface RefreshTokenResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in?: number;
}

/**
 * 1. Request device and user verification code (GitHub OAuth Device Flow)
 */
export const requestDeviceCode = async (clientId: string): Promise<DeviceCodeResponse> => {
  const targetClientId = clientId.trim() || DEFAULT_GITHUB_CLIENT_ID;
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: targetClientId,
      scope: 'gist',
    }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        'Client ID не зарегистрирован на GitHub или не включен Device Flow. Зарегистрируйте OAuth App или используйте вкладку "Личный токен (PAT)".',
      );
    }
    const errorText = await res.text();
    throw new Error(`Не удалось запросить код устройства (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Ошибка GitHub: ${data.error_description || data.error}`);
  }

  return data as DeviceCodeResponse;
};

/**
 * 2. Poll GitHub token endpoint while user enters code
 */
export const pollDeviceToken = async (
  clientId: string,
  deviceCode: string,
): Promise<PollTokenResult> => {
  const targetClientId = clientId.trim() || DEFAULT_GITHUB_CLIENT_ID;
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: targetClientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ошибка при проверке токена: ${errorText}`);
  }

  const data = await res.json();
  return data as PollTokenResult;
};

/**
 * 3. Refresh OAuth access token using refresh_token (GitHub OAuth Device Flow)
 */
export const refreshDeviceToken = async (
  clientId: string,
  refreshToken: string,
): Promise<RefreshTokenResult> => {
  const targetClientId = clientId.trim() || DEFAULT_GITHUB_CLIENT_ID;
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: targetClientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Не удалось обновить токен (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Ошибка обновления токена: ${data.error_description || data.error}`);
  }

  if (!data.access_token) {
    throw new Error('Ответ не содержит access_token');
  }

  return data as RefreshTokenResult;
};

/**
 * Fetch authenticated GitHub user profile
 */
export const fetchUserProfile = async (
  token: string,
): Promise<{ login: string; avatar_url: string; name?: string }> => {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Токен GitHub недействителен (401 Bad credentials)');
    }
    throw new Error(`Неверный токен или ошибка профиля (${res.status})`);
  }

  return res.json();
};
