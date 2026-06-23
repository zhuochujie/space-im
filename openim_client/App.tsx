import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import OpenIMSDK, {
  OpenIMEvent,
  LoginStatus,
  type SelfUserInfo,
} from '@openim/rn-client-sdk';
import RNFS from 'react-native-fs';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from './src/components/ToastHost';
import { DEFAULT_SERVER_CONFIG } from './src/config/openim';
import { LoginScreen } from './src/screens/LoginScreen';
import { MainScreen } from './src/screens/MainScreen';
import {
  changeLoginPassword,
  loginAccount,
  registerAccount,
} from './src/services/chatApi';
import {
  clearSession,
  loadSession,
  saveSession,
} from './src/services/sessionStorage';
import { colors } from './src/theme/colors';
import type { AuthCredentials, AuthSession } from './src/types/app';
import { showToast } from './src/utils/toast';

const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), ms);
  });

const usernameValid = (username: string) =>
  username.length >= 6 && username.length <= 32;

const passwordValid = (password: string) => password.length >= 10;

function AppContent() {
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<SelfUserInfo>();
  const [connection, setConnection] = useState('未连接');
  const [nicknameDraft, setNicknameDraft] = useState('');
  const sessionRef = useRef<AuthSession | undefined>(undefined);
  const initialized = useRef(false);
  const loginPromise = useRef<Promise<void> | undefined>(undefined);

  useEffect(() => {
    const connecting = () => setConnection('连接中');
    const connected = () => {
      setConnection('已连接');
      showToast('已连接');
    };
    const failed = () => {
      setConnection('连接失败');
      showToast('连接失败');
    };
    const offline = () => {
      clearSession().catch(() => undefined);
      setConnection('已下线');
      setLoggedIn(false);
      setProfile(undefined);
      sessionRef.current = undefined;
      showToast('已下线');
    };
    const selfInfoUpdated = (self: SelfUserInfo) => {
      setProfile(self);
    };

    OpenIMSDK.on(OpenIMEvent.OnConnecting, connecting);
    OpenIMSDK.on(OpenIMEvent.OnConnectSuccess, connected);
    OpenIMSDK.on(OpenIMEvent.OnConnectFailed, failed);
    OpenIMSDK.on(OpenIMEvent.OnKickedOffline, offline);
    OpenIMSDK.on(OpenIMEvent.OnUserTokenExpired, offline);
    OpenIMSDK.on(OpenIMEvent.OnUserTokenInvalid, offline);
    OpenIMSDK.on(OpenIMEvent.OnSelfInfoUpdated, selfInfoUpdated);

    const appStateSubscription = AppState.addEventListener('change', state => {
      if (initialized.current) {
        OpenIMSDK.setAppBackgroundStatus(state !== 'active').catch(
          () => undefined,
        );
      }
    });
    return () => {
      appStateSubscription.remove();
      OpenIMSDK.off(OpenIMEvent.OnConnecting, connecting);
      OpenIMSDK.off(OpenIMEvent.OnConnectSuccess, connected);
      OpenIMSDK.off(OpenIMEvent.OnConnectFailed, failed);
      OpenIMSDK.off(OpenIMEvent.OnKickedOffline, offline);
      OpenIMSDK.off(OpenIMEvent.OnUserTokenExpired, offline);
      OpenIMSDK.off(OpenIMEvent.OnUserTokenInvalid, offline);
      OpenIMSDK.off(OpenIMEvent.OnSelfInfoUpdated, selfInfoUpdated);
    };
  }, []);

  const ensureSDKInitialized = useCallback(async () => {
    if (initialized.current) {
      return;
    }
    const dataDir = `${RNFS.DocumentDirectoryPath}/openim`;
    await RNFS.mkdir(dataDir);
    await OpenIMSDK.initSDK({
      apiAddr: DEFAULT_SERVER_CONFIG.apiAddr,
      wsAddr: DEFAULT_SERVER_CONFIG.wsAddr,
      dataDir,
      logFilePath: dataDir,
      logLevel: 4,
      isLogStandardOutput: __DEV__,
    });
    initialized.current = true;
  }, []);

  const sdkLogin = useCallback(
    async (session: AuthSession) => {
      await ensureSDKInitialized();

      let status = await OpenIMSDK.getLoginStatus().catch(
        () => LoginStatus.Logout,
      );
      for (
        let index = 0;
        status === LoginStatus.Logging && index < 10;
        index++
      ) {
        await delay(300);
        status = await OpenIMSDK.getLoginStatus().catch(
          () => LoginStatus.Logout,
        );
      }
      if (status === LoginStatus.Logged) {
        const currentUserID = await OpenIMSDK.getLoginUserID().catch(() => '');
        if (currentUserID === session.userID) {
          return;
        }
        await OpenIMSDK.logout().catch(() => undefined);
      }

      await OpenIMSDK.login({
        userID: session.userID,
        token: session.token,
      });
    },
    [ensureSDKInitialized],
  );

  const loginWithSession = useCallback(
    async (session: AuthSession) => {
      if (loginPromise.current) {
        await loginPromise.current;
        if (sessionRef.current?.userID === session.userID) {
          return;
        }
      }

      const nextLogin = (async () => {
        await sdkLogin(session);
        const self = await OpenIMSDK.getSelfUserInfo();
        sessionRef.current = session;
        setProfile(self);
        setLoggedIn(true);
        setConnection('已连接');
      })();

      loginPromise.current = nextLogin;
      try {
        await nextLogin;
      } finally {
        if (loginPromise.current === nextLogin) {
          loginPromise.current = undefined;
        }
      }
    },
    [sdkLogin],
  );

  useEffect(() => {
    let active = true;
    loadSession()
      .then(async session => {
        if (!session || !active) {
          return;
        }
        try {
          await loginWithSession(session);
        } catch {
          if (active) {
            sessionRef.current = session;
            setProfile({
              createTime: 0,
              ex: '',
              faceURL: '',
              globalRecvMsgOpt: 0,
              nickname: session.username,
              userID: session.userID,
            });
            setLoggedIn(true);
            setConnection('连接失败');
          }
        }
      })
      .finally(() => {
        if (active) {
          setRestoring(false);
        }
      });
    return () => {
      active = false;
    };
  }, [loginWithSession]);

  const login = async (credentials: AuthCredentials) => {
    if (!credentials.username || !credentials.password) {
      showToast('请输入账号和密码');
      return;
    }
    if (!usernameValid(credentials.username)) {
      showToast('用户名需 6-32 位');
      return;
    }
    if (!passwordValid(credentials.password)) {
      showToast('密码至少 10 位');
      return;
    }
    setBusy(true);
    try {
      const session = await loginAccount(
        DEFAULT_SERVER_CONFIG.chatServerAddr,
        credentials,
      );
      await loginWithSession(session);
      await saveSession(session);
    } catch {
      setConnection('连接失败');
      showToast('登录失败');
    } finally {
      setBusy(false);
    }
  };

  const register = async (credentials: AuthCredentials) => {
    if (!credentials.username || !credentials.password) {
      showToast('请输入账号和密码');
      return;
    }
    if (!usernameValid(credentials.username)) {
      showToast('用户名需 6-32 位');
      return;
    }
    if (!passwordValid(credentials.password)) {
      showToast('密码至少 10 位');
      return;
    }
    setBusy(true);
    try {
      await registerAccount(DEFAULT_SERVER_CONFIG.chatServerAddr, credentials);
      const session = await loginAccount(
        DEFAULT_SERVER_CONFIG.chatServerAddr,
        credentials,
      );
      await loginWithSession(session);
      await saveSession(session);
    } catch {
      setConnection('连接失败');
      showToast('注册失败');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loggedIn && profile && !profile.nickname?.trim()) {
      setNicknameDraft('');
    }
  }, [loggedIn, profile]);

  const logout = async () => {
    setBusy(true);
    try {
      await OpenIMSDK.logout();
    } catch {
      // Return to login even if the server is unreachable.
    } finally {
      await clearSession();
      setLoggedIn(false);
      setProfile(undefined);
      sessionRef.current = undefined;
      setConnection('未连接');
      setBusy(false);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    const username = sessionRef.current?.username;
    if (!username) {
      showToast('当前登录信息缺少用户名');
      return false;
    }
    if (!passwordValid(oldPassword) || !passwordValid(newPassword)) {
      showToast('密码至少 10 位');
      return false;
    }
    setBusy(true);
    try {
      await changeLoginPassword(
        DEFAULT_SERVER_CONFIG.chatServerAddr,
        username,
        oldPassword,
        newPassword,
      );
      showToast('密码已修改');
      return true;
    } catch {
      showToast('密码修改失败');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeProfile = async ({
    avatarContentType,
    avatarFileName,
    avatarPath,
    nickname,
  }: {
    avatarContentType?: string;
    avatarFileName?: string;
    avatarPath?: string;
    nickname: string;
  }) => {
    const nextNickname = nickname.trim();
    if (!nextNickname) {
      showToast('请输入昵称');
      return false;
    }
    setBusy(true);
    try {
      let faceURL = profile?.faceURL;
      if (avatarPath) {
        const uploaded = await OpenIMSDK.uploadFile({
          name: avatarFileName || `avatar-${Date.now()}.jpg`,
          contentType: avatarContentType || 'image/jpeg',
          uuid: `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          cause: 'avatar',
          filepath: avatarPath,
        });
        faceURL = uploaded.url;
      }
      await OpenIMSDK.setSelfInfo({ nickname: nextNickname, faceURL });
      const self = await OpenIMSDK.getSelfUserInfo().catch(() => undefined);
      setProfile(current =>
        self ??
        (current
          ? { ...current, nickname: nextNickname, faceURL: faceURL || '' }
          : current),
      );
      showToast('资料已修改');
      return true;
    } catch {
      showToast('资料修改失败');
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (restoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!loggedIn) {
    return <LoginScreen busy={busy} onLogin={login} onRegister={register} />;
  }

  const nicknameRequired = loggedIn && Boolean(profile) && !profile?.nickname?.trim();

  return (
    <>
      <MainScreen
        config={DEFAULT_SERVER_CONFIG}
        connection={connection}
        onChangePassword={changePassword}
        onChangeProfile={changeProfile}
        onLogout={logout}
        profile={profile}
        username={sessionRef.current?.username}
      />
      <Modal animationType="fade" transparent visible={nicknameRequired}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>设置昵称</Text>
            <Text style={styles.modalBody}>请先设置你的聊天昵称</Text>
            <TextInput
              autoCorrect={false}
              autoFocus
              editable={!busy}
              onChangeText={setNicknameDraft}
              onSubmitEditing={() =>
                changeProfile({ nickname: nicknameDraft }).catch(
                  () => undefined,
                )
              }
              placeholder="输入昵称"
              placeholderTextColor="#A4ADBC"
              returnKeyType="done"
              style={styles.nicknameInput}
              value={nicknameDraft}
            />
            <Pressable
              disabled={busy}
              onPress={() =>
                changeProfile({ nickname: nicknameDraft }).catch(
                  () => undefined,
                )
              }
              style={[styles.confirmButton, busy && styles.buttonDisabled]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.confirmText}>保存</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 22,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalBody: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  nicknameInput: {
    height: 48,
    marginTop: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
  },
  confirmButton: {
    height: 46,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <AppContent />
      <ToastHost />
    </SafeAreaProvider>
  );
}
