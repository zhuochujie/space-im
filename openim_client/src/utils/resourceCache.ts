import { useEffect, useState } from 'react';
import RNFS from 'react-native-fs';

const cacheDir = `${RNFS.CachesDirectoryPath}/openim-resource-cache`;
const memoryCache = new Map<string, string>();
const pendingDownloads = new Map<string, Promise<string>>();

const isRemoteUri = (uri: string) =>
  uri.startsWith('http://') || uri.startsWith('https://');

const uriHash = (uri: string) => {
  let hash = 0;
  for (let index = 0; index < uri.length; index += 1) {
    hash = (hash * 31 + uri.charCodeAt(index)) % 2147483647;
  }
  return hash.toString(36);
};

const resourceExtension = (uri: string) => {
  const cleanUri = uri.split('?')[0];
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : 'jpg';
};

export const cacheResource = async (uri: string) => {
  const sourceUri = uri.trim();
  if (!sourceUri || !isRemoteUri(sourceUri)) {
    return sourceUri;
  }

  const cached = memoryCache.get(sourceUri);
  if (cached) {
    return cached;
  }

  const path = `${cacheDir}/${uriHash(sourceUri)}.${resourceExtension(
    sourceUri,
  )}`;
  const cachedUri = `file://${path}`;

  if (await RNFS.exists(path)) {
    memoryCache.set(sourceUri, cachedUri);
    return cachedUri;
  }

  const pending = pendingDownloads.get(sourceUri);
  if (pending) {
    return pending;
  }

  const download = (async () => {
    await RNFS.mkdir(cacheDir);
    const result = await RNFS.downloadFile({
      fromUrl: sourceUri,
      toFile: path,
    }).promise;
    if (result.statusCode && result.statusCode >= 400) {
      throw new Error(`Resource download failed: ${result.statusCode}`);
    }
    memoryCache.set(sourceUri, cachedUri);
    return cachedUri;
  })().finally(() => {
    pendingDownloads.delete(sourceUri);
  });

  pendingDownloads.set(sourceUri, download);
  return download;
};

export const useCachedResourceUri = (uri?: string) => {
  const sourceUri = uri?.trim() || '';
  const [cachedUri, setCachedUri] = useState(sourceUri);

  useEffect(() => {
    let cancelled = false;
    setCachedUri(sourceUri);
    cacheResource(sourceUri)
      .then(nextUri => {
        if (!cancelled) {
          setCachedUri(nextUri);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCachedUri(sourceUri);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sourceUri]);

  return cachedUri;
};
