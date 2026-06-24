import React from 'react';
import { Image, type ImageProps } from 'react-native';

import { useCachedResourceUri } from '../utils/resourceCache';

type Props = Omit<ImageProps, 'source'> & {
  uri: string;
};

export function CachedImage({ uri, ...props }: Props) {
  const cachedUri = useCachedResourceUri(uri);
  if (!cachedUri) {
    return null;
  }
  return <Image {...props} source={{ uri: cachedUri }} />;
}
