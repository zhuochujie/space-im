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

export type AppUpdateProgressState = {
  percentage: number;
  stage: 'downloading' | 'verifying' | 'installing';
};

type ProgressListener = (state?: AppUpdateProgressState) => void;

let checking = false;
let progressListener: ProgressListener | undefined;

export function setAppUpdateProgressListener(listener?: ProgressListener) {
  progressListener = listener;
}

function publishProgress(state?: AppUpdateProgressState) {
  progressListener?.(state);
}

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
  const message = [`发现新版本 ${update.versionName}`, update.releaseNotes]
    .filter(Boolean)
    .join('\n\n');
  Alert.alert(
    '版本更新',
    message,
    [
      ...(!update.forceUpdate
        ? [{ text: '稍后再说', style: 'cancel' as const }]
        : []),
      {
        text: '立即更新',
        onPress: () => downloadAndInstall(update).catch(() => undefined),
      },
    ],
    { cancelable: !update.forceUpdate },
  );
}

async function downloadAndInstall(update: AndroidUpdateInfo) {
  try {
    publishProgress({ stage: 'downloading', percentage: 0 });
    const apkPath = `${RNFS.CachesDirectoryPath}/space-im-latest.apk`;
    const result = await RNFS.downloadFile({
      fromUrl: update.apkUrl,
      toFile: apkPath,
      progressInterval: 200,
      progress: ({ bytesWritten, contentLength }) => {
        const total = contentLength > 0 ? contentLength : update.fileSize;
        if (total > 0) {
          publishProgress({
            stage: 'downloading',
            percentage: Math.min(100, Math.round((bytesWritten / total) * 100)),
          });
        }
      },
    }).promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`download failed: ${result.statusCode}`);
    }
    publishProgress({ stage: 'verifying', percentage: 100 });
    const sha256 = await RNFS.hash(apkPath, 'sha256');
    if (sha256 !== update.sha256) {
      throw new Error('sha256 mismatch');
    }
    publishProgress({ stage: 'installing', percentage: 100 });
    await installAndroidApk(apkPath);
  } catch {
    showToast('更新安装失败');
  } finally {
    publishProgress(undefined);
  }
}
