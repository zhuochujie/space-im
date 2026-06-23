import {
  ConversationItem,
  GroupAtType,
  MessageItem,
  MessageType,
} from '@openim/rn-client-sdk';

type NotificationUser = {
  userID?: string;
  nickname?: string;
};

const userName = (user?: NotificationUser) =>
  user?.nickname || user?.userID || '用户';

export const isSystemNotificationMessage = (message: MessageItem) =>
  message.notificationElem !== undefined;

const notificationText = (message: MessageItem) => {
  if (message.contentType === MessageType.FriendAdded) {
    return '我们已经成为好友';
  }

  try {
    const detail = JSON.parse(message.notificationElem?.detail || '{}');
    switch (message.contentType) {
      case MessageType.GroupCreated:
        return `${userName(detail.opUser)}创建了群聊`;
      case MessageType.MemberEnter:
        return `${userName(detail.entrantUser)}加入了群聊`;
      case MessageType.MemberQuit:
        return `${userName(detail.quitUser)}退出了群聊`;
      case MessageType.MemberInvited: {
        const names = (detail.invitedUserList || [])
          .slice(0, 3)
          .map((user: NotificationUser) => userName(user))
          .join('、');
        return `${userName(detail.opUser)}邀请${names || '新成员'}加入群聊`;
      }
      case MessageType.MemberKicked: {
        const names = (detail.kickedUserList || [])
          .slice(0, 3)
          .map((user: NotificationUser) => userName(user))
          .join('、');
        return `${userName(detail.opUser)}将${names || '成员'}移出群聊`;
      }
      case MessageType.GroupDismissed:
        return `${userName(detail.opUser)}解散了群聊`;
      case MessageType.GroupNameUpdated:
        return `${userName(detail.opUser)}将群名修改为“${
          detail.group?.groupName || ''
        }”`;
      case MessageType.GroupAnnouncementUpdated:
        return '群公告已更新';
      case MessageType.GroupMuted:
        return '群聊已开启全员禁言';
      case MessageType.GroupCancelMuted:
        return '群聊已关闭全员禁言';
      default:
        return '';
    }
  } catch {
    return '';
  }
};

export const messageText = (message?: MessageItem) => {
  if (!message) {
    return '';
  }
  if (message.textElem?.content) {
    return message.textElem.content;
  }
  if (message.atTextElem?.text) {
    return message.atTextElem.text;
  }
  if (message.pictureElem) {
    return '[图片]';
  }
  if (message.soundElem) {
    return '[语音]';
  }
  if (message.videoElem) {
    return '[视频]';
  }
  if (message.fileElem) {
    return `[文件] ${message.fileElem.fileName}`;
  }
  const notification = notificationText(message);
  if (notification) {
    return notification;
  }
  return '[消息]';
};

export const latestMessageText = (conversation: ConversationItem) => {
  if (!conversation.latestMsg) {
    return '暂无消息';
  }
  const atPrefix =
    conversation.groupAtType === GroupAtType.AtMe
      ? '[@我] '
      : conversation.groupAtType === GroupAtType.AtAll
      ? '[@所有人] '
      : conversation.groupAtType === GroupAtType.AtAllAtMe
      ? '[@所有人][@我] '
      : '';
  try {
    return `${atPrefix}${messageText(JSON.parse(conversation.latestMsg))}`;
  } catch {
    return `${atPrefix}${conversation.latestMsg}`;
  }
};
