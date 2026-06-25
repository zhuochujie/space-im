import { Alert, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { DEFAULT_SERVER_CONFIG } from '../config/openim';
import { getAndroidVersion, installAndroidApk } from '../native/SpaceAppUpdate';
import { showToast } from '../utils/toast';

type ApiResponse<T> = {
  code: number;
  data: T | null;
  message?: string;
};

export type AndroidUpdateInfo = {
  apkUrl: string;
  fileSize: number;
  forceUpdate: boolean;
  platform: 'android';
  releaseNotes: string;
  sha256: string;
  updatedAt?: string;
  versionCode: number;
  versionName: string;
};

let checking = false;

export async function checkAndroidUpdate(silent = true) {
  if (Platform.OS !== 'android' || checking) {
    return;
  }
  checking = true;
  try {
    const [current, latest] = await Promise.all([
      getAndroidVersion(),
      fetchLatestUpdate(),
    ]);
    if (!latest || latest.versionCode <= current.versionCode) {
      if (!silent) {
        showToast('当前已是最新版本');
      }
      return;
    }
    promptUpdate(latest);
  } catch {
    if (!silent) {
      showToast('检查更新失败');
    }
  } finally {
    checking = false;
  }
}

async function fetchLatestUpdate() {
  const base = DEFAULT_SERVER_CONFIG.chatServerAddr.replace(/\/$/, '');
  const response = await fetch(`${base}/app-update/android/latest`);
  const result = (await response.json()) as ApiResponse<AndroidUpdateInfo>;
  if (!response.ok || result.code !== 0) {
    throw new Error(result.message || '更新接口请求失败');
  }
  return result.data;
}

function promptUpdate(update: AndroidUpdateInfo) {
  const message = [
    `发现新版本 ${update.versionName}`,
    update.releaseNotes,
  ].filter(Boolean).join('\n\n');
  Alert.alert('版本更新', message, [
    ...(!update.forceUpdate
      ? [{ text: '稍后再说', style: 'cancel' as const }]
      : []),
    {
      text: '立即更新',
      onPress: () => void downloadAndInstall(update),
    },
  ], { cancelable: !update.forceUpdate });
}

async function downloadAndInstall(update: AndroidUpdateInfo) {
  try {
    showToast('开始下载安装包');
    const apkPath = `${RNFS.CachesDirectoryPath}/space-im-latest.apk`;
    const result = await RNFS.downloadFile({
      fromUrl: update.apkUrl,
      toFile: apkPath,
    }).promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`download failed: ${result.statusCode}`);
    }
    const sha256 = await RNFS.hash(apkPath, 'sha256');
    if (sha256 !== update.sha256) {
      throw new Error('sha256 mismatch');
    }
    showToast('下载完成，准备安装');
    await installAndroidApk(apkPath);
  } catch {
    showToast('更新安装失败');
  }
}
