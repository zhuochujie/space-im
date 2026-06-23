import { Clipboard } from 'react-native';
import type { MessageItem } from '@openim/rn-client-sdk';

import { messageText } from './messages';
import { showToast } from './toast';

export const copyMessageText = (item: MessageItem) => {
  const content = messageText(item);
  if (!content || item.pictureElem || item.videoElem || item.soundElem) {
    return;
  }
  Clipboard.setString(content);
  showToast('已复制');
};
