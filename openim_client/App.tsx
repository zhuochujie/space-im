import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  StatusBar,
  StyleSheet,
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
import { getErrorMessage } from './src/utils/errors';
import { showToast } from './src/utils/toast';

const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), ms);
  });

const phoneNumberValid = (phoneNumber: string) =>
  /^1[3-9]\d{9}$/.test(phoneNumber);

const passwordValid = (password: string) => password.length >= 6;

const loginErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);
  if (
    message.includes('Network request failed') ||
    message.includes('Failed to fetch')
  ) {
    return '无法连接服务器，请检查网络或服务地址';
  }
  if (message.includes('业务服务请求失败')) {
    return '登录服务暂时不可用，请稍后再试';
  }
  return message || '登录失败，请稍后再试';
};

function AppContent() {
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [profile, setProfile] = useState<SelfUserInfo>();
  const [connection, setConnection] = useState('未连接');
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
              nickname: session.phoneNumber,
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
    if (!credentials.phoneNumber || !credentials.password) {
      showToast('请输入账号和密码');
      return;
    }
    if (!phoneNumberValid(credentials.phoneNumber)) {
      showToast('请输入正确的手机号码');
      return;
    }
    if (!passwordValid(credentials.password)) {
      showToast('密码至少 6 位');
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
    } catch (error) {
      setConnection('连接失败');
      showToast(loginErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const register = async (credentials: AuthCredentials) => {
    if (!credentials.phoneNumber || !credentials.password) {
      showToast('请输入账号和密码');
      return;
    }
    if (!phoneNumberValid(credentials.phoneNumber)) {
      showToast('请输入正确的手机号码');
      return;
    }
    if (!passwordValid(credentials.password)) {
      showToast('密码至少 6 位');
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
    } catch (error) {
      setConnection('连接失败');
      showToast(loginErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

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
    const phoneNumber = sessionRef.current?.phoneNumber;
    if (!phoneNumber) {
      showToast('当前登录信息缺少手机号');
      return false;
    }
    if (!passwordValid(oldPassword) || !passwordValid(newPassword)) {
      showToast('密码至少 6 位');
      return false;
    }
    setBusy(true);
    try {
      await changeLoginPassword(
        DEFAULT_SERVER_CONFIG.chatServerAddr,
        phoneNumber,
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

  return (
    <MainScreen
      config={DEFAULT_SERVER_CONFIG}
      connection={connection}
      onChangePassword={changePassword}
      onChangeProfile={changeProfile}
      onLogout={logout}
      profile={profile}
      phoneNumber={sessionRef.current?.phoneNumber}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
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
