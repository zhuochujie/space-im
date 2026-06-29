import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors } from '../theme/colors';
import { createGroupInviteValue } from '../utils/groupInvite';

type Props = {
  groupID: string;
  groupName: string;
  onClose: () => void;
  visible: boolean;
};

export function GroupQrModal({ groupID, groupName, onClose, visible }: Props) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable onPress={() => undefined} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>群二维码</Text>
            <Pressable
              accessibilityLabel="关闭群二维码"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons
                color={colors.muted}
                name="close"
                size={22}
              />
            </Pressable>
          </View>
          <View style={styles.qrContainer}>
            <QRCode
              backgroundColor="#FFFFFF"
              color="#172033"
              size={220}
              value={createGroupInviteValue(groupID)}
            />
          </View>
          <Text numberOfLines={2} style={styles.groupName}>
            {groupName}
          </Text>
          <Text style={styles.hint}>使用 SPACE IM 扫码申请加入群聊</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(23, 32, 51, 0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    backgroundColor: colors.card,
  },
  header: {
    width: '100%',
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrContainer: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  groupName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
