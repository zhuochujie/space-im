import {
  createGroupInviteValue,
  parseGroupInviteValue,
} from '../src/utils/groupInvite';

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
