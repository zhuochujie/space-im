import { Platform } from 'react-native';

import type { AuthCredentials, AuthSession } from '../types/app';

type ApiResponse<T> = {
  code: number;
  message?: string;
  data: T | null;
};

type PhoneNumberLookupResult = Pick<AuthSession, 'userID' | 'phoneNumber'>;

async function postApi<T>(
  chatServerAddr: string,
  path: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(`${chatServerAddr.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let result: ApiResponse<T> | undefined;
  try {
    result = (await response.json()) as ApiResponse<T>;
  } catch {
    // Fall through to the HTTP status error below.
  }

  if (!response.ok || !result || result.code !== 0) {
    throw new Error(result?.message || `业务服务请求失败 (${response.status})`);
  }
  if (!result.data) {
    throw new Error('业务服务响应缺少 data');
  }
  return result.data;
}

async function getApi<T>(chatServerAddr: string, path: string): Promise<T> {
  const response = await fetch(`${chatServerAddr.replace(/\/$/, '')}${path}`, {
    method: 'GET',
  });

  let result: ApiResponse<T> | undefined;
  try {
    result = (await response.json()) as ApiResponse<T>;
  } catch {
    // Fall through to the HTTP status error below.
  }

  if (!response.ok || !result || result.code !== 0) {
    throw new Error(result?.message || `业务服务请求失败 (${response.status})`);
  }
  if (!result.data) {
    throw new Error('业务服务响应缺少 data');
  }
  return result.data;
}

const platformID = () => (Platform.OS === 'ios' ? 1 : 2);

export async function registerAccount(
  chatServerAddr: string,
  credentials: AuthCredentials,
) {
  return postApi<Pick<AuthSession, 'userID' | 'phoneNumber'>>(
    chatServerAddr,
    '/auth/register',
    {
      phoneNumber: credentials.phoneNumber,
      password: credentials.password,
      nickname: credentials.nickname,
    },
  );
}

export async function loginAccount(
  chatServerAddr: string,
  credentials: AuthCredentials,
): Promise<AuthSession> {
  const result = await postApi<AuthSession>(chatServerAddr, '/auth/login', {
    phoneNumber: credentials.phoneNumber,
    password: credentials.password,
    platformID: platformID(),
  });
  if (!result?.userID || !result.token) {
    throw new Error('登录响应缺少 userID 或 token');
  }
  return result;
}

export async function getUserByPhoneNumber(
  chatServerAddr: string,
  phoneNumber: string,
): Promise<PhoneNumberLookupResult> {
  return getApi<PhoneNumberLookupResult>(
    chatServerAddr,
    `/auth/users/by-phone-number?phoneNumber=${encodeURIComponent(
      phoneNumber,
    )}`,
  );
}

export async function changeLoginPassword(
  chatServerAddr: string,
  phoneNumber: string,
  oldPassword: string,
  newPassword: string,
): Promise<PhoneNumberLookupResult> {
  return postApi<PhoneNumberLookupResult>(
    chatServerAddr,
    '/auth/change-password',
    {
      phoneNumber,
      oldPassword,
      newPassword,
    },
  );
}
