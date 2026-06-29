const GROUP_INVITE_PREFIX = 'space-im://group/';
const GROUP_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function createGroupInviteValue(groupID: string): string {
  return `${GROUP_INVITE_PREFIX}${encodeURIComponent(groupID)}`;
}

export function parseGroupInviteValue(value: string): string | undefined {
  const normalized = value.trim();
  if (!normalized.startsWith(GROUP_INVITE_PREFIX)) {
    return undefined;
  }

  try {
    const groupID = decodeURIComponent(
      normalized.slice(GROUP_INVITE_PREFIX.length),
    );
    return GROUP_ID_PATTERN.test(groupID) ? groupID : undefined;
  } catch {
    return undefined;
  }
}
