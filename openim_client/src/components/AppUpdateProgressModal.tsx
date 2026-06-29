import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import {
  setAppUpdateProgressListener,
  type AppUpdateProgressState,
} from '../services/appUpdate';
import { colors } from '../theme/colors';

export function AppUpdateProgressModal() {
  const [state, setState] = useState<AppUpdateProgressState>();

  useEffect(() => {
    setAppUpdateProgressListener(setState);
    return () => setAppUpdateProgressListener(undefined);
  }, []);

  const title =
    state?.stage === 'verifying'
      ? '正在校验安装包'
      : state?.stage === 'installing'
      ? '正在准备安装'
      : '正在下载更新';

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={Boolean(state)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            {state?.stage === 'downloading' ? null : (
              <ActivityIndicator color={colors.primary} size="small" />
            )}
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[styles.progress, { width: `${state?.percentage ?? 0}%` }]}
            />
          </View>
          <Text style={styles.percentage}>{state?.percentage ?? 0}%</Text>
          <Text style={styles.hint}>完成前请保持应用在前台</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(23, 32, 51, 0.58)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 22,
    backgroundColor: colors.card,
  },
  titleRow: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 22,
    backgroundColor: '#E3E8F0',
  },
  progress: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  percentage: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 7,
  },
});
