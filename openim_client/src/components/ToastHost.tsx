import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import {
  setConfirmListener,
  setDismissConfirmListener,
  setToastListener,
} from '../utils/toast';

type ConfirmState = {
  id: string;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  resolve: (confirmed: boolean) => void;
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>();
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setToastListener(text => {
      setMessage(text);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setMessage(''), 2200);
    });
    setConfirmListener(nextConfirm => {
      setConfirm(current => {
        current?.resolve(false);
        return nextConfirm;
      });
      setConfirming(false);
    });
    setDismissConfirmListener(id => {
      setConfirm(current => {
        if (!current || (id && current.id !== id)) {
          return current;
        }
        current.resolve(false);
        return undefined;
      });
      setConfirming(false);
    });
    return () => {
      setToastListener(undefined);
      setConfirmListener(undefined);
      setDismissConfirmListener(undefined);
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const closeConfirm = (confirmed: boolean) => {
    if (!confirm || confirming) {
      return;
    }
    if (confirmed) {
      setConfirming(true);
    }
    confirm.resolve(confirmed);
    setConfirm(undefined);
    setConfirming(false);
  };

  return (
    <>
      {message ? (
        <View
          pointerEvents="none"
          style={[styles.toastWrap, { bottom: insets.bottom + 24 }]}
        >
          <View style={styles.toast}>
            <Text style={styles.toastText}>{message}</Text>
          </View>
        </View>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={() => closeConfirm(false)}
        transparent
        visible={Boolean(confirm)}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{confirm?.title}</Text>
            <Text style={styles.body}>{confirm?.message}</Text>
            <View style={styles.actions}>
              <Pressable
                disabled={confirming}
                onPress={() => closeConfirm(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>{confirm?.cancelText}</Text>
              </Pressable>
              <Pressable
                disabled={confirming}
                onPress={() => closeConfirm(true)}
                style={[
                  styles.confirmButton,
                  confirm?.destructive && styles.destructiveButton,
                ]}
              >
                {confirming ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmText}>{confirm?.confirmText}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '100%',
    borderRadius: 14,
    backgroundColor: 'rgba(23, 32, 51, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(23, 32, 51, 0.45)',
  },
  card: {
    borderRadius: 20,
    backgroundColor: colors.card,
    padding: 20,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destructiveButton: {
    backgroundColor: '#E5484D',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
