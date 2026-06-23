import React from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {ConversationItem} from '@openim/rn-client-sdk';

import {Avatar} from '../components/Avatar';
import {EmptyState} from '../components/EmptyState';
import {colors} from '../theme/colors';
import {latestMessageText} from '../utils/messages';
import {formatTime} from '../utils/time';
import {showConfirm} from '../utils/toast';

type Props = {
  conversations: ConversationItem[];
  loading: boolean;
  onOpen: (conversation: ConversationItem) => void;
  onDelete: (conversation: ConversationItem) => Promise<void>;
  onRefresh: () => void;
};

export function ConversationsScreen({
  conversations,
  loading,
  onOpen,
  onDelete,
  onRefresh,
}: Props) {
  const confirmDelete = async (conversation: ConversationItem) => {
    const title = conversation.showName || conversation.userID || conversation.groupID;
    const confirmed = await showConfirm({
      title: '删除会话',
      message: `确定删除“${title}”的会话和消息吗？`,
      confirmText: '删除',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await onDelete(conversation);
    } catch {
      // The parent shows the concrete error.
    }
  };

  return (
    <FlatList
      alwaysBounceVertical
      contentContainerStyle={styles.list}
      data={conversations}
      keyExtractor={item => item.conversationID}
      ListEmptyComponent={
        <EmptyState
          subtitle="从联系人开始聊天，或下拉刷新"
          title="还没有会话"
        />
      }
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={onRefresh} />
      }
      overScrollMode="always"
      renderItem={({item}) => (
        <Pressable
          onLongPress={() => confirmDelete(item)}
          onPress={() => onOpen(item)}
          style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
          <Avatar name={item.showName} uri={item.faceURL} />
          <View style={styles.body}>
            <View style={styles.rowTop}>
              <Text numberOfLines={1} style={styles.title}>
                {item.showName || '会话'}
              </Text>
              <Text style={styles.time}>
                {formatTime(item.latestMsgSendTime)}
              </Text>
            </View>
            <View style={styles.rowTop}>
              <Text numberOfLines={1} style={styles.subtitle}>
                {latestMessageText(item)}
              </Text>
              {item.unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {backgroundColor: '#F1F4F9'},
  body: {flex: 1, marginLeft: 12},
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  subtitle: {
    flex: 1,
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
    marginRight: 8,
  },
  time: {color: '#9BA5B5', fontSize: 11},
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#F05252',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {color: '#FFFFFF', fontSize: 10, fontWeight: '700'},
});
