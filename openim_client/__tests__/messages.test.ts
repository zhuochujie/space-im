jest.mock('@openim/rn-client-sdk', () => ({
  GroupAtType: {},
  MessageType: {
    FriendAdded: 1204,
    GroupCreated: 1501,
    MemberQuit: 1504,
    MemberKicked: 1508,
    MemberInvited: 1509,
    MemberEnter: 1510,
    GroupDismissed: 1511,
    GroupMemberMuted: 1512,
    GroupMemberCancelMuted: 1513,
    GroupMuted: 1514,
    GroupCancelMuted: 1515,
    GroupAnnouncementUpdated: 1519,
    GroupNameUpdated: 1520,
  },
}));

import { messageText } from '../src/utils/messages';

const notification = (contentType: number, detail: object) =>
  ({
    contentType,
    notificationElem: { detail: JSON.stringify(detail) },
  } as Parameters<typeof messageText>[0]);

describe('message notification text', () => {
  it('describes a group member mute with its duration', () => {
    expect(
      messageText(
        notification(1512, {
          opUser: { nickname: '群主' },
          mutedUser: { nickname: '成员' },
          mutedSeconds: 3600,
        }),
      ),
    ).toBe('群主将成员禁言 1 小时');
  });

  it('describes a group member unmute', () => {
    expect(
      messageText(
        notification(1513, {
          opUser: { nickname: '管理员' },
          mutedUser: { nickname: '成员' },
        }),
      ),
    ).toBe('管理员解除了成员的禁言');
  });
});
