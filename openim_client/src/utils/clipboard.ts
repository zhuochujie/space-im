import { Clipboard } from 'react-native';
import type { MessageItem } from '@openim/rn-client-sdk';

import { messageText } from './messages';
import { showToast } from './toast';

export const copyText = (content: string, successMessage = '已复制') => {
  if (!content) {
    return;
  }
  Clipboard.setString(content);
  showToast(successMessage);
};

export const copyMessageText = (item: MessageItem) => {
  const content = messageText(item);
  if (!content || item.pictureElem || item.videoElem || item.soundElem) {
    return;
  }
  copyText(content);
};
