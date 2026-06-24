import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import OpenIMSDK, {
  type FriendUserItem,
  type GroupItem,
  type GroupMemberItem,
  type MessageItem,
  type PublicUserItem,
  GroupMemberFilter,
  GroupJoinSource,
  GroupMemberRole,
  MessageStatus,
  OpenIMEvent,
  SessionType,
  ViewType,
} from '@openim/rn-client-sdk';
import RNFS from 'react-native-fs';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type MediaType,
} from 'react-native-image-picker';
import { createThumbnail } from 'react-native-create-thumbnail';
import type { createSound } from 'react-native-nitro-sound';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../components/Avatar';
import { CachedImage } from '../components/CachedImage';
import { EmptyState } from '../components/EmptyState';
import { colors } from '../theme/colors';
import type { ChatTarget } from '../types/app';
import { copyMessageText } from '../utils/clipboard';
import { groupMemberRoleText } from '../utils/group';
import {
  avatarPickerOptions,
  fileExtension,
  localMediaPath,
  mediaUri,
  saveMediaToAlbum,
} from '../utils/media';
import { isSystemNotificationMessage, messageText } from '../utils/messages';
import { formatTime } from '../utils/time';
import { showConfirm, showToast } from '../utils/toast';
import { requestRecordPermission, voiceDurationText } from '../utils/voice';

const GROUP_MEMBER_PREVIEW_COUNT = 7;
const GROUP_MEMBER_PAGE_SIZE = 50;
const MODAL_DISMISS_DELAY_MS = 280;

const waitForModalDismiss = () =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), MODAL_DISMISS_DELAY_MS);
  });

type SoundInstance = ReturnType<typeof createSound>;
type RecordBackEvent = Parameters<
  Parameters<SoundInstance['addRecordBackListener']>[0]
>[0];

type PendingSaveMedia = {
  fallbackExtension: 'jpg' | 'mp4';
  type: 'photo' | 'video';
  uri: string;
};

type Props = {
  target: ChatTarget;
  selfUserID: string;
  friends: FriendUserItem[];
  friend?: FriendUserItem;
  group?: GroupItem;
  onBack: () => void;
  onAddFriend: (userID: string, title: string) => Promise<boolean>;
  onSetRemark: (remark: string) => Promise<boolean>;
  onDeleteFriend: () => Promise<boolean>;
  onQuitGroup: () => Promise<boolean>;
  onInviteGroupMembers: (userIDs: string[]) => Promise<boolean>;
};

export function ChatScreen({
  target,
  selfUserID,
  friends,
  friend,
  group,
  onBack,
  onAddFriend,
  onSetRemark,
  onDeleteFriend,
  onQuitGroup,
  onInviteGroupMembers,
}: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageProgress, setMessageProgress] = useState<
    Record<string, number>
  >({});
  const [previewImage, setPreviewImage] = useState('');
  const [previewVideo, setPreviewVideo] = useState<{
    thumbnail?: string;
    uri: string;
  }>();
  const [pendingSaveMedia, setPendingSaveMedia] = useState<PendingSaveMedia>();
  const [savingPreviewMedia, setSavingPreviewMedia] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<PublicUserItem>();
  const [groupMembers, setGroupMembers] = useState<GroupMemberItem[]>([]);
  const [allGroupMembers, setAllGroupMembers] = useState<GroupMemberItem[]>([]);
  const [groupMembersPageVisible, setGroupMembersPageVisible] = useState(false);
  const [groupMembersPageLoading, setGroupMembersPageLoading] = useState(false);
  const [groupMembersPageLoadingMore, setGroupMembersPageLoadingMore] =
    useState(false);
  const [groupMembersPageHasMore, setGroupMembersPageHasMore] = useState(true);
  const [groupMemberCount, setGroupMemberCount] = useState(
    group?.memberCount || 0,
  );
  const [groupProfile, setGroupProfile] = useState<GroupItem | undefined>(
    group,
  );
  const [selectedMember, setSelectedMember] = useState<GroupMemberItem>();
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [kickConfirmationVisible, setKickConfirmationVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteClosing, setInviteClosing] = useState(false);
  const [visibleInviteCandidates, setVisibleInviteCandidates] = useState<
    FriendUserItem[]
  >([]);
  const [selectedInviteUserIDs, setSelectedInviteUserIDs] = useState<string[]>(
    [],
  );
  const [mentionPickerVisible, setMentionPickerVisible] = useState(false);
  const [mentionPickerLoading, setMentionPickerLoading] = useState(false);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [selectedMentions, setSelectedMentions] = useState<GroupMemberItem[]>(
    [],
  );
  const [remark, setRemark] = useState(friend?.remark || '');
  const [remarkModalVisible, setRemarkModalVisible] = useState(false);
  const [groupInfoModalVisible, setGroupInfoModalVisible] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [groupAvatarDraftUri, setGroupAvatarDraftUri] = useState('');
  const [groupAvatarDraftPath, setGroupAvatarDraftPath] = useState('');
  const [groupAvatarDraftFileName, setGroupAvatarDraftFileName] = useState('');
  const [groupAvatarDraftContentType, setGroupAvatarDraftContentType] =
    useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);
  const [cancelVoiceBySlide, setCancelVoiceBySlide] = useState(false);
  const [playingSoundID, setPlayingSoundID] = useState('');
  const recordingPath = useRef('');
  const recordStartedAt = useRef(0);
  const latestRecordMs = useRef(0);
  const cancelVoiceBySlideRef = useRef(false);
  const soundRef = useRef<SoundInstance | null>(null);
  const isGroupChat = target.sessionType === SessionType.Group;
  const isGroupActive =
    !isGroupChat || (Boolean(group) && !target.isNotInGroup);
  const currentGroup = groupProfile || group;
  const canSendMessage = !isGroupChat || isGroupActive;
  const isGroupOwner = isGroupChat && currentGroup?.ownerUserID === selfUserID;
  const selfGroupRole = isGroupOwner
    ? GroupMemberRole.Owner
    : groupMembers.find(member => member.userID === selfUserID)?.roleLevel;
  const canEditGroupInfo =
    isGroupChat &&
    isGroupActive &&
    (selfGroupRole === GroupMemberRole.Owner ||
      selfGroupRole === GroupMemberRole.Admin);
  const canManageSelectedMemberRole =
    selfGroupRole === GroupMemberRole.Owner &&
    selectedMember?.userID !== selfUserID &&
    selectedMember?.roleLevel !== GroupMemberRole.Owner;
  const canKickSelectedMember =
    selectedMember?.userID !== selfUserID &&
    selectedMember?.roleLevel !== GroupMemberRole.Owner &&
    (selfGroupRole === GroupMemberRole.Owner ||
      (selfGroupRole === GroupMemberRole.Admin &&
        selectedMember?.roleLevel === GroupMemberRole.Normal));
  const displayedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const selectedMemberFriend = selectedMember
    ? friends.find(item => item.userID === selectedMember.userID)
    : undefined;
  const canAddSelectedMember =
    Boolean(selectedMember) &&
    selectedMember?.userID !== selfUserID &&
    !selectedMemberFriend;
  const inviteCandidates = useMemo(() => {
    const memberUserIDs = new Set(groupMembers.map(member => member.userID));
    return friends.filter(item => !memberUserIDs.has(item.userID));
  }, [friends, groupMembers]);
  const mentionCandidates = groupMembers.filter(
    member => member.userID !== selfUserID,
  );
  const previewGroupMembers = groupMembers.slice(0, GROUP_MEMBER_PREVIEW_COUNT);

  const appendMessages = useCallback((incoming: MessageItem[]) => {
    setMessages(current => {
      const map = new Map(
        [...current, ...incoming].map(item => [item.clientMsgID, item]),
      );
      return [...map.values()].sort((a, b) => a.sendTime - b.sendTime);
    });
  }, []);

  const updateMessage = useCallback(
    (clientMsgID: string, update: Partial<MessageItem>) => {
      setMessages(current =>
        current.map(item =>
          item.clientMsgID === clientMsgID ? { ...item, ...update } : item,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessages([]);
    const receive = (incoming: MessageItem[]) => {
      const relevant = incoming.filter(message =>
        target.sessionType === SessionType.Group
          ? message.groupID === target.groupID
          : (message.sendID === target.userID &&
              message.recvID === selfUserID) ||
            (message.sendID === selfUserID && message.recvID === target.userID),
      );
      if (relevant.length) {
        appendMessages(relevant);
        OpenIMSDK.markConversationMessageAsRead(target.conversationID).catch(
          () => undefined,
        );
      }
    };
    const receiveOne = (message: MessageItem) => receive([message]);
    const updateProgress = ({
      progress,
      message,
    }: {
      progress: number;
      message: MessageItem;
    }) => {
      setMessageProgress(current => ({
        ...current,
        [message.clientMsgID]: progress,
      }));
    };

    OpenIMSDK.on(OpenIMEvent.OnRecvNewMessages, receive);
    OpenIMSDK.on(OpenIMEvent.OnRecvNewMessage, receiveOne);
    OpenIMSDK.on(OpenIMEvent.SendMessageProgress, updateProgress);
    OpenIMSDK.getAdvancedHistoryMessageList({
      conversationID: target.conversationID,
      startClientMsgID: '',
      count: 50,
      viewType: ViewType.History,
    })
      .then(result => {
        if (active) {
          appendMessages(result.messageList);
        }
      })
      .catch(() => showToast('消息加载失败'))
      .finally(() => active && setLoading(false));
    OpenIMSDK.markConversationMessageAsRead(target.conversationID).catch(
      () => undefined,
    );
    if (target.sessionType === SessionType.Group) {
      OpenIMSDK.resetConversationGroupAtType(target.conversationID).catch(
        () => undefined,
      );
    }

    return () => {
      active = false;
      OpenIMSDK.off(OpenIMEvent.OnRecvNewMessages, receive);
      OpenIMSDK.off(OpenIMEvent.OnRecvNewMessage, receiveOne);
      OpenIMSDK.off(OpenIMEvent.SendMessageProgress, updateProgress);
    };
  }, [
    appendMessages,
    selfUserID,
    target.conversationID,
    target.groupID,
    target.sessionType,
    target.userID,
  ]);

  useEffect(() => {
    setRemark(friend?.remark || '');
  }, [friend?.remark]);

  useEffect(() => {
    return () => {
      const sound = soundRef.current;
      if (!sound) {
        return;
      }
      sound.stopRecorder().catch(() => undefined);
      sound.removeRecordBackListener();
      sound.stopPlayer().catch(() => undefined);
      sound.removePlayBackListener();
      sound.removePlaybackEndListener();
    };
  }, []);

  useEffect(() => {
    setGroupMemberCount(group?.memberCount || 0);
  }, [group?.groupID, group?.memberCount]);

  useEffect(() => {
    setGroupProfile(group);
  }, [group]);

  const sendMessage = async (draft: MessageItem) => {
    appendMessages([{ ...draft, status: MessageStatus.Sending }]);
    setMessageProgress(current => ({
      ...current,
      [draft.clientMsgID]: 0,
    }));
    try {
      const sent = await OpenIMSDK.sendMessage({
        recvID: target.userID,
        groupID: target.groupID,
        message: draft,
      });
      appendMessages([sent]);
    } catch (error) {
      updateMessage(draft.clientMsgID, { status: MessageStatus.Failed });
      throw error;
    } finally {
      setMessageProgress(current => {
        const next = { ...current };
        delete next[draft.clientMsgID];
        return next;
      });
    }
  };

  const sendText = async () => {
    const content = text.trim();
    if (!content || sending || !canSendMessage) {
      return;
    }
    const mentions = selectedMentions.filter(member =>
      content.includes(`@${member.nickname || '群成员'}`),
    );
    setSending(true);
    setText('');
    setSelectedMentions([]);
    let draft: MessageItem | undefined;
    try {
      draft =
        isGroupChat && mentions.length > 0
          ? await OpenIMSDK.createTextAtMessage({
              text: content,
              atUserIDList: mentions.map(member => member.userID),
              atUsersInfo: mentions.map(member => ({
                atUserID: member.userID,
                groupNickname: member.nickname || '群成员',
              })),
            })
          : await OpenIMSDK.createTextMessage(content);
      await sendMessage(draft);
    } catch {
      if (!draft) {
        setText(content);
        setSelectedMentions(mentions);
      }
      showToast('发送失败');
    } finally {
      setSending(false);
    }
  };

  const openMentionPicker = async () => {
    if (!isGroupChat || !isGroupActive || sending) {
      return;
    }
    setMentionPickerVisible(true);
    if (groupMembers.length > 0) {
      return;
    }
    setMentionPickerLoading(true);
    try {
      await loadGroupMembers();
    } catch {
      showToast('成员加载失败');
    } finally {
      setMentionPickerLoading(false);
    }
  };

  const closeMentionPicker = () => {
    if (!mentionPickerLoading) {
      setMentionPickerVisible(false);
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    setSelectedMentions(current =>
      current.filter(member =>
        value.includes(`@${member.nickname || '群成员'}`),
      ),
    );
    if (value.endsWith('@')) {
      openMentionPicker();
    }
  };

  const selectMention = (member: GroupMemberItem) => {
    const name = member.nickname || '群成员';
    setText(current => {
      const next = current.endsWith('@')
        ? `${current.slice(0, -1)}@${name} `
        : `${current}@${name} `;
      return next;
    });
    setSelectedMentions(current =>
      current.some(item => item.userID === member.userID)
        ? current
        : [...current, member],
    );
    setMentionPickerVisible(false);
  };

  const mentionMessageSender = (message: MessageItem) => {
    if (!isGroupChat || message.sendID === selfUserID || !canSendMessage) {
      return;
    }
    const member = groupMembers.find(item => item.userID === message.sendID);
    selectMention({
      groupID: target.groupID,
      userID: message.sendID,
      nickname: member?.nickname || message.senderNickname || '群成员',
      faceURL: member?.faceURL || message.senderFaceUrl || '',
      roleLevel: member?.roleLevel ?? GroupMemberRole.Normal,
      muteEndTime: member?.muteEndTime ?? 0,
      joinTime: member?.joinTime ?? 0,
      joinSource: member?.joinSource ?? GroupJoinSource.Invitation,
      inviterUserID: member?.inviterUserID ?? '',
      operatorUserID: member?.operatorUserID ?? '',
      ex: member?.ex ?? '',
    });
  };

  const retryMessage = async (message: MessageItem) => {
    if (sending || message.status !== MessageStatus.Failed) {
      return;
    }
    setSending(true);
    try {
      await sendMessage(message);
    } catch {
      showToast('重试失败');
    } finally {
      setSending(false);
    }
  };

  const sendMediaAsset = async (asset: Asset) => {
    const mediaType: Exclude<MediaType, 'mixed'> = asset.type?.startsWith(
      'video/',
    )
      ? 'video'
      : 'photo';

    setSending(true);
    try {
      const path = await localMediaPath(asset);
      const draft =
        mediaType === 'video'
          ? await (async () => {
              const thumbnail = await createThumbnail({
                url: mediaUri(path),
                timeStamp: 0,
                maxWidth: 720,
                maxHeight: 720,
              });
              return OpenIMSDK.createVideoMessageFromFullPath({
                videoPath: path,
                videoType: asset.type || 'video/mp4',
                duration: Math.ceil(asset.duration || 0),
                snapshotPath: thumbnail.path.replace(/^file:\/\//, ''),
              });
            })()
          : await OpenIMSDK.createImageMessageFromFullPath(path);
      await sendMessage(draft);
    } catch {
      showToast(mediaType === 'video' ? '视频发送失败' : '图片发送失败');
    } finally {
      setSending(false);
    }
  };

  const handlePickedMedia = async (
    asset: Asset | undefined,
    errorMessage: string,
  ) => {
    if (!asset) {
      return;
    }
    try {
      await sendMediaAsset(asset);
    } catch {
      showToast(errorMessage);
    }
  };

  const pickMediaFromAlbum = async () => {
    setMediaPickerVisible(false);
    if (sending || !canSendMessage) {
      return;
    }
    await waitForModalDismiss();
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
      videoQuality: 'high',
      formatAsMp4: true,
    });
    if (result.didCancel) {
      return;
    }
    if (result.errorCode) {
      showToast('选择失败');
      return;
    }
    await handlePickedMedia(result.assets?.[0], '发送失败');
  };

  const takePhotoAndSend = async () => {
    setMediaPickerVisible(false);
    if (sending || !canSendMessage) {
      return;
    }
    await waitForModalDismiss();
    const result = await launchCamera({
      mediaType: 'photo',
      cameraType: 'back',
      saveToPhotos: false,
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 0.9,
    });
    if (result.didCancel) {
      return;
    }
    if (result.errorCode) {
      showToast(
        result.errorCode === 'permission' ? '未获得相机权限' : '拍照失败',
      );
      return;
    }
    await handlePickedMedia(result.assets?.[0], '图片发送失败');
  };

  const openMediaPicker = () => {
    if (sending || !canSendMessage) {
      return;
    }
    setMediaPickerVisible(true);
  };

  const getSound = async () => {
    if (soundRef.current) {
      return soundRef.current;
    }
    try {
      const { createSound } = await import('react-native-nitro-sound');
      const sound = createSound();
      soundRef.current = sound;
      return sound;
    } catch {
      showToast('语音模块未初始化，请重新编译安装 App');
      return undefined;
    }
  };

  const clearRecorderState = () => {
    soundRef.current?.removeRecordBackListener();
    recordingPath.current = '';
    recordStartedAt.current = 0;
    latestRecordMs.current = 0;
    setRecording(false);
    setRecordingSeconds(0);
  };

  const startRecording = async () => {
    if (sending || recording || !canSendMessage) {
      return;
    }
    try {
      const sound = await getSound();
      if (!sound) {
        return;
      }
      const permitted = await requestRecordPermission();
      if (!permitted) {
        showToast('未获得麦克风权限');
        return;
      }
      const path = `${RNFS.CachesDirectoryPath}/openim-voice-${Date.now()}.m4a`;
      recordingPath.current = path;
      recordStartedAt.current = Date.now();
      latestRecordMs.current = 0;
      setRecordingSeconds(0);
      setRecording(true);
      sound.removeRecordBackListener();
      sound.addRecordBackListener((event: RecordBackEvent) => {
        const current =
          Number(event.currentPosition || event.recordSecs || 0) || 0;
        latestRecordMs.current = current;
        setRecordingSeconds(Math.ceil(current / 1000));
      });
      await sound.startRecorder(path);
    } catch {
      clearRecorderState();
      showToast('录音失败');
    }
  };

  const stopRecording = async () => {
    const sound = await getSound();
    if (!sound) {
      throw new Error('Sound module unavailable');
    }
    const stoppedPath = await sound.stopRecorder();
    sound.removeRecordBackListener();
    setRecording(false);
    const durationMs =
      latestRecordMs.current ||
      Math.max(0, Date.now() - recordStartedAt.current);
    const path = recordingPath.current || stoppedPath.replace(/^file:\/\//, '');
    return {
      path: path.replace(/^file:\/\//, ''),
      duration: Math.max(1, Math.ceil(durationMs / 1000)),
    };
  };

  const cancelRecording = async () => {
    if (!recording) {
      return;
    }
    const path = recordingPath.current;
    try {
      await soundRef.current?.stopRecorder();
    } catch {
      // Recorder may already be stopped by the native layer.
    } finally {
      clearRecorderState();
    }
    if (path) {
      RNFS.unlink(path).catch(() => undefined);
    }
  };

  const sendVoice = async () => {
    if (!recording || sending || !canSendMessage) {
      return;
    }
    setSending(true);
    try {
      const { path, duration } = await stopRecording();
      clearRecorderState();
      if (!path) {
        showToast('语音文件生成失败');
        return;
      }
      const draft = await OpenIMSDK.createSoundMessageFromFullPath({
        soundPath: path,
        duration,
      });
      await sendMessage(draft);
    } catch {
      clearRecorderState();
      showToast('语音发送失败');
    } finally {
      setSending(false);
    }
  };

  const toggleVoiceMode = () => {
    if (recording || sending || !canSendMessage) {
      return;
    }
    setVoiceMode(current => !current);
  };

  const beginVoiceGesture = () => {
    if (sending || !canSendMessage) {
      return;
    }
    cancelVoiceBySlideRef.current = false;
    setCancelVoiceBySlide(false);
    startRecording();
  };

  const updateVoiceGesture = (dy: number) => {
    if (!recording && !recordingPath.current) {
      return;
    }
    const shouldCancel = dy < -70;
    if (shouldCancel !== cancelVoiceBySlideRef.current) {
      cancelVoiceBySlideRef.current = shouldCancel;
      setCancelVoiceBySlide(shouldCancel);
    }
  };

  const finishVoiceGesture = () => {
    if ((!recording && !recordingPath.current) || sending) {
      return;
    }
    const shouldCancel = cancelVoiceBySlideRef.current;
    cancelVoiceBySlideRef.current = false;
    setCancelVoiceBySlide(false);
    if (shouldCancel) {
      cancelRecording();
    } else {
      sendVoice();
    }
  };

  const voicePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => voiceMode && !sending && canSendMessage,
    onMoveShouldSetPanResponder: () => voiceMode,
    onPanResponderGrant: beginVoiceGesture,
    onPanResponderMove: (_, gestureState) => {
      updateVoiceGesture(gestureState.dy);
    },
    onPanResponderRelease: finishVoiceGesture,
    onPanResponderTerminate: cancelRecording,
  });

  const playSound = async (item: MessageItem) => {
    const uri = mediaUri(
      item.soundElem?.sourceUrl || item.soundElem?.soundPath,
    );
    if (!uri) {
      showToast('无法播放');
      return;
    }
    try {
      const sound = await getSound();
      if (!sound) {
        return;
      }
      if (playingSoundID === item.clientMsgID) {
        await sound.stopPlayer();
        sound.removePlayBackListener();
        sound.removePlaybackEndListener();
        setPlayingSoundID('');
        return;
      }
      await sound.stopPlayer().catch(() => undefined);
      sound.removePlayBackListener();
      sound.removePlaybackEndListener();
      setPlayingSoundID(item.clientMsgID);
      sound.addPlaybackEndListener(() => {
        sound.removePlayBackListener();
        sound.removePlaybackEndListener();
        setPlayingSoundID('');
      });
      await sound.startPlayer(uri);
    } catch {
      soundRef.current?.removePlayBackListener();
      soundRef.current?.removePlaybackEndListener();
      setPlayingSoundID('');
      showToast('播放失败');
    }
  };

  const openVideo = (item: MessageItem, thumbnail?: string) => {
    const uri = mediaUri(item.videoElem?.videoUrl || item.videoElem?.videoPath);
    if (!uri) {
      showToast('无法播放');
      return;
    }
    setPreviewVideo({ thumbnail, uri });
  };

  const confirmSaveMedia = async (
    uri: string,
    type: 'photo' | 'video',
    fallbackExtension: 'jpg' | 'mp4',
  ) => {
    setPendingSaveMedia({ fallbackExtension, type, uri });
  };

  const savePendingPreviewMedia = async () => {
    if (!pendingSaveMedia || savingPreviewMedia) {
      return;
    }
    const mediaType = pendingSaveMedia.type;
    setSavingPreviewMedia(true);
    try {
      await saveMediaToAlbum(
        pendingSaveMedia.uri,
        mediaType,
        pendingSaveMedia.fallbackExtension,
      );
      setPendingSaveMedia(undefined);
      if (mediaType === 'photo') {
        setPreviewImage('');
      } else {
        setPreviewVideo(undefined);
      }
    } finally {
      setSavingPreviewMedia(false);
    }
  };

  const closePreviewImage = () => {
    setPendingSaveMedia(undefined);
    setPreviewImage('');
  };

  const closePreviewVideo = () => {
    setPendingSaveMedia(undefined);
    setPreviewVideo(undefined);
  };

  const saveRemark = async () => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      const succeeded = await onSetRemark(remark.trim());
      if (succeeded) {
        setRemarkModalVisible(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const openRemarkModal = () => {
    if (saving || isGroupChat || !friend) {
      return;
    }
    setRemark(friend.remark || '');
    setRemarkModalVisible(true);
  };

  const closeRemarkModal = () => {
    if (!saving) {
      setRemarkModalVisible(false);
      setRemark(friend?.remark || '');
    }
  };

  const resetGroupInfoDraft = useCallback(() => {
    setGroupNameDraft('');
    setGroupAvatarDraftUri('');
    setGroupAvatarDraftPath('');
    setGroupAvatarDraftFileName('');
    setGroupAvatarDraftContentType('');
  }, []);

  const openGroupInfoModal = () => {
    if (saving || !canEditGroupInfo) {
      return;
    }
    setGroupNameDraft(currentGroup?.groupName || target.title);
    setGroupAvatarDraftUri(currentGroup?.faceURL || '');
    setGroupAvatarDraftPath('');
    setGroupAvatarDraftFileName('');
    setGroupAvatarDraftContentType('');
    setGroupInfoModalVisible(true);
  };

  const closeGroupInfoModal = () => {
    if (!saving) {
      setGroupInfoModalVisible(false);
      resetGroupInfoDraft();
    }
  };

  const selectGroupAvatar = async () => {
    if (saving || !canEditGroupInfo) {
      return;
    }
    const result = await launchImageLibrary(avatarPickerOptions);
    if (result.didCancel) {
      return;
    }
    if (result.errorCode) {
      showToast('选择群头像失败');
      return;
    }
    const asset = result.assets?.[0];
    if (!asset) {
      return;
    }
    try {
      const path = await localMediaPath(asset, 'openim-group-avatar', 'jpg');
      setGroupAvatarDraftPath(path);
      setGroupAvatarDraftUri(mediaUri(path));
      setGroupAvatarDraftFileName(
        asset.fileName || `group-avatar.${fileExtension(asset, 'jpg')}`,
      );
      setGroupAvatarDraftContentType(asset.type || 'image/jpeg');
    } catch {
      showToast('群头像读取失败');
    }
  };

  const saveGroupInfo = async () => {
    if (saving || !canEditGroupInfo) {
      return;
    }
    const groupName = groupNameDraft.trim();
    if (!groupName) {
      showToast('请输入群名称');
      return;
    }
    setSaving(true);
    try {
      let faceURL = currentGroup?.faceURL || '';
      if (groupAvatarDraftPath) {
        const uploaded = await OpenIMSDK.uploadFile({
          name: groupAvatarDraftFileName || `group-avatar-${Date.now()}.jpg`,
          contentType: groupAvatarDraftContentType || 'image/jpeg',
          uuid: `group-avatar-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`,
          cause: 'group-avatar',
          filepath: groupAvatarDraftPath,
        });
        faceURL = uploaded.url;
      }
      await OpenIMSDK.setGroupInfo({
        groupID: target.groupID,
        groupName,
        faceURL,
      });
      setGroupProfile(base => {
        const source = base || currentGroup;
        if (!source) {
          return base;
        }
        return {
          ...source,
          groupID: target.groupID,
          groupName,
          faceURL,
        };
      });
      setGroupInfoModalVisible(false);
      resetGroupInfoDraft();
      showToast('群资料已修改');
    } catch {
      showToast('群资料修改失败');
    } finally {
      setSaving(false);
    }
  };

  const addCurrentTargetFriend = async () => {
    if (saving || friend) {
      return;
    }
    setSaving(true);
    try {
      const succeeded = await onAddFriend(target.userID, target.title);
      if (succeeded) {
        setSettingsVisible(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const addSelectedMemberFriend = async () => {
    if (!selectedMember || saving || selectedMemberFriend) {
      return;
    }
    setSaving(true);
    try {
      const title = selectedMember.nickname || selectedMember.userID;
      const succeeded = await onAddFriend(selectedMember.userID, title);
      if (succeeded) {
        closeMemberDetails();
      }
    } finally {
      setSaving(false);
    }
  };

  const loadGroupMembers = useCallback(async () => {
    const [members, groups] = await Promise.all([
      OpenIMSDK.getGroupMemberList({
        groupID: target.groupID,
        filter: GroupMemberFilter.All,
        offset: 0,
        count: 200,
      }),
      OpenIMSDK.getSpecifiedGroupsInfo([target.groupID]),
    ]);
    setGroupMembers(members);
    if (groups[0]) {
      setGroupProfile(groups[0]);
    }
    setGroupMemberCount(groups[0]?.memberCount ?? members.length);
    return members;
  }, [target.groupID]);

  const loadGroupMemberPage = async (offset: number, reset = false) => {
    if (
      groupMembersPageLoading ||
      groupMembersPageLoadingMore ||
      (!reset && !groupMembersPageHasMore)
    ) {
      return;
    }
    reset
      ? setGroupMembersPageLoading(true)
      : setGroupMembersPageLoadingMore(true);
    try {
      const members = await OpenIMSDK.getGroupMemberList({
        groupID: target.groupID,
        filter: GroupMemberFilter.All,
        offset,
        count: GROUP_MEMBER_PAGE_SIZE,
      });
      setAllGroupMembers(current => {
        const source = reset ? members : [...current, ...members];
        return [
          ...new Map(source.map(member => [member.userID, member])).values(),
        ];
      });
      setGroupMembersPageHasMore(
        members.length === GROUP_MEMBER_PAGE_SIZE &&
          offset + members.length < groupMemberCount,
      );
    } catch {
      showToast('成员加载失败');
    } finally {
      setGroupMembersPageLoading(false);
      setGroupMembersPageLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!isGroupChat || !settingsVisible) {
      return;
    }
    const sameGroup = (member: GroupMemberItem) =>
      member.groupID === target.groupID;
    const upsertMember = (member: GroupMemberItem) => {
      if (!sameGroup(member)) {
        return;
      }
      setGroupMembers(current => {
        const exists = current.some(item => item.userID === member.userID);
        const next = exists
          ? current.map(item => (item.userID === member.userID ? member : item))
          : [...current, member];
        return next.slice(0, 200);
      });
      setAllGroupMembers(current => {
        if (!groupMembersPageVisible) {
          return current;
        }
        const exists = current.some(item => item.userID === member.userID);
        return exists
          ? current.map(item => (item.userID === member.userID ? member : item))
          : [...current, member];
      });
      setSelectedMember(current =>
        current?.userID === member.userID ? member : current,
      );
      loadGroupMembers().catch(() => undefined);
    };
    const removeMember = (member: GroupMemberItem) => {
      if (!sameGroup(member)) {
        return;
      }
      setGroupMembers(current =>
        current.filter(item => item.userID !== member.userID),
      );
      setAllGroupMembers(current =>
        current.filter(item => item.userID !== member.userID),
      );
      if (selectedMember?.userID === member.userID) {
        setMemberModalVisible(false);
      }
      loadGroupMembers().catch(() => undefined);
    };
    const groupUnavailable = (changedGroup: GroupItem) => {
      if (changedGroup.groupID === target.groupID) {
        setSettingsVisible(false);
        setGroupMembersPageVisible(false);
        setMemberModalVisible(false);
        showToast('群聊已变更');
      }
    };
    const groupInfoChanged = (changedGroup: GroupItem) => {
      if (changedGroup.groupID === target.groupID) {
        setGroupProfile(current => ({
          ...(current || group),
          ...changedGroup,
        }));
        setGroupMemberCount(changedGroup.memberCount || groupMemberCount);
      }
    };
    OpenIMSDK.on(OpenIMEvent.OnGroupMemberAdded, upsertMember);
    OpenIMSDK.on(OpenIMEvent.OnGroupMemberInfoChanged, upsertMember);
    OpenIMSDK.on(OpenIMEvent.OnGroupMemberDeleted, removeMember);
    OpenIMSDK.on(OpenIMEvent.OnGroupInfoChanged, groupInfoChanged);
    OpenIMSDK.on(OpenIMEvent.OnJoinedGroupDeleted, groupUnavailable);
    OpenIMSDK.on(OpenIMEvent.OnGroupDismissed, groupUnavailable);
    return () => {
      OpenIMSDK.off(OpenIMEvent.OnGroupMemberAdded, upsertMember);
      OpenIMSDK.off(OpenIMEvent.OnGroupMemberInfoChanged, upsertMember);
      OpenIMSDK.off(OpenIMEvent.OnGroupMemberDeleted, removeMember);
      OpenIMSDK.off(OpenIMEvent.OnGroupInfoChanged, groupInfoChanged);
      OpenIMSDK.off(OpenIMEvent.OnJoinedGroupDeleted, groupUnavailable);
      OpenIMSDK.off(OpenIMEvent.OnGroupDismissed, groupUnavailable);
    };
  }, [
    groupMemberCount,
    groupMembersPageVisible,
    group,
    isGroupChat,
    loadGroupMembers,
    selectedMember?.userID,
    settingsVisible,
    target.groupID,
  ]);

  const openSettings = async () => {
    setSettingsVisible(true);
    setSettingsLoading(true);
    try {
      if (isGroupChat) {
        setGroupMembers([]);
        await loadGroupMembers();
      } else {
        setUserInfo(undefined);
        const users = await OpenIMSDK.getUsersInfo([target.userID]);
        setUserInfo(users[0]);
      }
    } catch {
      // Render the profile data already available from the conversation.
    } finally {
      setSettingsLoading(false);
    }
  };

  const closeSettings = useCallback(() => {
    if (saving) {
      return;
    }
    setSettingsVisible(false);
    setGroupMembersPageVisible(false);
    setInviteVisible(false);
    setInviteClosing(false);
    setMemberModalVisible(false);
    setSelectedMember(undefined);
    setKickConfirmationVisible(false);
    setSelectedInviteUserIDs([]);
    setRemarkModalVisible(false);
    setGroupInfoModalVisible(false);
    resetGroupInfoDraft();
  }, [resetGroupInfoDraft, saving]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (previewImage) {
          if (pendingSaveMedia) {
            setPendingSaveMedia(undefined);
            return true;
          }
          closePreviewImage();
          return true;
        }
        if (previewVideo) {
          if (pendingSaveMedia) {
            setPendingSaveMedia(undefined);
            return true;
          }
          closePreviewVideo();
          return true;
        }
        if (mentionPickerVisible) {
          setMentionPickerVisible(false);
          return true;
        }
        if (mediaPickerVisible) {
          setMediaPickerVisible(false);
          return true;
        }
        if (remarkModalVisible) {
          setRemarkModalVisible(false);
          setRemark(friend?.remark || '');
          return true;
        }
        if (groupInfoModalVisible) {
          setGroupInfoModalVisible(false);
          resetGroupInfoDraft();
          return true;
        }
        if (groupMembersPageVisible) {
          setGroupMembersPageVisible(false);
          return true;
        }
        if (memberModalVisible) {
          setKickConfirmationVisible(false);
          setMemberModalVisible(false);
          return true;
        }
        if (inviteVisible) {
          setInviteVisible(false);
          setInviteClosing(false);
          setSelectedInviteUserIDs([]);
          return true;
        }
        if (settingsVisible) {
          closeSettings();
          return true;
        }
        onBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [
    closeSettings,
    friend?.remark,
    groupInfoModalVisible,
    groupMembersPageVisible,
    inviteVisible,
    memberModalVisible,
    mediaPickerVisible,
    mentionPickerVisible,
    onBack,
    pendingSaveMedia,
    previewImage,
    previewVideo,
    remarkModalVisible,
    resetGroupInfoDraft,
    settingsVisible,
  ]);

  const toggleInviteUser = (userID: string) => {
    setSelectedInviteUserIDs(current =>
      current.includes(userID)
        ? current.filter(item => item !== userID)
        : [...current, userID],
    );
  };

  const openInvite = () => {
    setVisibleInviteCandidates(inviteCandidates);
    setSelectedInviteUserIDs([]);
    setInviteClosing(false);
    setInviteVisible(true);
  };

  const closeInvite = () => {
    if (!saving) {
      setInviteVisible(false);
    }
  };

  const openMemberDetails = (member: GroupMemberItem) => {
    setSelectedMember(member);
    setKickConfirmationVisible(false);
    setMemberModalVisible(true);
  };

  const openMessageSenderDetails = (message: MessageItem) => {
    if (!isGroupChat || message.sendID === selfUserID) {
      return;
    }
    const member = groupMembers.find(item => item.userID === message.sendID);
    openMemberDetails(
      member ?? {
        ex: '',
        faceURL: message.senderFaceUrl || '',
        groupID: target.groupID,
        inviterUserID: '',
        joinSource: GroupJoinSource.Invitation,
        joinTime: 0,
        muteEndTime: 0,
        nickname: message.senderNickname || '群成员',
        operatorUserID: '',
        roleLevel: GroupMemberRole.Normal,
        userID: message.sendID,
      },
    );
  };

  const openAllGroupMembers = () => {
    setAllGroupMembers([]);
    setGroupMembersPageHasMore(true);
    setGroupMembersPageVisible(true);
    loadGroupMemberPage(0, true);
  };

  const closeMemberDetails = () => {
    if (saving) {
      return;
    }
    setKickConfirmationVisible(false);
    setMemberModalVisible(false);
  };

  const inviteGroupMembers = async () => {
    if (saving || selectedInviteUserIDs.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const succeeded = await onInviteGroupMembers(selectedInviteUserIDs);
      if (succeeded) {
        setInviteClosing(true);
        setInviteVisible(false);
        await loadGroupMembers();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedMemberRole = async () => {
    if (!selectedMember || saving || !canManageSelectedMemberRole) {
      return;
    }
    const member = selectedMember;
    const nextRole =
      member.roleLevel === GroupMemberRole.Admin
        ? GroupMemberRole.Normal
        : GroupMemberRole.Admin;
    setSaving(true);
    try {
      await OpenIMSDK.setGroupMemberInfo({
        groupID: target.groupID,
        userID: member.userID,
        roleLevel: nextRole,
      });
      const members = await loadGroupMembers();
      setSelectedMember(
        members.find(item => item.userID === member.userID) ?? {
          ...member,
          roleLevel: nextRole,
        },
      );
      setAllGroupMembers(current =>
        current.map(item =>
          item.userID === member.userID
            ? { ...item, roleLevel: nextRole }
            : item,
        ),
      );
      showToast(nextRole === GroupMemberRole.Admin ? '已设为管理员' : '已撤销');
    } catch {
      showToast('操作失败');
    } finally {
      setSaving(false);
    }
  };

  const kickSelectedMember = async () => {
    if (!selectedMember || saving || !canKickSelectedMember) {
      return;
    }
    const member = selectedMember;
    setSaving(true);
    try {
      await OpenIMSDK.kickGroupMember({
        groupID: target.groupID,
        reason: '由群管理员移出群聊',
        userIDList: [member.userID],
      });
      await loadGroupMembers();
      setAllGroupMembers(current =>
        current.filter(item => item.userID !== member.userID),
      );
      setKickConfirmationVisible(false);
      setMemberModalVisible(false);
      showToast('已移出');
    } catch {
      showToast('移出失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteFriend = async () => {
    if (saving) {
      return;
    }
    const confirmed = await showConfirm({
      title: '删除好友',
      message: `确定删除“${target.title}”吗？`,
      confirmText: '删除',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    setSaving(true);
    try {
      const succeeded = await onDeleteFriend();
      if (succeeded) {
        setSettingsVisible(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const quitGroup = async () => {
    if (saving) {
      return;
    }
    const confirmed = await showConfirm({
      title: isGroupOwner ? '解散群聊' : '退出群聊',
      message: isGroupOwner
        ? `你是群主，不能直接退出。确定解散群聊“${target.title}”吗？`
        : `确定退出群聊“${target.title}”吗？`,
      confirmText: isGroupOwner ? '解散' : '退出',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    setSaving(true);
    try {
      const succeeded = await onQuitGroup();
      if (succeeded) {
        setSettingsVisible(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.page}
    >
      <View style={styles.header}>
        <Pressable hitSlop={12} onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons
            color={colors.primary}
            name="chevron-left"
            size={34}
          />
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>
          {isGroupChat ? currentGroup?.groupName || target.title : target.title}
        </Text>
        <Pressable
          hitSlop={12}
          onPress={openSettings}
          style={styles.settingsButton}
        >
          <MaterialCommunityIcons
            color={colors.primary}
            name="dots-horizontal"
            size={26}
          />
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.messageList}
          data={displayedMessages}
          inverted
          keyExtractor={item => item.clientMsgID}
          key={target.conversationID}
          ListEmptyComponent={
            <View style={styles.emptyMessageList}>
              <EmptyState subtitle="发送第一条消息吧" title="开始聊天" />
            </View>
          }
          renderItem={({ item }) => {
            if (isSystemNotificationMessage(item)) {
              return (
                <View style={styles.notificationRow}>
                  <Text style={styles.notificationText}>
                    {messageText(item)}
                  </Text>
                  <Text style={styles.messageTime}>
                    {formatTime(item.sendTime)}
                  </Text>
                </View>
              );
            }

            const mine = item.sendID === selfUserID;
            const imageSource = mediaUri(
              item.pictureElem?.bigPicture?.url ||
                item.pictureElem?.sourcePicture?.url ||
                item.pictureElem?.snapshotPicture?.url ||
                item.pictureElem?.sourcePath,
            );
            const videoThumbnail = mediaUri(
              item.videoElem?.snapshotUrl || item.videoElem?.snapshotPath,
            );
            const hasMedia = Boolean(item.pictureElem || item.videoElem);
            const hasSound = Boolean(item.soundElem);
            const progress = messageProgress[item.clientMsgID];
            const sendingText =
              progress && progress < 100 ? `发送中 ${progress}%` : '发送中';
            const senderMember = groupMembers.find(
              member => member.userID === item.sendID,
            );
            const senderName =
              senderMember?.nickname || item.senderNickname || '用户';
            const senderFaceURL = senderMember?.faceURL || item.senderFaceUrl;
            return (
              <View
                style={[
                  styles.messageRow,
                  mine && styles.messageRowMine,
                  !mine && styles.messageRowOther,
                ]}
              >
                {!mine && (
                  <Pressable
                    disabled={!isGroupChat || !canSendMessage}
                    onLongPress={() => mentionMessageSender(item)}
                    onPress={() => openMessageSenderDetails(item)}
                    style={styles.messageAvatarButton}
                  >
                    <Avatar name={senderName} size={36} uri={senderFaceURL} />
                  </Pressable>
                )}
                <View
                  style={[
                    styles.messageContent,
                    mine && styles.messageContentMine,
                  ]}
                >
                  {!mine && <Text style={styles.senderName}>{senderName}</Text>}
                  <View
                    style={[
                      styles.messageBubble,
                      mine && styles.messageBubbleMine,
                      hasMedia && styles.mediaBubble,
                      hasSound && styles.soundBubble,
                    ]}
                  >
                    {item.pictureElem && imageSource ? (
                      <Pressable onPress={() => setPreviewImage(imageSource)}>
                        <CachedImage
                          resizeMode="cover"
                          style={styles.mediaImage}
                          uri={imageSource}
                        />
                      </Pressable>
                    ) : item.videoElem ? (
                      <Pressable
                        onPress={() => openVideo(item, videoThumbnail)}
                        style={styles.videoPreview}
                      >
                        {videoThumbnail ? (
                          <CachedImage
                            resizeMode="cover"
                            style={styles.mediaImage}
                            uri={videoThumbnail}
                          />
                        ) : (
                          <View style={styles.videoPlaceholder} />
                        )}
                        <View style={styles.playButton}>
                          <MaterialCommunityIcons
                            color="#FFFFFF"
                            name="play"
                            size={25}
                            style={styles.playIcon}
                          />
                        </View>
                      </Pressable>
                    ) : item.soundElem ? (
                      <Pressable
                        onPress={() => playSound(item)}
                        style={styles.soundContent}
                      >
                        <MaterialCommunityIcons
                          color={mine ? '#FFFFFF' : colors.primary}
                          name={
                            playingSoundID === item.clientMsgID
                              ? 'stop'
                              : 'play'
                          }
                          size={18}
                        />
                        <Text
                          style={[
                            styles.soundText,
                            mine && styles.soundTextMine,
                          ]}
                        >
                          语音 {voiceDurationText(item.soundElem.duration)}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable onLongPress={() => copyMessageText(item)}>
                        <Text
                          style={[
                            styles.messageText,
                            mine && styles.messageTextMine,
                          ]}
                        >
                          {messageText(item)}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.messageMeta}>
                    <Text style={styles.messageTime}>
                      {formatTime(item.sendTime)}
                    </Text>
                    {mine && item.status === MessageStatus.Sending && (
                      <Text style={styles.sendingStatus}>{sendingText}</Text>
                    )}
                    {mine && item.status === MessageStatus.Succeed && (
                      <Text style={styles.sentStatus}>已发送</Text>
                    )}
                    {mine && item.status === MessageStatus.Failed && (
                      <Pressable
                        disabled={sending}
                        onPress={() => retryMessage(item)}
                      >
                        <Text style={styles.failedStatus}>
                          发送失败，点击重试
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
                {mine && (
                  <View style={styles.messageAvatarButton}>
                    <Avatar name={senderName} size={36} uri={senderFaceURL} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        {voiceMode ? (
          <>
            <Pressable
              disabled={recording || sending || !canSendMessage}
              onPress={toggleVoiceMode}
              style={[
                styles.recordButton,
                (recording || sending || !canSendMessage) &&
                  styles.sendButtonDisabled,
              ]}
            >
              <MaterialCommunityIcons
                color={colors.primary}
                name="keyboard-outline"
                size={23}
              />
            </Pressable>
            <View
              {...voicePanResponder.panHandlers}
              style={[
                styles.voiceHoldButton,
                recording && styles.voiceHoldButtonActive,
                cancelVoiceBySlide && styles.voiceHoldButtonCancel,
                (sending || !canSendMessage) && styles.sendButtonDisabled,
              ]}
            >
              {sending ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text
                  style={[
                    styles.voiceHoldText,
                    cancelVoiceBySlide && styles.voiceHoldTextCancel,
                  ]}
                >
                  {recording
                    ? cancelVoiceBySlide
                      ? '松开取消'
                      : `松开发送 ${voiceDurationText(recordingSeconds)}`
                    : '按住说话'}
                </Text>
              )}
            </View>
            <Text style={styles.voiceHint}>
              {recording ? '上滑取消' : '按住录音'}
            </Text>
          </>
        ) : (
          <>
            <Pressable
              disabled={sending || !canSendMessage}
              onPress={toggleVoiceMode}
              style={[
                styles.recordButton,
                (sending || !canSendMessage) && styles.sendButtonDisabled,
              ]}
            >
              <MaterialCommunityIcons
                color={colors.primary}
                name="microphone-outline"
                size={23}
              />
            </Pressable>
            <TextInput
              blurOnSubmit={false}
              editable={canSendMessage}
              onChangeText={handleTextChange}
              onSubmitEditing={sendText}
              placeholder={canSendMessage ? '输入消息' : '你已不在该群聊中'}
              placeholderTextColor="#9AA4B4"
              returnKeyType="send"
              style={styles.composerInput}
              value={text}
            />
            <Pressable
              disabled={sending || !canSendMessage}
              onPress={openMediaPicker}
              style={[
                styles.mediaButton,
                styles.mediaButtonRight,
                (sending || !canSendMessage) && styles.sendButtonDisabled,
              ]}
            >
              <MaterialCommunityIcons color="#FFFFFF" name="plus" size={26} />
            </Pressable>
          </>
        )}
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setMediaPickerVisible(false)}
        transparent
        visible={mediaPickerVisible}
      >
        <Pressable
          onPress={() => setMediaPickerVisible(false)}
          style={styles.actionSheetBackdrop}
        >
          <Pressable style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>发送媒体</Text>
            <Pressable
              disabled={sending || !canSendMessage}
              onPress={takePhotoAndSend}
              style={styles.actionSheetItem}
            >
              <MaterialCommunityIcons
                color={colors.primary}
                name="camera-outline"
                size={24}
              />
              <Text style={styles.actionSheetItemText}>拍照</Text>
            </Pressable>
            <Pressable
              disabled={sending || !canSendMessage}
              onPress={pickMediaFromAlbum}
              style={styles.actionSheetItem}
            >
              <MaterialCommunityIcons
                color={colors.primary}
                name="image-multiple-outline"
                size={24}
              />
              <Text style={styles.actionSheetItemText}>从相册选择</Text>
            </Pressable>
            <Pressable
              onPress={() => setMediaPickerVisible(false)}
              style={styles.actionSheetCancel}
            >
              <Text style={styles.actionSheetCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closePreviewImage}
        transparent
        visible={Boolean(previewImage)}
      >
        <Pressable onPress={closePreviewImage} style={styles.previewBackdrop}>
          {previewImage ? (
            <Pressable
              onLongPress={() =>
                confirmSaveMedia(previewImage, 'photo', 'jpg')
              }
              onPress={closePreviewImage}
              style={styles.previewMediaTouchable}
            >
              <CachedImage
                resizeMode="contain"
                style={styles.previewImage}
                uri={previewImage}
              />
            </Pressable>
          ) : null}
          {pendingSaveMedia?.type === 'photo' ? (
            <Pressable style={styles.previewSaveSheet}>
              <Text style={styles.previewSaveTitle}>保存图片到相册？</Text>
              <View style={styles.previewSaveActions}>
                <Pressable
                  disabled={savingPreviewMedia}
                  onPress={() => setPendingSaveMedia(undefined)}
                  style={styles.previewSaveCancel}
                >
                  <Text style={styles.previewSaveCancelText}>取消</Text>
                </Pressable>
                <Pressable
                  disabled={savingPreviewMedia}
                  onPress={savePendingPreviewMedia}
                  style={styles.previewSaveConfirm}
                >
                  {savingPreviewMedia ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.previewSaveConfirmText}>保存</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closePreviewVideo}
        transparent
        visible={Boolean(previewVideo)}
      >
        <Pressable onPress={closePreviewVideo} style={styles.previewBackdrop}>
          {previewVideo ? (
            <Pressable
              onLongPress={() =>
                confirmSaveMedia(previewVideo.uri, 'video', 'mp4')
              }
              onPress={closePreviewVideo}
              style={styles.previewMediaTouchable}
            >
              {previewVideo.thumbnail ? (
                <CachedImage
                  resizeMode="contain"
                  style={styles.previewImage}
                  uri={previewVideo.thumbnail}
                />
              ) : (
                <View style={styles.previewVideoPlaceholder}>
                  <MaterialCommunityIcons
                    color="#FFFFFF"
                    name="video-outline"
                    size={54}
                  />
                </View>
              )}
              <Pressable
                hitSlop={12}
                onPress={() =>
                  Linking.openURL(previewVideo.uri).catch(() =>
                    showToast('无法播放'),
                  )
                }
                style={styles.previewPlayButton}
              >
                <MaterialCommunityIcons
                  color="#FFFFFF"
                  name="play"
                  size={38}
                  style={styles.playIcon}
                />
              </Pressable>
            </Pressable>
          ) : null}
          {pendingSaveMedia?.type === 'video' ? (
            <Pressable style={styles.previewSaveSheet}>
              <Text style={styles.previewSaveTitle}>保存视频到相册？</Text>
              <View style={styles.previewSaveActions}>
                <Pressable
                  disabled={savingPreviewMedia}
                  onPress={() => setPendingSaveMedia(undefined)}
                  style={styles.previewSaveCancel}
                >
                  <Text style={styles.previewSaveCancelText}>取消</Text>
                </Pressable>
                <Pressable
                  disabled={savingPreviewMedia}
                  onPress={savePendingPreviewMedia}
                  style={styles.previewSaveConfirm}
                >
                  {savingPreviewMedia ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.previewSaveConfirmText}>保存</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
      {settingsVisible && (
        <View style={styles.detailsPage}>
          <View style={styles.header}>
            <Pressable
              hitSlop={12}
              onPress={closeSettings}
              style={styles.backButton}
            >
              <MaterialCommunityIcons
                color={colors.primary}
                name="chevron-left"
                size={34}
              />
            </Pressable>
            <Text style={styles.title}>
              {isGroupChat ? '群聊信息' : '用户信息'}
            </Text>
            <View style={styles.headerPlaceholder} />
          </View>
          <ScrollView
            contentContainerStyle={styles.detailsContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileSummary}>
              <Avatar
                name={
                  isGroupChat
                    ? currentGroup?.groupName || target.title
                    : friend?.remark ||
                      friend?.nickname ||
                      userInfo?.nickname ||
                      target.title
                }
                size={64}
                uri={
                  isGroupChat
                    ? currentGroup?.faceURL
                    : friend?.faceURL || userInfo?.faceURL
                }
              />
              <View style={styles.profileDetails}>
                <View style={styles.profileNameRow}>
                  <Text numberOfLines={2} style={styles.profileName}>
                    {isGroupChat
                      ? currentGroup?.groupName || target.title
                      : friend?.remark ||
                        friend?.nickname ||
                        userInfo?.nickname ||
                        target.title}
                  </Text>
                  {isGroupChat && canEditGroupInfo ? (
                    <Pressable
                      disabled={saving}
                      hitSlop={8}
                      onPress={openGroupInfoModal}
                      style={styles.remarkEditButton}
                    >
                      <MaterialCommunityIcons
                        color={colors.primary}
                        name="pencil-outline"
                        size={18}
                      />
                    </Pressable>
                  ) : !isGroupChat && friend ? (
                    <Pressable
                      disabled={saving}
                      hitSlop={8}
                      onPress={openRemarkModal}
                      style={styles.remarkEditButton}
                    >
                      <MaterialCommunityIcons
                        color={colors.primary}
                        name="pencil-outline"
                        size={18}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {!isGroupChat && friend?.remark && friend.nickname ? (
                  <Text style={styles.profileID}>昵称：{friend.nickname}</Text>
                ) : null}
                {isGroupChat ? (
                  <Text style={styles.profileID}>
                    {groupMemberCount} 位成员
                  </Text>
                ) : (
                  <Text style={styles.relationshipText}>
                    {friend ? '已添加为好友' : '还不是好友'}
                  </Text>
                )}
              </View>
            </View>
            {settingsLoading && (
              <ActivityIndicator
                color={colors.primary}
                style={styles.settingsLoading}
              />
            )}
            {isGroupChat ? (
              <>
                {(currentGroup?.introduction || currentGroup?.notification) && (
                  <View style={styles.infoSection}>
                    <Text style={styles.sectionTitle}>群信息</Text>
                    {currentGroup.introduction ? (
                      <Text style={styles.infoText}>
                        简介：{currentGroup.introduction}
                      </Text>
                    ) : null}
                    {currentGroup.notification ? (
                      <Text style={styles.infoText}>
                        公告：{currentGroup.notification}
                      </Text>
                    ) : null}
                  </View>
                )}
                <View style={styles.infoSection}>
                  <View style={styles.sectionHeader}>
                    <Text
                      style={[styles.sectionTitle, styles.sectionHeaderTitle]}
                    >
                      群成员（{groupMemberCount}）
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={openAllGroupMembers}
                      style={styles.viewAllMembersButton}
                    >
                      <Text style={styles.viewAllMembersText}>查看全部</Text>
                      <MaterialCommunityIcons
                        color={colors.primary}
                        name="chevron-right"
                        size={18}
                      />
                    </Pressable>
                  </View>
                  {groupMembers.length > 0 || isGroupActive ? (
                    <View style={styles.groupMemberGrid}>
                      {previewGroupMembers.map(member => (
                        <Pressable
                          key={member.userID}
                          disabled={saving}
                          onPress={() => openMemberDetails(member)}
                          style={styles.memberCard}
                        >
                          <View style={styles.memberAvatar}>
                            <Avatar
                              name={member.nickname || '群成员'}
                              size={52}
                              uri={member.faceURL}
                            />
                            {member.roleLevel === GroupMemberRole.Owner ? (
                              <Text style={styles.memberRoleBadge}>群主</Text>
                            ) : member.roleLevel === GroupMemberRole.Admin ? (
                              <Text style={styles.memberRoleBadge}>管理</Text>
                            ) : null}
                          </View>
                          <Text numberOfLines={1} style={styles.memberCardName}>
                            {member.nickname || '群成员'}
                          </Text>
                        </Pressable>
                      ))}
                      {isGroupActive && (
                        <Pressable
                          disabled={saving}
                          onPress={openInvite}
                          style={styles.memberCard}
                        >
                          <View style={styles.addMemberButton}>
                            <MaterialCommunityIcons
                              color={colors.primary}
                              name="plus"
                              size={26}
                            />
                          </View>
                          <Text style={styles.memberCardName}>邀请好友</Text>
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    !settingsLoading && (
                      <Text style={styles.noFriends}>暂无群成员信息</Text>
                    )
                  )}
                </View>
                {!isGroupActive ? (
                  <View style={styles.inactiveGroupCard}>
                    <Text style={styles.inactiveGroupTitle}>
                      你已不在该群聊中
                    </Text>
                    <Text style={styles.inactiveGroupText}>
                      不能再邀请好友、退出或解散该群聊。你仍然可以查看本地历史消息。
                    </Text>
                  </View>
                ) : (
                  <>
                    <Pressable
                      disabled={saving}
                      onPress={quitGroup}
                      style={[
                        styles.dangerButton,
                        saving && styles.modalButtonDisabled,
                      ]}
                    >
                      <Text style={styles.dangerButtonText}>
                        {isGroupOwner ? '解散群聊' : '退出群聊'}
                      </Text>
                    </Pressable>
                  </>
                )}
              </>
            ) : friend ? (
              <>
                <Pressable
                  disabled={saving}
                  onPress={deleteFriend}
                  style={[
                    styles.dangerButton,
                    saving && styles.modalButtonDisabled,
                  ]}
                >
                  <Text style={styles.dangerButtonText}>删除好友</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                disabled={saving}
                onPress={addCurrentTargetFriend}
                style={[
                  styles.modalButton,
                  saving && styles.modalButtonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>添加好友</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        </View>
      )}
      <Modal
        animationType="fade"
        onRequestClose={closeRemarkModal}
        transparent
        visible={remarkModalVisible}
      >
        <Pressable onPress={closeRemarkModal} style={styles.remarkBackdrop}>
          <Pressable onPress={() => undefined} style={styles.remarkCard}>
            <View style={styles.remarkHeader}>
              <Text style={styles.remarkTitle}>修改备注</Text>
              <Pressable
                disabled={saving}
                hitSlop={8}
                onPress={closeRemarkModal}
                style={styles.remarkCloseButton}
              >
                <MaterialCommunityIcons
                  color={colors.muted}
                  name="close"
                  size={22}
                />
              </Pressable>
            </View>
            <TextInput
              autoCorrect={false}
              autoFocus
              editable={!saving}
              onChangeText={setRemark}
              placeholder={friend?.nickname || '输入好友备注'}
              placeholderTextColor="#A4ADBC"
              returnKeyType="done"
              style={styles.remarkInput}
              value={remark}
            />
            <View style={styles.remarkActions}>
              <Pressable
                disabled={saving}
                onPress={closeRemarkModal}
                style={styles.remarkCancelButton}
              >
                <Text style={styles.inviteCancelText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={saveRemark}
                style={[
                  styles.remarkConfirmButton,
                  saving && styles.modalButtonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>保存</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closeGroupInfoModal}
        transparent
        visible={groupInfoModalVisible}
      >
        <Pressable onPress={closeGroupInfoModal} style={styles.remarkBackdrop}>
          <Pressable onPress={() => undefined} style={styles.remarkCard}>
            <View style={styles.remarkHeader}>
              <Text style={styles.remarkTitle}>编辑群资料</Text>
              <Pressable
                disabled={saving}
                hitSlop={8}
                onPress={closeGroupInfoModal}
                style={styles.remarkCloseButton}
              >
                <MaterialCommunityIcons
                  color={colors.muted}
                  name="close"
                  size={22}
                />
              </Pressable>
            </View>
            <Pressable
              disabled={saving}
              onPress={selectGroupAvatar}
              style={styles.groupAvatarEditor}
            >
              <Avatar
                name={groupNameDraft || currentGroup?.groupName || target.title}
                size={78}
                uri={groupAvatarDraftUri}
              />
              <View style={styles.groupAvatarEditBadge}>
                <MaterialCommunityIcons
                  color="#FFFFFF"
                  name="camera-outline"
                  size={17}
                />
              </View>
            </Pressable>
            <TextInput
              autoCorrect={false}
              autoFocus
              editable={!saving}
              onChangeText={setGroupNameDraft}
              placeholder="输入群名称"
              placeholderTextColor="#A4ADBC"
              returnKeyType="done"
              style={styles.remarkInput}
              value={groupNameDraft}
            />
            <View style={styles.remarkActions}>
              <Pressable
                disabled={saving}
                onPress={closeGroupInfoModal}
                style={styles.remarkCancelButton}
              >
                <Text style={styles.inviteCancelText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={saveGroupInfo}
                style={[
                  styles.remarkConfirmButton,
                  saving && styles.modalButtonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>保存</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closeMentionPicker}
        transparent
        visible={mentionPickerVisible}
      >
        <Pressable onPress={closeMentionPicker} style={styles.inviteBackdrop}>
          <Pressable onPress={() => undefined} style={styles.inviteCard}>
            <View style={styles.inviteHeader}>
              <View style={styles.inviteHeaderText}>
                <Text style={styles.inviteTitle}>选择提醒的人</Text>
                <Text style={styles.inviteSubtitle}>
                  发送后对方会收到 @ 提醒
                </Text>
              </View>
              <Pressable
                disabled={mentionPickerLoading}
                hitSlop={8}
                onPress={closeMentionPicker}
                style={styles.remarkCloseButton}
              >
                <MaterialCommunityIcons
                  color={colors.muted}
                  name="close"
                  size={22}
                />
              </Pressable>
            </View>
            {mentionPickerLoading ? (
              <ActivityIndicator
                color={colors.primary}
                style={styles.mentionLoading}
              />
            ) : (
              <ScrollView
                contentContainerStyle={styles.inviteListContent}
                showsVerticalScrollIndicator={false}
                style={styles.inviteList}
              >
                {mentionCandidates.length > 0 ? (
                  mentionCandidates.map(member => (
                    <Pressable
                      key={member.userID}
                      onPress={() => selectMention(member)}
                      style={styles.inviteFriendRow}
                    >
                      <Avatar
                        name={member.nickname || '群成员'}
                        size={46}
                        uri={member.faceURL}
                      />
                      <View style={styles.inviteFriendDetails}>
                        <Text numberOfLines={1} style={styles.inviteFriendName}>
                          {member.nickname || '群成员'}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.noFriends}>暂无可提醒的群成员</Text>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {groupMembersPageVisible && (
        <View style={[styles.detailsPage, styles.groupMembersPage]}>
          <View style={styles.header}>
            <Pressable
              hitSlop={12}
              onPress={() => setGroupMembersPageVisible(false)}
              style={styles.backButton}
            >
              <MaterialCommunityIcons
                color={colors.primary}
                name="chevron-left"
                size={34}
              />
            </Pressable>
            <Text style={styles.title}>全部群成员（{groupMemberCount}）</Text>
            <View style={styles.headerPlaceholder} />
          </View>
          <FlatList
            contentContainerStyle={styles.allMembersList}
            data={allGroupMembers}
            keyExtractor={item => item.userID}
            ListEmptyComponent={
              groupMembersPageLoading ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.allMembersLoading}
                />
              ) : (
                <Text style={styles.noFriends}>暂无群成员信息</Text>
              )
            }
            ListFooterComponent={
              groupMembersPageLoadingMore ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={styles.allMembersFooter}
                />
              ) : null
            }
            onEndReached={() => loadGroupMemberPage(allGroupMembers.length)}
            onEndReachedThreshold={0.35}
            renderItem={({ item }) => (
              <Pressable
                disabled={saving}
                onPress={() => openMemberDetails(item)}
                style={styles.allMemberRow}
              >
                <Avatar
                  name={item.nickname || '群成员'}
                  size={48}
                  uri={item.faceURL}
                />
                <View style={styles.allMemberDetails}>
                  <Text numberOfLines={1} style={styles.allMemberName}>
                    {item.nickname || '群成员'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.allMemberRole,
                    item.roleLevel === GroupMemberRole.Owner &&
                      styles.allMemberRoleOwner,
                  ]}
                >
                  {groupMemberRoleText(item.roleLevel)}
                </Text>
              </Pressable>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
      <Modal
        animationType="fade"
        onRequestClose={closeMemberDetails}
        transparent
        visible={memberModalVisible}
      >
        <View style={styles.inviteBackdrop}>
          <Pressable
            accessibilityLabel="关闭成员信息"
            onPress={closeMemberDetails}
            style={styles.modalBackdropDismiss}
          />
          <Pressable onPress={() => undefined} style={styles.memberDetailCard}>
            {selectedMember && (
              <>
                <Avatar
                  name={selectedMember.nickname || '群成员'}
                  size={72}
                  uri={selectedMember.faceURL}
                />
                <Text numberOfLines={2} style={styles.memberDetailName}>
                  {selectedMember.nickname || '群成员'}
                </Text>
                <View style={styles.memberDetailRoleRow}>
                  <Text style={styles.memberDetailRoleLabel}>群内身份</Text>
                  <Text style={styles.memberDetailRoleValue}>
                    {groupMemberRoleText(selectedMember.roleLevel)}
                  </Text>
                </View>
                <View style={styles.memberDetailRoleRow}>
                  <Text style={styles.memberDetailRoleLabel}>好友关系</Text>
                  <Text style={styles.memberDetailRoleValue}>
                    {selectedMember.userID === selfUserID
                      ? '我自己'
                      : selectedMemberFriend
                        ? '已是好友'
                        : '未添加'}
                  </Text>
                </View>
                {canAddSelectedMember && (
                  <Pressable
                    disabled={saving || kickConfirmationVisible}
                    onPress={addSelectedMemberFriend}
                    style={[
                      styles.memberActionButton,
                      (saving || kickConfirmationVisible) &&
                        styles.modalButtonDisabled,
                    ]}
                  >
                    {saving && !kickConfirmationVisible ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalButtonText}>添加好友</Text>
                    )}
                  </Pressable>
                )}
                {canManageSelectedMemberRole && (
                  <Pressable
                    disabled={saving || kickConfirmationVisible}
                    onPress={updateSelectedMemberRole}
                    style={[
                      styles.memberActionButton,
                      (saving || kickConfirmationVisible) &&
                        styles.modalButtonDisabled,
                    ]}
                  >
                    {saving && !kickConfirmationVisible ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalButtonText}>
                        {selectedMember.roleLevel === GroupMemberRole.Admin
                          ? '撤销管理员'
                          : '设为管理员'}
                      </Text>
                    )}
                  </Pressable>
                )}
                {canKickSelectedMember && (
                  <Pressable
                    disabled={saving || kickConfirmationVisible}
                    onPress={() => setKickConfirmationVisible(true)}
                    style={[
                      styles.memberKickButton,
                      kickConfirmationVisible && styles.modalButtonDisabled,
                    ]}
                  >
                    <Text style={styles.dangerButtonText}>踢出群聊</Text>
                  </Pressable>
                )}
                <Pressable
                  disabled={saving || kickConfirmationVisible}
                  onPress={closeMemberDetails}
                  style={[
                    styles.memberCloseButton,
                    kickConfirmationVisible && styles.modalButtonDisabled,
                  ]}
                >
                  <Text style={styles.inviteCancelText}>关闭</Text>
                </Pressable>
                {kickConfirmationVisible && (
                  <Pressable
                    onPress={() => undefined}
                    style={styles.memberConfirmationOverlay}
                  >
                    <View style={styles.memberConfirmationCard}>
                      <Text style={styles.memberConfirmationTitle}>
                        移出群聊
                      </Text>
                      <Text style={styles.memberConfirmationText}>
                        确定将“
                        {selectedMember.nickname || '群成员'}
                        ”移出群聊吗？
                      </Text>
                      <View style={styles.memberConfirmationActions}>
                        <Pressable
                          disabled={saving}
                          onPress={() => setKickConfirmationVisible(false)}
                          style={styles.memberConfirmationCancel}
                        >
                          <Text style={styles.inviteCancelText}>取消</Text>
                        </Pressable>
                        <Pressable
                          disabled={saving}
                          onPress={kickSelectedMember}
                          style={[
                            styles.memberConfirmationConfirm,
                            saving && styles.modalButtonDisabled,
                          ]}
                        >
                          {saving ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                          ) : (
                            <Text style={styles.modalButtonText}>确认移出</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closeInvite}
        transparent
        visible={inviteVisible}
      >
        <Pressable onPress={closeInvite} style={styles.inviteBackdrop}>
          <Pressable onPress={() => undefined} style={styles.inviteCard}>
            <View style={styles.inviteHeader}>
              <View style={styles.inviteHeaderText}>
                <Text style={styles.inviteTitle}>邀请好友</Text>
                <Text style={styles.inviteSubtitle}>选择要加入群聊的好友</Text>
              </View>
              <View style={styles.inviteSelectedBadge}>
                <Text style={styles.inviteSelectedText}>
                  已选 {selectedInviteUserIDs.length}
                </Text>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={styles.inviteListContent}
              showsVerticalScrollIndicator={false}
              style={styles.inviteList}
            >
              {visibleInviteCandidates.length > 0 ? (
                visibleInviteCandidates.map(item => {
                  const selected = selectedInviteUserIDs.includes(item.userID);
                  return (
                    <Pressable
                      key={item.userID}
                      disabled={saving || inviteClosing}
                      onPress={() => toggleInviteUser(item.userID)}
                      style={[
                        styles.inviteFriendRow,
                        selected && styles.inviteFriendRowSelected,
                      ]}
                    >
                      <Avatar
                        name={item.remark || item.nickname || '用户'}
                        size={46}
                        uri={item.faceURL}
                      />
                      <View style={styles.inviteFriendDetails}>
                        <Text numberOfLines={1} style={styles.inviteFriendName}>
                          {item.remark || item.nickname || '用户'}
                        </Text>
                      </View>
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
                })
              ) : (
                <Text style={styles.noFriends}>暂无可邀请好友</Text>
              )}
            </ScrollView>
            <View style={styles.inviteActions}>
              <Pressable
                disabled={saving || inviteClosing}
                onPress={closeInvite}
                style={styles.inviteCancelButton}
              >
                <Text style={styles.inviteCancelText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={
                  saving || inviteClosing || selectedInviteUserIDs.length === 0
                }
                onPress={inviteGroupMembers}
                style={[
                  styles.inviteConfirmButton,
                  (saving ||
                    inviteClosing ||
                    selectedInviteUserIDs.length === 0) &&
                    styles.modalButtonDisabled,
                ]}
              >
                {saving || inviteClosing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>
                    邀请{selectedInviteUserIDs.length || ''}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: { width: 42, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  settingsButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPlaceholder: { width: 42 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: 16, flexGrow: 1 },
  emptyMessageList: {
    flex: 1,
    transform: [{ scaleY: -1 }],
  },
  notificationRow: {
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: 14,
    maxWidth: '86%',
  },
  notificationText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    maxWidth: '92%',
  },
  messageRowOther: { alignSelf: 'flex-start' },
  messageRowMine: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  messageAvatarButton: {
    width: 36,
    height: 36,
    marginTop: 2,
  },
  messageContent: {
    maxWidth: 246,
    marginLeft: 8,
    alignItems: 'flex-start',
  },
  messageContentMine: {
    marginLeft: 0,
    marginRight: 8,
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: 11,
    color: colors.muted,
    marginBottom: 4,
    marginLeft: 4,
  },
  messageBubble: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderTopLeftRadius: 5,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  messageBubbleMine: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 5,
  },
  mediaBubble: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
    backgroundColor: '#DDE3EC',
  },
  soundBubble: {
    minWidth: 128,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  soundContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  soundTextMine: { color: '#FFFFFF' },
  mediaImage: {
    width: 220,
    height: 165,
    backgroundColor: '#DDE3EC',
  },
  videoPreview: {
    width: 220,
    height: 165,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#2E3440',
  },
  playButton: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 3,
  },
  messageText: { fontSize: 15, lineHeight: 21, color: colors.text },
  messageTextMine: { color: '#FFFFFF' },
  messageTime: {
    fontSize: 9,
    color: '#A0A8B6',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginHorizontal: 4,
  },
  sendingStatus: { color: colors.muted, fontSize: 9 },
  sentStatus: { color: colors.success, fontSize: 9 },
  failedStatus: { color: '#E34D59', fontSize: 9, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  mediaButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  mediaButtonRight: {
    marginLeft: 8,
    marginRight: 0,
  },
  recordButton: {
    height: 42,
    minWidth: 52,
    borderRadius: 14,
    backgroundColor: '#EEF2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    paddingHorizontal: 12,
  },
  voiceHoldButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  voiceHoldButtonActive: {
    backgroundColor: '#E8F1FF',
  },
  voiceHoldButtonCancel: {
    backgroundColor: '#FDEBEE',
  },
  voiceHoldText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  voiceHoldTextCancel: {
    color: '#E34D59',
  },
  voiceHint: {
    width: 62,
    color: colors.muted,
    fontSize: 12,
    textAlign: 'right',
    marginLeft: 8,
    marginBottom: 12,
  },
  composerInput: {
    flex: 1,
    height: 42,
    borderRadius: 18,
    backgroundColor: colors.background,
    paddingHorizontal: 15,
    color: colors.text,
    fontSize: 15,
  },
  sendButtonDisabled: { backgroundColor: '#BCC6D6' },
  actionSheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(14, 22, 36, 0.38)',
  },
  actionSheet: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 22,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.card,
  },
  actionSheetTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  actionSheetItem: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionSheetItemText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  actionSheetCancel: {
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  actionSheetCancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMediaTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewVideoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlayButton: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSaveSheet: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 28,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    padding: 14,
  },
  previewSaveTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  previewSaveActions: {
    flexDirection: 'row',
    gap: 10,
  },
  previewSaveCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSaveConfirm: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewSaveCancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  previewSaveConfirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  detailsPage: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: colors.background,
  },
  groupMembersPage: {
    zIndex: 11,
  },
  detailsContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 32,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  profileDetails: {
    flex: 1,
    marginLeft: 14,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  profileName: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  remarkEditButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    backgroundColor: colors.primarySoft,
  },
  profileID: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  relationshipText: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 3,
  },
  settingsLoading: {
    marginBottom: 12,
  },
  mentionLoading: {
    marginVertical: 28,
  },
  infoSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    marginBottom: 0,
  },
  viewAllMembersButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  viewAllMembersText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  infoText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 5,
  },
  groupMemberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    rowGap: 14,
  },
  memberCard: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  allMembersList: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  allMemberRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 9,
  },
  allMemberDetails: {
    flex: 1,
    marginLeft: 12,
  },
  allMemberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  allMemberRole: {
    color: colors.muted,
    fontSize: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginLeft: 10,
    overflow: 'hidden',
  },
  allMemberRoleOwner: {
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    fontWeight: '700',
  },
  allMembersLoading: {
    marginTop: 50,
  },
  allMembersFooter: {
    marginVertical: 16,
  },
  memberAvatar: {
    position: 'relative',
  },
  memberRoleBadge: {
    position: 'absolute',
    right: -7,
    bottom: -3,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: colors.primary,
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  memberCardName: {
    width: '100%',
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 7,
  },
  addMemberButton: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#AEB9C9',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remarkInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: '#FAFBFD',
    fontSize: 15,
    marginBottom: 14,
  },
  groupAvatarEditor: {
    width: 86,
    height: 86,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  groupAvatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remarkBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(23, 32, 51, 0.45)',
  },
  remarkCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: colors.card,
    padding: 20,
  },
  remarkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  remarkTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  remarkCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remarkActions: {
    flexDirection: 'row',
    gap: 10,
  },
  remarkCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remarkConfirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: { opacity: 0.5 },
  modalButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalBackdropDismiss: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  memberDetailCard: {
    borderRadius: 20,
    backgroundColor: colors.card,
    padding: 22,
    alignItems: 'center',
  },
  memberDetailName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  memberDetailRoleRow: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: 18,
  },
  memberDetailRoleLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  memberDetailRoleValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  memberActionButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  memberKickButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF1F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  memberCloseButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  memberConfirmationText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  memberConfirmationOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(23, 32, 51, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  memberConfirmationCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: colors.card,
    padding: 18,
  },
  memberConfirmationTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  memberConfirmationActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  memberConfirmationCancel: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberConfirmationConfirm: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E5484D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(23, 32, 51, 0.45)',
  },
  inviteCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    backgroundColor: colors.card,
    padding: 20,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  inviteHeaderText: {
    flex: 1,
  },
  inviteTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  inviteSubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 5,
  },
  inviteSelectedBadge: {
    minWidth: 64,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginLeft: 12,
  },
  inviteSelectedText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  inviteList: {
    flexGrow: 0,
    maxHeight: 360,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  inviteListContent: {
    padding: 8,
  },
  inviteFriendRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 8,
  },
  inviteFriendRowSelected: {
    borderColor: '#B8CCF6',
    backgroundColor: colors.primarySoft,
  },
  inviteFriendDetails: {
    flex: 1,
    marginLeft: 12,
  },
  inviteFriendName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  inviteActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 10,
  },
  inviteCancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteCancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  inviteConfirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9C3D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  noFriends: {
    color: colors.muted,
    fontSize: 13,
    paddingVertical: 16,
    textAlign: 'center',
  },
  inactiveGroupCard: {
    borderRadius: 14,
    backgroundColor: colors.background,
    padding: 14,
  },
  inactiveGroupTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  inactiveGroupText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  dangerButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  dangerButtonText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
