import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormField } from '../components/FormField';
import { colors } from '../theme/colors';
import type { AuthCredentials } from '../types/app';
import { showToast } from '../utils/toast';

type Props = {
  busy: boolean;
  onLogin: (credentials: AuthCredentials) => Promise<void>;
  onRegister: (credentials: AuthCredentials) => Promise<void>;
};

const usernameValid = (username: string) =>
  username.length >= 6 && username.length <= 32;

const passwordValid = (password: string) => password.length >= 10;

export function LoginScreen({ busy, onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const actionText = mode === 'login' ? '登录' : '注册并登录';
  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setConfirmPassword('');
  };
  const submit = () => {
    const nextUsername = username.trim();
    if (!usernameValid(nextUsername)) {
      showToast('用户名需 6-32 位');
      return;
    }
    if (!passwordValid(password)) {
      showToast('密码至少 10 位');
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      showToast('两次密码不一致');
      return;
    }
    const credentials = {
      username: nextUsername,
      password,
    };
    return mode === 'login' ? onLogin(credentials) : onRegister(credentials);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <View style={styles.content}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>IM</Text>
        </View>
        <Text style={styles.title}>OpenIM</Text>
        <Text style={styles.subtitle}>连接你的私有即时通讯服务</Text>

        <View style={styles.card}>
          <View style={styles.segment}>
            <Pressable
              disabled={busy}
              onPress={() => switchMode('login')}
              style={[
                styles.segmentItem,
                mode === 'login' && styles.segmentActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'login' && styles.segmentActiveText,
                ]}
              >
                登录
              </Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => switchMode('register')}
              style={[
                styles.segmentItem,
                mode === 'register' && styles.segmentActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'register' && styles.segmentActiveText,
                ]}
              >
                注册
              </Text>
            </Pressable>
          </View>
          <FormField
            label="用户名"
            onChangeText={setUsername}
            placeholder="请输入用户名"
            value={username}
          />
          <FormField
            label="密码"
            onChangeText={setPassword}
            placeholder="请输入密码"
            secureTextEntry
            value={password}
          />
          {mode === 'register' && (
            <FormField
              label="确认密码"
              onChangeText={setConfirmPassword}
              placeholder="请再次输入密码"
              secureTextEntry
              value={confirmPassword}
            />
          )}
          <Pressable
            disabled={busy}
            onPress={submit}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              busy && styles.buttonDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{actionText}</Text>
            )}
          </Pressable>
        </View>
        <Text style={styles.hint}>
          账号由认证服务管理，登录后会自动获取 OpenIM 凭证。
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 28,
  },
  brandMark: {
    alignSelf: 'center',
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandMarkText: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 28,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 20,
    shadowColor: '#506080',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F8',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: colors.card,
  },
  segmentText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentActiveText: {
    color: colors.primary,
  },
  button: {
    height: 50,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  buttonPressed: { opacity: 0.78 },
  buttonDisabled: { opacity: 0.55 },
  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
  },
});
