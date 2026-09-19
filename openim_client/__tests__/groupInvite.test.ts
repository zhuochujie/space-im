import {
  createGroupInviteValue,
  parseGroupInviteValue,
} from '../src/utils/groupInvite';
import {
  createUserInviteValue,
  parseUserInviteValue,
} from '../src/utils/userInvite';

describe('group invite QR values', () => {
  it('round-trips a group ID', () => {
    const value = createGroupInviteValue('group_123-abc');

    expect(value).toBe('space-im://group/group_123-abc');
    expect(parseGroupInviteValue(value)).toBe('group_123-abc');
  });

  it('rejects unrelated and malformed QR values', () => {
    expect(parseGroupInviteValue('https://example.com')).toBeUndefined();
    expect(parseGroupInviteValue('space-im://group/a/b')).toBeUndefined();
    expect(parseGroupInviteValue('space-im://group/%E0%A4%A')).toBeUndefined();
  });
});

describe('user invite QR values', () => {
  it('round-trips a phone number', () => {
    const value = createUserInviteValue('13800138000');

    expect(value).toBe('space-im://user/13800138000');
    expect(parseUserInviteValue(value)).toBe('13800138000');
  });

  it('rejects unrelated and malformed user values', () => {
    expect(parseUserInviteValue('space-im://group/13800138000')).toBeUndefined();
    expect(parseUserInviteValue('space-im://user/not-a-phone')).toBeUndefined();
    expect(parseUserInviteValue('space-im://user/%E0%A4%A')).toBeUndefined();
  });
});
