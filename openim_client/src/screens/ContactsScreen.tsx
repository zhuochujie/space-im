import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  FriendApplicationItem,
  FriendUserItem,
  GroupApplicationItem,
  GroupItem,
} from '@openim/rn-client-sdk';
import { DataScanner } from 'react-native-data-scanner';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Avatar } from '../components/Avatar';
import { EmptyState } from '../components/EmptyState';
import { KeyboardCenteredModal } from '../components/KeyboardCenteredModal';
import { colors } from '../theme/colors';
import { parseGroupInviteValue } from '../utils/groupInvite';
import { showConfirm, showToast } from '../utils/toast';

type Props = {
  friends: FriendUserItem[];
  friendApplications: FriendApplicationItem[];
  groupApplications: GroupApplicationItem[];
  groups: GroupItem[];
  loading: boolean;
  selfUserID: string;
  onOpenFriend: (friend: FriendUserItem) => void;
  onOpenGroup: (group: GroupItem) => void;
  onRefresh: () => void;
  onAddFriend: (phoneNumber: string, message: string) => Promise<boolean>;
  onJoinGroup: (groupID: string, message: string) => Promise<boolean>;
  onCreateGroup: (name: string, memberUserIDs: string[]) => Promise<boolean>;
  onDeleteFriend: (friend: FriendUserItem) => Promise<boolean>;
  onLeaveGroup: (group: GroupItem) => Promise<boolean>;
  onAcceptFriendApplication: (
    application: FriendApplicationItem,
    message: string,
  ) => Promise<boolean>;
  onRejectFriendApplication: (
    application: FriendApplicationItem,
    message: string,
  ) => Promise<boolean>;
  onAcceptGroupApplication: (
    application: GroupApplicationItem,
    message: string,
  ) => Promise<boolean>;
  onRejectGroupApplication: (
    application: GroupApplicationItem,
    message: string,
  ) => Promise<boolean>;
};

type Action = 'friend' | 'join' | 'create';

const defaultFriendMessage = '你好，我想添加你为好友';
const defaultGroupMessage = '你好，我想加入群聊';

export function ContactsScreen({
  friends,
  friendApplications,
  groupApplications,
  groups,
  loading,
  selfUserID,
  onOpenFriend,
  onOpenGroup,
  onRefresh,
  onAddFriend,
  onJoinGroup,
  onCreateGroup,
  onDeleteFriend,
  onLeaveGroup,
  onAcceptFriendApplication,
  onRejectFriendApplication,
  onAcceptGroupApplication,
  onRejectGroupApplication,
}: Props) {
  const [action, setAction] = useState<Action>('friend');
  const [actionVisible, setActionVisible] = useState(false);
  const [targetID, setTargetID] = useState('');
  const [message, setMessage] = useState(defaultFriendMessage);
  const [groupName, setGroupName] = useState('');
  const [selectedUserIDs, setSelectedUserIDs] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const rows = useMemo(
    () => [
      ...groups.map(item => ({ kind: 'group' as const, item })),
      ...friends.map(item => ({ kind: 'friend' as const, item })),
    ],
    [friends, groups],
  );

  const closeAction = () => {
    if (submitting) {
      return;
    }
    setActionVisible(false);
  };

  const resetActionForm = () => {
    setTargetID('');
    setMessage(defaultFriendMessage);
    setGroupName('');
    setSelectedUserIDs([]);
  };

  const openAction = (nextAction: Action) => {
    setAction(nextAction);
    setActionVisible(true);
    setTargetID('');
    setMessage(
      nextAction === 'join' ? defaultGroupMessage : defaultFriendMessage,
    );
    setGroupName('');
    setSelectedUserIDs([]);
  };

  const submitAction = async () => {
    if (submitting) {
      return;
    }
    Keyboard.dismiss();
    setSubmitting(true);
    let succeeded = false;
    try {
      if (action === 'friend') {
        succeeded = await onAddFriend(targetID.trim(), message.trim());
      } else if (action === 'join') {
        succeeded = await onJoinGroup(
          targetID.trim(),
          message.trim() || defaultGroupMessage,
        );
      } else {
        succeeded = await onCreateGroup(groupName.trim(), selectedUserIDs);
      }
    } finally {
      setSubmitting(false);
      if (succeeded) {
        setActionVisible(false);
      }
    }
  };

  const submitDisabled =
    submitting || (action === 'create' ? !groupName.trim() : !targetID.trim());

  const scanGroupQrCode = async () => {
    if (scanning || submitting) {
      return;
    }
    Keyboard.dismiss();
    setScanning(true);
    try {
      const barcode = await DataScanner.scanBarcode({
        targetFormats: ['qr'],
        enableAutoZoom: true,
      });
      const groupID = parseGroupInviteValue(barcode.value);
      if (!groupID) {
        showToast('不是有效的 SPACE IM 群二维码');
        return;
      }
      setTargetID(groupID);
      showToast('已识别群二维码');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (!/cancel/i.test(errorMessage)) {
        showToast('扫码功能不可用');
      }
    } finally {
      setScanning(false);
    }
  };

  const confirmDeleteFriend = async (friend: FriendUserItem) => {
    const name = friend.remark || friend.nickname || friend.userID;
    const confirmed = await showConfirm({
      title: '删除好友',
      message: `确定删除“${name}”吗？`,
      confirmText: '删除',
      destructive: true,
    });
    if (confirmed) {
      await onDeleteFriend(friend);
    }
  };

  const confirmLeaveGroup = async (group: GroupItem) => {
    const isOwner = group.ownerUserID === selfUserID;
    const confirmed = await showConfirm({
      title: isOwner ? '解散群聊' : '退出群聊',
      message: isOwner
        ? `你是群主，确定解散群聊“${group.groupName}”吗？`
        : `确定退出群聊“${group.groupName}”吗？`,
      confirmText: isOwner ? '解散' : '退出',
      destructive: true,
    });
    if (confirmed) {
      await onLeaveGroup(group);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.actionBar}>
        <ActionButton label="添加好友" onPress={() => openAction('friend')} />
        <ActionButton label="加入群聊" onPress={() => openAction('join')} />
        <ActionButton label="创建群聊" onPress={() => openAction('create')} />
      </View>
      <FlatList
        alwaysBounceVertical
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={row =>
          row.kind === 'group'
            ? `group-${row.item.groupID}`
            : `friend-${row.item.userID}`
        }
        ListEmptyComponent={
          friendApplications.length === 0 && groupApplications.length === 0 ? (
            <EmptyState
              subtitle="好友和已加入群组会显示在这里"
              title="暂无联系人"
            />
          ) : null
        }
        ListHeaderComponent={
          <>
            <GroupApplications
              applications={groupApplications}
              onAccept={onAcceptGroupApplication}
              onReject={onRejectGroupApplication}
            />
            <FriendApplications
              applications={friendApplications}
              onAccept={onAcceptFriendApplication}
              onReject={onRejectFriendApplication}
            />
          </>
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
        overScrollMode="always"
        renderItem={({ item: row, index }) => {
          const isGroup = row.kind === 'group';
          const name = isGroup
            ? row.item.groupName
            : row.item.remark || row.item.nickname || '用户';
          const subtitle = isGroup ? `${row.item.memberCount} 位成员` : '';
          return (
            <>
              {(index === 0 ||
                isGroup !== (rows[index - 1]?.kind === 'group')) && (
                <Text style={styles.sectionLabel}>
                  {isGroup ? '群组' : '好友'}
                </Text>
              )}
              {isGroup ? (
                <ContactRow
                  faceURL={row.item.faceURL}
                  name={name}
                  onLongPress={() => confirmLeaveGroup(row.item)}
                  onPress={() => onOpenGroup(row.item)}
                  subtitle={subtitle}
                />
              ) : (
                <ContactRow
                  faceURL={row.item.faceURL}
                  name={name}
                  onLongPress={() => confirmDeleteFriend(row.item)}
                  onPress={() => onOpenFriend(row.item)}
                  subtitle={subtitle}
                />
              )}
            </>
          );
        }}
      />
      <Modal
        animationType="fade"
        onDismiss={resetActionForm}
        onRequestClose={closeAction}
        transparent
        visible={actionVisible}
      >
        <KeyboardCenteredModal
          onPress={closeAction}
          style={styles.modalBackdrop}
        >
          <Pressable onPress={() => undefined} style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {action === 'friend'
                ? '添加好友'
                : action === 'join'
                ? '加入群聊'
                : '创建群聊'}
            </Text>
            {action === 'create' ? (
              <>
                <TextInput
                  autoCorrect={false}
                  onChangeText={setGroupName}
                  placeholder="群聊名称"
                  placeholderTextColor="#A4ADBC"
                  style={styles.input}
                  value={groupName}
                />
                <Text style={styles.memberTitle}>选择初始成员（可选）</Text>
                <FlatList
                  data={friends}
                  keyExtractor={friend => friend.userID}
                  ListEmptyComponent={
                    <Text style={styles.noFriends}>
                      暂无好友，可先创建空群聊
                    </Text>
                  }
                  style={styles.memberList}
                  renderItem={({ item }) => {
                    const selected = selectedUserIDs.includes(item.userID);
                    return (
                      <Pressable
                        onPress={() =>
                          setSelectedUserIDs(current =>
                            selected
                              ? current.filter(id => id !== item.userID)
                              : [...current, item.userID],
                          )
                        }
                        style={styles.memberRow}
                      >
                        <Avatar
                          name={item.remark || item.nickname || '用户'}
                          size={36}
                          uri={item.faceURL}
                        />
                        <Text numberOfLines={1} style={styles.memberName}>
                          {item.remark || item.nickname || '用户'}
                        </Text>
                        <View
                          style={[
                            styles.checkbox,
                            selected && styles.checkboxSelected,
                          ]}
                        >
                          {selected && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                      </Pressable>
                    );
                  }}
                />
              </>
            ) : (
              <>
                <View style={action === 'join' && styles.groupIDInputRow}>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setTargetID}
                    placeholder={
                      action === 'friend' ? '请输入手机号' : '请输入群号'
                    }
                    placeholderTextColor="#A4ADBC"
                    style={[
                      styles.input,
                      action === 'join' && styles.groupIDInput,
                    ]}
                    value={targetID}
                  />
                  {action === 'join' ? (
                    <Pressable
                      accessibilityLabel="扫描群二维码"
                      disabled={scanning || submitting}
                      onPress={scanGroupQrCode}
                      style={[
                        styles.scanButton,
                        (scanning || submitting) && styles.submitButtonDisabled,
                      ]}
                    >
                      {scanning ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <MaterialCommunityIcons
                          color="#FFFFFF"
                          name="qrcode-scan"
                          size={23}
                        />
                      )}
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  multiline
                  onChangeText={setMessage}
                  placeholder="申请说明"
                  placeholderTextColor="#A4ADBC"
                  style={[styles.input, styles.messageInput]}
                  value={message}
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable onPress={closeAction} style={styles.cancelButton}>
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={submitDisabled}
                onPress={submitAction}
                style={[
                  styles.submitButton,
                  submitDisabled && styles.submitButtonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitText}>
                    {action === 'create' ? '创建' : '发送申请'}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardCenteredModal>
      </Modal>
    </View>
  );
}

function FriendApplications({
  applications,
  onAccept,
  onReject,
}: {
  applications: FriendApplicationItem[];
  onAccept: (
    application: FriendApplicationItem,
    message: string,
  ) => Promise<boolean>;
  onReject: (
    application: FriendApplicationItem,
    message: string,
  ) => Promise<boolean>;
}) {
  if (applications.length === 0) {
    return null;
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>好友申请</Text>
      {applications.map(application => (
        <FriendApplicationRow
          application={application}
          key={`${application.fromUserID}-${application.createTime}`}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </View>
  );
}

function FriendApplicationRow({
  application,
  onAccept,
  onReject,
}: {
  application: FriendApplicationItem;
  onAccept: (
    application: FriendApplicationItem,
    message: string,
  ) => Promise<boolean>;
  onReject: (
    application: FriendApplicationItem,
    message: string,
  ) => Promise<boolean>;
}) {
  const [processing, setProcessing] = useState(false);
  const name = application.fromNickname || '用户';
  const message = application.reqMsg || '请求添加你为好友';

  const handle = async (result: 'accept' | 'reject') => {
    if (processing) {
      return;
    }
    setProcessing(true);
    try {
      if (result === 'accept') {
        await onAccept(application, '已同意');
      } else {
        await onReject(application, '已拒绝');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.applicationRow}>
      <Avatar name={name} uri={application.fromFaceURL} size={44} />
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {name}
        </Text>
        <Text numberOfLines={2} style={styles.subtitle}>
          {message}
        </Text>
      </View>
      <View style={styles.applicationActions}>
        <Pressable
          disabled={processing}
          onPress={() => handle('reject')}
          style={[styles.applicationButton, styles.rejectButton]}
        >
          <Text style={styles.rejectText}>拒绝</Text>
        </Pressable>
        <Pressable
          disabled={processing}
          onPress={() => handle('accept')}
          style={[styles.applicationButton, styles.acceptButton]}
        >
          {processing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.acceptText}>通过</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function GroupApplications({
  applications,
  onAccept,
  onReject,
}: {
  applications: GroupApplicationItem[];
  onAccept: (
    application: GroupApplicationItem,
    message: string,
  ) => Promise<boolean>;
  onReject: (
    application: GroupApplicationItem,
    message: string,
  ) => Promise<boolean>;
}) {
  if (applications.length === 0) {
    return null;
  }

  return (
    <View>
      <Text style={styles.sectionLabel}>群聊申请</Text>
      {applications.map(application => (
        <GroupApplicationRow
          application={application}
          key={`${application.groupID}-${application.userID}-${application.reqTime}`}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </View>
  );
}

function GroupApplicationRow({
  application,
  onAccept,
  onReject,
}: {
  application: GroupApplicationItem;
  onAccept: (
    application: GroupApplicationItem,
    message: string,
  ) => Promise<boolean>;
  onReject: (
    application: GroupApplicationItem,
    message: string,
  ) => Promise<boolean>;
}) {
  const [processing, setProcessing] = useState(false);
  const name = application.nickname || '用户';
  const message = application.reqMsg || '请求加入群聊';

  const handle = async (result: 'accept' | 'reject') => {
    if (processing) {
      return;
    }
    setProcessing(true);
    try {
      if (result === 'accept') {
        await onAccept(application, '已同意');
      } else {
        await onReject(application, '已拒绝');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.applicationRow}>
      <Avatar name={name} uri={application.userFaceURL} size={44} />
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          申请加入：{application.groupName || '群聊'}
        </Text>
        <Text numberOfLines={2} style={styles.subtitle}>
          {message}
        </Text>
      </View>
      <View style={styles.applicationActions}>
        <Pressable
          disabled={processing}
          onPress={() => handle('reject')}
          style={[styles.applicationButton, styles.rejectButton]}
        >
          <Text style={styles.rejectText}>拒绝</Text>
        </Pressable>
        <Pressable
          disabled={processing}
          onPress={() => handle('accept')}
          style={[styles.applicationButton, styles.acceptButton]}
        >
          {processing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.acceptText}>通过</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ContactRow({
  faceURL,
  name,
  subtitle,
  onLongPress,
  onPress,
}: {
  faceURL: string;
  name: string;
  subtitle?: string;
  onLongPress: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Avatar name={name} uri={faceURL} size={44} />
      <View style={styles.body}>
        <Text numberOfLines={1} style={styles.title}>
          {name}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={styles.actionIcon}>＋</Text>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  actionIcon: {
    color: colors.primary,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '500',
  },
  actionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingTop: 16,
    paddingBottom: 8,
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
  applicationRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  applicationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  applicationButton: {
    minWidth: 54,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  acceptButton: { backgroundColor: colors.primary },
  rejectText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  acceptText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  rowPressed: { backgroundColor: '#F1F4F9' },
  body: { flex: 1, marginLeft: 12 },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
    marginRight: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 32, 51, 0.45)',
  },
  modalCard: {
    maxHeight: '78%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 18,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: '#FAFBFD',
    fontSize: 15,
    marginBottom: 12,
  },
  groupIDInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  groupIDInput: {
    flex: 1,
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: colors.primary,
  },
  messageInput: {
    height: 84,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  memberTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  memberList: { maxHeight: 260 },
  memberRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  memberName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    marginLeft: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#B9C3D2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  noFriends: {
    color: colors.muted,
    fontSize: 13,
    paddingVertical: 18,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    height: 44,
    minWidth: 74,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  submitButton: {
    height: 44,
    minWidth: 100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
