const USER_INVITE_PREFIX = 'space-im://user/';
const PHONE_NUMBER_PATTERN = /^1[3-9]\d{9}$/;

export function createUserInviteValue(phoneNumber: string): string {
  return `${USER_INVITE_PREFIX}${encodeURIComponent(phoneNumber)}`;
}

export function parseUserInviteValue(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized.startsWith(USER_INVITE_PREFIX)) {
    return undefined;
  }

  try {
    const phoneNumber = decodeURIComponent(
      normalized.slice(USER_INVITE_PREFIX.length),
    );
    return PHONE_NUMBER_PATTERN.test(phoneNumber) ? phoneNumber : undefined;
  } catch {
    return undefined;
  }
}
