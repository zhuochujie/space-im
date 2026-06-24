import { PermissionsAndroid, Platform } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import type { Asset, ImageLibraryOptions } from 'react-native-image-picker';

import { cacheResource } from './resourceCache';
import { showToast } from './toast';

export const avatarPickerOptions: ImageLibraryOptions = {
  mediaType: 'photo',
  selectionLimit: 1,
  maxWidth: 512,
  maxHeight: 512,
  quality: 0.8,
};

export const mediaUri = (value?: string) => {
  const uri = value?.trim();
  if (!uri) {
    return '';
  }
  if (
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('file://') ||
    uri.startsWith('content://')
  ) {
    return uri;
  }
  return `file://${uri}`;
};

export const fileExtension = (asset: Asset, fallback = 'tmp') => {
  const fileNameExtension = asset.fileName?.split('.').pop();
  if (fileNameExtension) {
    return fileNameExtension;
  }
  return asset.type?.split('/').pop() || fallback;
};

export const localMediaPath = async (
  asset: Asset,
  prefix = 'openim',
  fallbackExtension = 'tmp',
) => {
  const uri = asset.originalPath || asset.uri;
  if (!uri) {
    throw new Error('无法读取所选媒体文件');
  }
  if (uri.startsWith('content://')) {
    const destination = `${
      RNFS.CachesDirectoryPath
    }/${prefix}-${Date.now()}.${fileExtension(asset, fallbackExtension)}`;
    await RNFS.copyFile(uri, destination);
    return destination;
  }
  return decodeURI(uri.replace(/^file:\/\//, ''));
};

const cacheMediaExtension = (uri: string, fallback: string) => {
  const cleanUri = uri.split('?')[0];
  const extension = cleanUri.split('.').pop();
  return extension && extension.length <= 5 ? extension : fallback;
};

const cacheMediaForCameraRoll = async (
  uri: string,
  fallbackExtension: string,
) => {
  if (uri.startsWith('file://') || uri.startsWith('/')) {
    return uri;
  }
  if (uri.startsWith('content://')) {
    const destination = `${
      RNFS.CachesDirectoryPath
    }/openim-save-${Date.now()}.${fallbackExtension}`;
    await RNFS.copyFile(uri, destination);
    return `file://${destination}`;
  }
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return cacheResource(uri);
  }
  const extension = cacheMediaExtension(uri, fallbackExtension);
  const destination = `${
    RNFS.CachesDirectoryPath
  }/openim-save-${Date.now()}.${extension}`;
  const result = await RNFS.downloadFile({
    fromUrl: uri,
    toFile: destination,
  }).promise;
  if (result.statusCode && result.statusCode >= 400) {
    throw new Error('Media download failed');
  }
  return `file://${destination}`;
};

const requestSaveMediaPermission = async (type: 'photo' | 'video') => {
  if (Platform.OS !== 'android') {
    return true;
  }
  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10);
  if (apiLevel >= 33) {
    const permission =
      type === 'photo'
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO;
    const granted = await PermissionsAndroid.request(permission);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  if (apiLevel <= 28) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

export const saveMediaToAlbum = async (
  uri: string,
  type: 'photo' | 'video',
  fallbackExtension: string,
) => {
  if (!uri) {
    showToast('无法保存');
    return;
  }
  try {
    const permitted = await requestSaveMediaPermission(type);
    if (!permitted) {
      showToast('未获得相册权限');
      return;
    }
    const localUri = await cacheMediaForCameraRoll(uri, fallbackExtension);
    await CameraRoll.save(localUri, { type });
    showToast(type === 'photo' ? '图片已保存' : '视频已保存');
  } catch {
    showToast(type === 'photo' ? '图片保存失败' : '视频保存失败');
  }
};
