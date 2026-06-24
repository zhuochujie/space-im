import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession } from '../types/app';

const SESSION_KEY = '@openim/client-session';

type LegacySession = {
  userID?: string;
  phoneNumber?: string;
  token?: string;
  imToken?: string;
  expireTimeSeconds?: number;
};

export async function saveSession(session: AuthSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | undefined> {
  const value = await AsyncStorage.getItem(SESSION_KEY);
  if (!value) {
    return undefined;
  }

  try {
    const raw = JSON.parse(value) as LegacySession;
    const token = raw.token || raw.imToken;
    if (!raw.userID || !token) {
      await clearSession();
      return undefined;
    }
    return {
      userID: raw.userID,
      phoneNumber: raw.phoneNumber || raw.userID,
      token,
      expireTimeSeconds: raw.expireTimeSeconds ?? 0,
    };
  } catch {
    await clearSession();
    return undefined;
  }
}

export function clearSession() {
  return AsyncStorage.removeItem(SESSION_KEY);
}
