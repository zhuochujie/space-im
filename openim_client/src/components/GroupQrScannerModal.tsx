import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { showToast } from '../utils/toast';

type Props = {
  onClose: () => void;
  onDismiss?: () => void;
  onScanned: (value: string) => boolean;
  visible: boolean;
};

export function GroupQrScannerModal({
  onClose,
  onDismiss,
  onScanned,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [cameraReady, setCameraReady] = useState(Platform.OS === 'ios');
  const scanned = useRef(false);
  const scanFrameSize = Math.max(
    160,
    Math.min(280, width - 48, height - insets.top - insets.bottom - 220),
  );

  useEffect(() => {
    if (!visible) {
      scanned.current = false;
      return;
    }
    if (Platform.OS === 'ios') {
      setCameraReady(true);
      return;
    }

    setCameraReady(false);
    PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA).then(
      result => {
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          setCameraReady(true);
          return;
        }
        showToast('需要相机权限才能扫码');
        onClose();
      },
      () => {
        showToast('相机权限申请失败');
        onClose();
      },
    );
  }, [onClose, visible]);

  const handleScanned = (value: string) => {
    if (scanned.current) {
      return;
    }
    scanned.current = onScanned(value);
  };

  const handleCameraError = () => {
    showToast('相机启动失败');
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      onDismiss={onDismiss}
      onRequestClose={onClose}
      statusBarTranslucent
      visible={visible}
    >
      <View style={styles.page}>
        {cameraReady ? (
          <Camera
            allowedBarcodeTypes={['qr']}
            barcodeFrameSize={{
              width: scanFrameSize,
              height: scanFrameSize,
            }}
            cameraType={CameraType.Back}
            frameColor={colors.primary}
            laserColor={colors.primary}
            onError={handleCameraError}
            onReadCode={event =>
              handleScanned(event.nativeEvent.codeStringValue)
            }
            scanBarcode
            scanThrottleDelay={800}
            showFrame
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <ActivityIndicator color="#FFFFFF" size="large" />
        )}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityLabel="关闭扫码"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons color="#FFFFFF" name="close" size={28} />
          </Pressable>
          <Text style={styles.title}>扫描群二维码</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.hintWrap, { paddingBottom: insets.bottom + 28 }]}
        >
          <Text style={styles.hint}>将二维码放入取景框内</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#080B10',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(8, 11, 16, 0.58)',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 24,
    backgroundColor: 'rgba(8, 11, 16, 0.58)',
  },
  hint: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
