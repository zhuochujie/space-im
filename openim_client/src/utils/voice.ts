import { PermissionsAndroid, Platform } from 'react-native';

export const voiceDurationText = (duration = 0) => {
  const seconds = Math.max(0, Math.ceil(duration));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
};

export const requestRecordPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: '麦克风权限',
      message: '发送语音消息需要使用麦克风',
      buttonNegative: '取消',
      buttonPositive: '允许',
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};
