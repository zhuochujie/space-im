import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, Vibration } from 'react-native';
import OpenIMSDK, {
  type ConversationItem,
  type FriendApplicationItem,
  type FriendUserItem,
  type GroupApplicationItem,
  type GroupItem,
  type MessageItem,
  ApplicationHandleResult,
  GroupMemberFilter,
  GroupJoinSource,
  GroupType,
  OpenIMEvent,
  type SelfUserInfo,
  SessionType,
} from '@openim/rn-client-sdk';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import type { ChatTarget, MainTab, ServerConfig } from '../types/app';
import { getErrorCode, getErrorMessage } from '../utils/errors';
import { showToast } from '../utils/toast';
import { getUserByUsername } from '../services/chatApi';
import { ChatScreen } from './ChatScreen';
import { ContactsScreen } from './ContactsScreen';
import { ConversationsScreen } from './ConversationsScreen';
import { ProfileScreen } from './ProfileScreen';

type Props = {
  config: ServerConfig;
  connection: string;
  profile?: SelfUserInfo;
  username?: string;
  onChangePassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
  onChangeProfile: (profile: {
    avatarContentType?: string;
    avatarFileName?: string;
    avatarPath?: string;
    nickname: string;
  }) => Promise<boolean>;
  onLogout: () => void;
};

const tabItems: ReadonlyArray<[MainTab, string, string, string]> = [
  ['messages', '消息', 'chat-processing-outline', 'chat-processing'],
  ['contacts', '联系人', 'account-multiple-outline', 'account-multiple'],
  ['me', '我的', 'account-circle-outline', 'account-circle'],
];

const titles: Record<MainTab, string> = {
  messages: '消息',
  contacts: '联系人',
  me: '我的',
};

const isMissingGroupError = (error: unknown) =>
  getErrorMessage(error).includes('RecordNotFound');

const isGroupDismissedError = (error: unknown) =>
  getErrorCode(error) === 1204 ||
  getErrorMessage(error).includes('DismissedAlreadyError');

export function MainScreen({
  config,
  connection,
  onChangeProfile,
  onChangePassword,
  profile,
  username,
  onLogout,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<MainTab>('messages');
  const [chat, setChat] = useState<ChatTarget>();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [friends, setFriends] = useState<FriendUserItem[]>([]);
  const [friendApplications, setFriendApplications] = useState<
    FriendApplicationItem[]
  >([]);
  const [groupApplications, setGroupApplications] = useState<
    GroupApplicationItem[]
  >([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [refreshingConversations, setRefreshingConversations] = useState(false);
  const [refreshingContacts, setRefreshingContacts] = useState(false);
  const notifiedMessageIDs = useRef(new Set<string>());
  const tabBadges = useMemo<Record<MainTab, number>>(
    () => ({
      messages: conversations.reduce(
        (total, conversation) => total + (conversation.unreadCount || 0),
        0,
      ),
      contacts: friendApplications.length + groupApplications.length,
      me: 0,
    }),
    [conversations, friendApplications.length, groupApplications.length],
  );
  const applyConversationChanges = useCallback(
    (changedConversations: ConversationItem[]) => {
      setConversations(current => {
        const map = new Map(current.map(item => [item.conversationID, item]));
        changedConversations.forEach(item => {
          map.set(item.conversationID, item);
        });
        return [...map.values()].sort(
          (a, b) => b.latestMsgSendTime - a.latestMsgSendTime,
        );
      });
    },
    [],
  );
  const notifyIncomingMessages = useCallback(
    (incoming: MessageItem[]) => {
      if (!profile?.userID) {
        return;
      }
      const shouldVibrate = incoming.some(message => {
        if (
          !message.clientMsgID ||
          notifiedMessageIDs.current.has(message.clientMsgID) ||
          message.sendID === profile.userID
        ) {
          return false;
        }
        notifiedMessageIDs.current.add(message.clientMsgID);
        const isActiveGroupChat =
          chat?.sessionType === SessionType.Group &&
          message.groupID &&
          message.groupID === chat.groupID;
        const isActiveSingleChat =
          chat?.sessionType === SessionType.Single &&
          message.sendID &&
          message.sendID === chat.userID;
        return !isActiveGroupChat && !isActiveSingleChat;
      });
      if (shouldVibrate) {
        Vibration.vibrate(80);
      }
    },
    [chat?.groupID, chat?.sessionType, chat?.userID, profile?.userID],
  );

  const refreshConversations = useCallback(async () => {
    try {
      const list = await OpenIMSDK.getAllConversationList();
      setConversations(
        [...list].sort((a, b) => b.latestMsgSendTime - a.latestMsgSendTime),
      );
    } catch {
      if (connection === '已连接') {
        showToast('会话加载失败');
      }
    }
  }, [connection]);

  const refreshContacts = useCallback(async () => {
    try {
      const [friendList, groupList, applicationList] = await Promise.all([
        OpenIMSDK.getFriendList(false),
        OpenIMSDK.getJoinedGroupList(),
        OpenIMSDK.getFriendApplicationListAsRecipient({
          handleResults: [ApplicationHandleResult.Unprocessed],
          offset: 0,
          count: 50,
        }),
      ]);
      const joinedGroups = await Promise.all(
        groupList.map(async group => ({
          group,
          joined: await OpenIMSDK.isJoinGroup(group.groupID).catch(() => false),
        })),
      );
      const visibleGroups = joinedGroups
        .filter(({ joined }) => joined)
        .map(({ group }) => group);
      const manageableGroupIDs = profile?.userID
        ? (
            await Promise.all(
              visibleGroups.map(async group => {
                if (group.ownerUserID === profile.userID) {
                  return group.groupID;
                }
                const admins = await OpenIMSDK.getGroupMemberOwnerAndAdmin(
                  group.groupID,
                ).catch(() => []);
                return admins.some(member => member.userID === profile.userID)
                  ? group.groupID
                  : undefined;
              }),
            )
          ).filter((groupID): groupID is string => Boolean(groupID))
        : [];
      const groupApplicationList =
        manageableGroupIDs.length > 0
          ? await OpenIMSDK.getGroupApplicationListAsRecipient({
              groupIDs: manageableGroupIDs,
              handleResults: [ApplicationHandleResult.Unprocessed],
              offset: 0,
              count: 50,
            })
          : [];
      setFriends(friendList);
      setGroups(visibleGroups);
      setFriendApplications(
        [...applicationList].sort((a, b) => b.createTime - a.createTime),
      );
      setGroupApplications(
        [...groupApplicationList].sort(
          (a, b) => (b.reqTime || b.createTime) - (a.reqTime || a.createTime),
        ),
      );
    } catch {
      if (connection === '已连接') {
        showToast('联系人加载失败');
      }
    }
  }, [connection, profile?.userID]);

  const pullToRefreshConversations = useCallback(async () => {
    setRefreshingConversations(true);
    try {
      await refreshConversations();
    } finally {
      setRefreshingConversations(false);
    }
  }, [refreshConversations]);

  const pullToRefreshContacts = useCallback(async () => {
    setRefreshingContacts(true);
    try {
      await refreshContacts();
    } finally {
      setRefreshingContacts(false);
    }
  }, [refreshContacts]);

  useEffect(() => {
    refreshConversations();
    refreshContacts();
    const syncStarted = () => showToast('同步中');
    const syncFailed = () => showToast('同步失败');
    const receiveOne = (message: MessageItem) =>
      notifyIncomingMessages([message]);
    OpenIMSDK.on(OpenIMEvent.OnConversationChanged, applyConversationChanges);
    OpenIMSDK.on(OpenIMEvent.OnNewConversation, applyConversationChanges);
    OpenIMSDK.on(OpenIMEvent.OnRecvNewMessages, notifyIncomingMessages);
    OpenIMSDK.on(OpenIMEvent.OnRecvNewMessage, receiveOne);
    OpenIMSDK.on(OpenIMEvent.OnSyncServerStart, syncStarted);
    OpenIMSDK.on(OpenIMEvent.OnSyncServerFailed, syncFailed);
    OpenIMSDK.on(OpenIMEvent.OnSyncServerFinish, refreshConversations);
    OpenIMSDK.on(OpenIMEvent.OnFriendAdded, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnFriendDeleted, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnFriendInfoChanged, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnFriendApplicationAdded, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnFriendApplicationAccepted, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnFriendApplicationRejected, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnFriendApplicationDeleted, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupApplicationAdded, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupApplicationAccepted, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupApplicationRejected, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupApplicationDeleted, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupInfoChanged, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnJoinedGroupAdded, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnJoinedGroupDeleted, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupDismissed, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupMemberInfoChanged, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupMemberAdded, refreshContacts);
    OpenIMSDK.on(OpenIMEvent.OnGroupMemberDeleted, refreshContacts);
    return () => {
      OpenIMSDK.off(
        OpenIMEvent.OnConversationChanged,
        applyConversationChanges,
      );
      OpenIMSDK.off(OpenIMEvent.OnNewConversation, applyConversationChanges);
      OpenIMSDK.off(OpenIMEvent.OnRecvNewMessages, notifyIncomingMessages);
      OpenIMSDK.off(OpenIMEvent.OnRecvNewMessage, receiveOne);
      OpenIMSDK.off(OpenIMEvent.OnSyncServerStart, syncStarted);
      OpenIMSDK.off(OpenIMEvent.OnSyncServerFailed, syncFailed);
      OpenIMSDK.off(OpenIMEvent.OnSyncServerFinish, refreshConversations);
      OpenIMSDK.off(OpenIMEvent.OnFriendAdded, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnFriendDeleted, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnFriendInfoChanged, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnFriendApplicationAdded, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnFriendApplicationAccepted, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnFriendApplicationRejected, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnFriendApplicationDeleted, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupApplicationAdded, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupApplicationAccepted, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupApplicationRejected, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupApplicationDeleted, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupInfoChanged, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnJoinedGroupAdded, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnJoinedGroupDeleted, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupDismissed, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupMemberInfoChanged, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupMemberAdded, refreshContacts);
      OpenIMSDK.off(OpenIMEvent.OnGroupMemberDeleted, refreshContacts);
    };
  }, [
    applyConversationChanges,
    notifyIncomingMessages,
    refreshContacts,
    refreshConversations,
  ]);

  const openConversation = (conversation: ConversationItem) => {
    setChat({
      conversationID: conversation.conversationID,
      title:
        conversation.showName || conversation.userID || conversation.groupID,
      userID: conversation.userID,
      groupID: conversation.groupID,
      sessionType: conversation.conversationType,
      isNotInGroup: conversation.isNotInGroup,
    });
  };

  const openTarget = async (
    sourceID: string,
    sessionType: SessionType,
    title: string,
  ) => {
    try {
      const conversation = await OpenIMSDK.getOneConversation({
        sourceID,
        sessionType,
      });
      openConversation({ ...conversation, showName: title });
    } catch {
      showToast('无法打开会话');
    }
  };

  const sendFriendRequest = async (
    userID: string,
    message: string,
    _displayName: string,
  ): Promise<boolean> => {
    if (userID === profile?.userID) {
      showToast('不能添加自己');
      return false;
    }
    await OpenIMSDK.addFriend({
      toUserID: userID,
      reqMsg: message,
    });
    showToast('申请已发送');
    return true;
  };

  const addFriend = async (
    friendUsername: string,
    message: string,
  ): Promise<boolean> => {
    try {
      const target = await getUserByUsername(
        config.chatServerAddr,
        friendUsername.trim(),
      );
      return await sendFriendRequest(target.userID, message, target.username);
    } catch (error) {
      const messageText = getErrorMessage(error);
      if (messageText.includes('用户不存在')) {
        showToast('用户不存在');
        return false;
      }
      showToast('添加失败');
      return false;
    }
  };

  const joinGroup = async (
    groupID: string,
    message: string,
  ): Promise<boolean> => {
    try {
      if (!groupID) {
        showToast('请输入群 ID');
        return false;
      }
      const groupsInfo = await OpenIMSDK.getSpecifiedGroupsInfo([groupID]);
      if (groupsInfo.length === 0) {
        showToast('群不存在');
        return false;
      }
      const joined = await OpenIMSDK.isJoinGroup(groupID).catch(() => false);
      if (joined) {
        showToast('已在群聊中');
        return false;
      }
      await OpenIMSDK.joinGroup({
        groupID,
        reqMsg: message || '你好，我想加入群聊',
        joinSource: GroupJoinSource.Search,
      });
      const joinedAfterApply = await OpenIMSDK.isJoinGroup(groupID).catch(
        () => false,
      );
      await refreshContacts();
      showToast(joinedAfterApply ? '已加入' : '申请已发送');
      return true;
    } catch (error) {
      const messageText = getErrorMessage(error);
      showToast(
        isGroupDismissedError(error)
          ? '群聊已解散'
          : messageText.includes('ArgsError')
          ? '群 ID 有误'
          : '加入失败',
      );
      return false;
    }
  };

  const acceptFriendApplication = async (
    application: FriendApplicationItem,
    message: string,
  ): Promise<boolean> => {
    try {
      await OpenIMSDK.acceptFriendApplication({
        toUserID: application.fromUserID,
        handleMsg: message,
      });
      await refreshContacts();
      showToast('已通过');
      return true;
    } catch {
      showToast('操作失败');
      return false;
    }
  };

  const rejectFriendApplication = async (
    application: FriendApplicationItem,
    message: string,
  ): Promise<boolean> => {
    try {
      await OpenIMSDK.refuseFriendApplication({
        toUserID: application.fromUserID,
        handleMsg: message,
      });
      await refreshContacts();
      showToast('已拒绝');
      return true;
    } catch {
      showToast('操作失败');
      return false;
    }
  };

  const acceptGroupApplication = async (
    application: GroupApplicationItem,
    message: string,
  ): Promise<boolean> => {
    try {
      await OpenIMSDK.acceptGroupApplication({
        groupID: application.groupID,
        fromUserID: application.userID,
        handleMsg: message,
      });
      await refreshContacts();
      showToast('已通过');
      return true;
    } catch {
      showToast('操作失败');
      return false;
    }
  };

  const rejectGroupApplication = async (
    application: GroupApplicationItem,
    message: string,
  ): Promise<boolean> => {
    try {
      await OpenIMSDK.refuseGroupApplication({
        groupID: application.groupID,
        fromUserID: application.userID,
        handleMsg: message,
      });
      await refreshContacts();
      showToast('已拒绝');
      return true;
    } catch {
      showToast('操作失败');
      return false;
    }
  };

  const createGroup = async (
    name: string,
    memberUserIDs: string[],
  ): Promise<boolean> => {
    try {
      await OpenIMSDK.createGroup({
        memberUserIDs,
        groupInfo: {
          groupName: name,
          groupType: GroupType.Group,
          faceURL: '',
        },
      });
      showToast('已创建');
      await refreshContacts();
      return true;
    } catch {
      showToast('创建失败');
      return false;
    }
  };

  const deleteFriend = async (userID: string): Promise<boolean> => {
    try {
      await OpenIMSDK.deleteFriend(userID);
      setChat(undefined);
      await Promise.all([refreshContacts(), refreshConversations()]);
      showToast('已删除');
      return true;
    } catch {
      showToast('删除失败');
      return false;
    }
  };

  const deleteConversation = async (
    conversation: ConversationItem,
  ): Promise<boolean> => {
    try {
      await OpenIMSDK.deleteConversationAndDeleteAllMsg(
        conversation.conversationID,
      );
      if (chat?.conversationID === conversation.conversationID) {
        setChat(undefined);
      }
      await refreshConversations();
      showToast('已删除');
      return true;
    } catch {
      showToast('删除失败');
      return false;
    }
  };

  const quitGroup = async (
    groupID: string,
    _groupName: string,
  ): Promise<boolean> => {
    try {
      const group = groups.find(item => item.groupID === groupID);
      const joined = await OpenIMSDK.isJoinGroup(groupID).catch(() => false);
      if (!group || !joined) {
        setChat(undefined);
        await refreshConversations();
        showToast('已不在群聊中');
        return false;
      }
      const isOwner = group?.ownerUserID === profile?.userID;
      if (isOwner) {
        await OpenIMSDK.dismissGroup(groupID);
      } else {
        await OpenIMSDK.quitGroup(groupID);
      }
      setChat(undefined);
      await Promise.all([refreshContacts(), refreshConversations()]);
      showToast(isOwner ? '已解散' : '已退出');
      return true;
    } catch (error) {
      if (isGroupDismissedError(error)) {
        setChat(undefined);
        await Promise.all([refreshContacts(), refreshConversations()]);
        showToast('群聊已解散');
        return true;
      }
      showToast(isMissingGroupError(error) ? '已不在群聊中' : '操作失败');
      return false;
    }
  };

  const inviteGroupMembers = async (
    groupID: string,
    userIDs: string[],
  ): Promise<boolean> => {
    try {
      const group = groups.find(item => item.groupID === groupID);
      const joined = await OpenIMSDK.isJoinGroup(groupID).catch(() => false);
      if (!group || !joined) {
        setChat(undefined);
        await refreshConversations();
        showToast('已不在群聊中');
        return false;
      }
      const members = await OpenIMSDK.getGroupMemberList({
        groupID,
        filter: GroupMemberFilter.All,
        offset: 0,
        count: 1000,
      });
      const existingUserIDs = new Set(members.map(member => member.userID));
      const inviteUserIDs = userIDs.filter(
        userID => !existingUserIDs.has(userID),
      );
      if (inviteUserIDs.length === 0) {
        showToast('好友已在群内');
        return false;
      }
      await OpenIMSDK.inviteUserToGroup({
        groupID,
        userIDList: inviteUserIDs,
        reason: '邀请你加入群聊',
      });
      await Promise.all([refreshContacts(), refreshConversations()]);
      showToast('已邀请');
      return true;
    } catch (error) {
      showToast(isMissingGroupError(error) ? '已不在群聊中' : '邀请失败');
      return false;
    }
  };

  if (chat && profile) {
    const currentFriend = friends.find(friend => friend.userID === chat.userID);
    const currentGroup = groups.find(group => group.groupID === chat.groupID);

    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <ChatScreen
          friend={currentFriend}
          friends={friends}
          group={currentGroup}
          onAddFriend={() =>
            sendFriendRequest(chat.userID, '你好，我想添加你为好友', chat.title)
          }
          onBack={() => {
            setChat(undefined);
            refreshConversations();
          }}
          onDeleteFriend={() => deleteFriend(chat.userID)}
          onInviteGroupMembers={userIDs =>
            inviteGroupMembers(chat.groupID, userIDs)
          }
          onQuitGroup={() => quitGroup(chat.groupID, chat.title)}
          onSetRemark={async remark => {
            try {
              await OpenIMSDK.updateFriends({
                friendUserIDs: [chat.userID],
                remark,
              });
              setChat(current => {
                if (!current) {
                  return current;
                }
                return {
                  ...current,
                  title: remark || currentFriend?.nickname || current.title,
                };
              });
              await Promise.all([refreshContacts(), refreshConversations()]);
              showToast('已保存');
              return true;
            } catch {
              showToast('保存失败');
              return false;
            }
          }}
          selfUserID={profile.userID}
          target={chat}
        />
      </View>
    );
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{titles[tab]}</Text>
        <View style={styles.connectionPill}>
          <View
            style={[
              styles.connectionDot,
              connection !== '已连接' && styles.connectionDotOffline,
            ]}
          />
          <Text style={styles.connectionLabel}>{connection}</Text>
        </View>
      </View>
      <View style={styles.content}>
        {tab === 'messages' && (
          <ConversationsScreen
            conversations={conversations}
            loading={refreshingConversations}
            onDelete={async conversation => {
              await deleteConversation(conversation);
            }}
            onOpen={openConversation}
            onRefresh={pullToRefreshConversations}
          />
        )}
        {tab === 'contacts' && (
          <ContactsScreen
            friends={friends}
            friendApplications={friendApplications}
            groupApplications={groupApplications}
            groups={groups}
            loading={refreshingContacts}
            selfUserID={profile?.userID ?? ''}
            onAcceptFriendApplication={acceptFriendApplication}
            onAcceptGroupApplication={acceptGroupApplication}
            onAddFriend={addFriend}
            onCreateGroup={createGroup}
            onDeleteFriend={friend => deleteFriend(friend.userID)}
            onJoinGroup={joinGroup}
            onLeaveGroup={group => quitGroup(group.groupID, group.groupName)}
            onOpenFriend={friend =>
              openTarget(
                friend.userID,
                SessionType.Single,
                friend.remark || friend.nickname || friend.userID,
              )
            }
            onOpenGroup={group =>
              openTarget(group.groupID, SessionType.Group, group.groupName)
            }
            onRejectFriendApplication={rejectFriendApplication}
            onRejectGroupApplication={rejectGroupApplication}
            onRefresh={pullToRefreshContacts}
          />
        )}
        {tab === 'me' && (
          <ProfileScreen
            onChangePassword={onChangePassword}
            onChangeProfile={onChangeProfile}
            onLogout={onLogout}
            profile={profile}
            username={username}
          />
        )}
      </View>
      <View
        style={[
          styles.tabBar,
          {
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {tabItems.map(([key, label, icon, activeIcon]) => {
          const badgeCount = tabBadges[key];
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={styles.tabItem}
            >
              <View style={styles.tabIconWrap}>
                <MaterialCommunityIcons
                  color={tab === key ? colors.primary : '#A0A9B8'}
                  name={tab === key ? activeIcon : icon}
                  size={23}
                  style={styles.tabIcon}
                />
                {badgeCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.tabText, tab === key && styles.tabTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 66,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: colors.text },
  connectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
    marginRight: 6,
  },
  connectionDotOffline: { backgroundColor: '#E59B32' },
  connectionLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  content: { flex: 1 },
  tabBar: {
    height: 64,
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabIconWrap: {
    minWidth: 28,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  tabIcon: {},
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F04438',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.card,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
  },
  tabText: { fontSize: 11, color: '#8A95A7', fontWeight: '600' },
  tabTextActive: { color: colors.primary },
});
