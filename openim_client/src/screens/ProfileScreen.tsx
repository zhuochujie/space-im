import React, { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { SelfUserInfo } from '@openim/rn-client-sdk';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';

import { Avatar } from '../components/Avatar';
import { KeyboardCenteredModal } from '../components/KeyboardCenteredModal';
import { colors } from '../theme/colors';
import {
  avatarPickerOptions,
  fileExtension,
  localMediaPath,
  mediaUri,
} from '../utils/media';
import { showToast } from '../utils/toast';

type Props = {
  profile?: SelfUserInfo;
  phoneNumber?: string;
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
  onCheckUpdate: () => void;
  onLogout: () => void;
};

export function ProfileScreen({
  profile,
  phoneNumber,
  onChangePassword,
  onChangeProfile,
  onCheckUpdate,
  onLogout,
}: Props) {
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState(profile?.nickname || '');
  const [avatarDraftUri, setAvatarDraftUri] = useState(profile?.faceURL || '');
  const [avatarDraftPath, setAvatarDraftPath] = useState('');
  const [avatarDraftFileName, setAvatarDraftFileName] = useState('');
  const [avatarDraftContentType, setAvatarDraftContentType] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const closePasswordModal = () => {
    if (saving) {
      return;
    }
    setPasswordModalVisible(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const openProfileModal = () => {
    if (saving) {
      return;
    }
    setNicknameDraft(profile?.nickname || '');
    setAvatarDraftUri(profile?.faceURL || '');
    setAvatarDraftPath('');
    setAvatarDraftFileName('');
    setAvatarDraftContentType('');
    setProfileModalVisible(true);
  };

  const closeProfileModal = () => {
    if (!saving) {
      setProfileModalVisible(false);
      setNicknameDraft(profile?.nickname || '');
      setAvatarDraftUri(profile?.faceURL || '');
      setAvatarDraftPath('');
      setAvatarDraftFileName('');
      setAvatarDraftContentType('');
    }
  };

  const selectAvatar = async () => {
    if (saving) {
      return;
    }
    const result = await launchImageLibrary(avatarPickerOptions);
    if (result.didCancel) {
      return;
    }
    if (result.errorCode) {
      showToast('选择头像失败');
      return;
    }
    const asset = result.assets?.[0];
    if (!asset) {
      return;
    }
    try {
      const path = await localMediaPath(asset, 'openim-avatar', 'jpg');
      setAvatarDraftPath(path);
      setAvatarDraftUri(mediaUri(path));
      setAvatarDraftFileName(
        asset.fileName || `avatar.${fileExtension(asset, 'jpg')}`,
      );
      setAvatarDraftContentType(asset.type || 'image/jpeg');
    } catch {
      showToast('头像读取失败');
    }
  };

  const submitProfile = async () => {
    if (saving) {
      return;
    }
    Keyboard.dismiss();
    const nextNickname = nicknameDraft.trim();
    if (!nextNickname) {
      showToast('请输入昵称');
      return;
    }
    setSaving(true);
    try {
      const succeeded = await onChangeProfile({
        avatarContentType: avatarDraftContentType || undefined,
        avatarFileName: avatarDraftFileName || undefined,
        avatarPath: avatarDraftPath || undefined,
        nickname: nextNickname,
      });
      if (succeeded) {
        setProfileModalVisible(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async () => {
    if (saving) {
      return;
    }
    Keyboard.dismiss();
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('请填写完整密码');
      return;
    }
    if (newPassword.length < 6) {
      showToast('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('两次新密码不一致');
      return;
    }
    setSaving(true);
    try {
      const succeeded = await onChangePassword(oldPassword, newPassword);
      if (succeeded) {
        closePasswordModal();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.profileCard}>
        <Avatar
          name={profile?.nickname || phoneNumber || '?'}
          size={72}
          uri={profile?.faceURL}
        />
        <View style={styles.identity}>
          <Text numberOfLines={1} style={styles.name}>
            {profile?.nickname || phoneNumber || '未设置昵称'}
          </Text>
          {phoneNumber ? (
            <Text style={styles.phoneNumber}>手机号: {phoneNumber}</Text>
          ) : null}
        </View>
        <Pressable
          disabled={saving}
          hitSlop={8}
          onPress={openProfileModal}
          style={styles.profileEditButton}
        >
          <MaterialCommunityIcons
            color={colors.primary}
            name="account-edit-outline"
            size={23}
          />
        </Pressable>
      </View>
      <View style={styles.settingsCard}>
        <Pressable
          onPress={() => setPasswordModalVisible(true)}
          style={({ pressed }) => [
            styles.settingRow,
            pressed && styles.buttonPressed,
          ]}
        >
          <View style={styles.settingIcon}>
            <MaterialCommunityIcons
              color={colors.primary}
              name="lock-reset"
              size={22}
            />
          </View>
          <Text style={styles.settingLabel}>修改登录密码</Text>
          <MaterialCommunityIcons
            color={colors.muted}
            name="chevron-right"
            size={22}
          />
        </Pressable>
        {Platform.OS === 'android' ? (
          <Pressable
            onPress={onCheckUpdate}
            style={({ pressed }) => [
              styles.settingRow,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.settingIcon}>
              <MaterialCommunityIcons
                color={colors.primary}
                name="cellphone-arrow-down"
                size={22}
              />
            </View>
            <Text style={styles.settingLabel}>检查更新</Text>
            <MaterialCommunityIcons
              color={colors.muted}
              name="chevron-right"
              size={22}
            />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.logoutText}>退出登录</Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={closeProfileModal}
        transparent
        visible={profileModalVisible}
      >
        <KeyboardCenteredModal
          onPress={closeProfileModal}
          style={styles.modalBackdrop}
        >
          <Pressable onPress={() => undefined} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>编辑资料</Text>
              <Pressable
                disabled={saving}
                hitSlop={8}
                onPress={closeProfileModal}
                style={styles.modalCloseButton}
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
              onPress={selectAvatar}
              style={styles.avatarEditor}
            >
              <Avatar
                name={nicknameDraft || profile?.nickname || phoneNumber || '?'}
                size={78}
                uri={avatarDraftUri}
              />
              <View style={styles.avatarEditBadge}>
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
              onChangeText={setNicknameDraft}
              onSubmitEditing={submitProfile}
              placeholder="输入昵称"
              placeholderTextColor="#A4ADBC"
              returnKeyType="done"
              style={styles.passwordInput}
              value={nicknameDraft}
            />
            <View style={styles.modalActions}>
              <Pressable
                disabled={saving}
                onPress={closeProfileModal}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={submitProfile}
                style={[styles.confirmButton, saving && styles.buttonDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmText}>保存</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardCenteredModal>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closePasswordModal}
        transparent
        visible={passwordModalVisible}
      >
        <KeyboardCenteredModal
          onPress={closePasswordModal}
          style={styles.modalBackdrop}
        >
          <Pressable onPress={() => undefined} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>修改登录密码</Text>
              <Pressable
                disabled={saving}
                hitSlop={8}
                onPress={closePasswordModal}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  color={colors.muted}
                  name="close"
                  size={22}
                />
              </Pressable>
            </View>
            <TextInput
              autoCapitalize="none"
              editable={!saving}
              onChangeText={setOldPassword}
              placeholder="当前密码"
              placeholderTextColor="#A4ADBC"
              secureTextEntry
              style={styles.passwordInput}
              value={oldPassword}
            />
            <TextInput
              autoCapitalize="none"
              editable={!saving}
              onChangeText={setNewPassword}
              placeholder="新密码"
              placeholderTextColor="#A4ADBC"
              secureTextEntry
              style={styles.passwordInput}
              value={newPassword}
            />
            <TextInput
              autoCapitalize="none"
              editable={!saving}
              onChangeText={setConfirmPassword}
              onSubmitEditing={submitPassword}
              placeholder="确认新密码"
              placeholderTextColor="#A4ADBC"
              returnKeyType="done"
              secureTextEntry
              style={styles.passwordInput}
              value={confirmPassword}
            />
            <View style={styles.modalActions}>
              <Pressable
                disabled={saving}
                onPress={closePasswordModal}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={submitPassword}
                style={[styles.confirmButton, saving && styles.buttonDisabled]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmText}>保存</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardCenteredModal>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 18 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 18,
    marginBottom: 16,
  },
  identity: { marginLeft: 16, flex: 1 },
  name: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.text,
  },
  profileEditButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneNumber: { fontSize: 13, color: colors.muted, marginTop: 6 },
  settingsCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingHorizontal: 18,
  },
  settingRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  logoutButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  logoutText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 32, 51, 0.45)',
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: colors.card,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditor: {
    alignSelf: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: '#FAFBFD',
    fontSize: 15,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.78 },
});
