import { NativeModules, Platform } from 'react-native';

type NativeVersion = {
  versionCode: number;
  versionName: string;
};

type SpaceAppUpdateNative = {
  getVersion: () => Promise<NativeVersion>;
  installApk: (path: string) => Promise<boolean>;
};

const IOS_VERSION: NativeVersion = {
  versionCode: 7,
  versionName: '1.1.5',
};

const nativeModule = NativeModules.SpaceAppUpdate as
  | SpaceAppUpdateNative
  | undefined;

export async function getAndroidVersion() {
  if (Platform.OS !== 'android' || !nativeModule) {
    return { versionCode: 0, versionName: '' };
  }
  return nativeModule.getVersion();
}

export async function getAppVersion() {
  if (Platform.OS === 'android' && nativeModule) {
    return nativeModule.getVersion();
  }
  return IOS_VERSION;
}

export async function installAndroidApk(path: string) {
  if (Platform.OS !== 'android' || !nativeModule) {
    return false;
  }
  return nativeModule.installApk(path);
}
