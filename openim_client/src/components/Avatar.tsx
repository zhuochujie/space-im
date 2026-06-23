import React from 'react';
import {Image, type ImageStyle, StyleSheet, Text, View} from 'react-native';

import {colors} from '../theme/colors';

type Props = {
  name: string;
  uri?: string;
  size?: number;
};

export function Avatar({name, uri, size = 48}: Props) {
  const imageUri = uri?.trim();
  const dynamicStyle: ImageStyle = {
    width: size,
    height: size,
    borderRadius: size * 0.28,
  };
  if (imageUri) {
    return <Image source={{uri: imageUri}} style={[styles.image, dynamicStyle]} />;
  }
  return (
    <View style={[styles.fallback, dynamicStyle]}>
      <Text style={[styles.text, {fontSize: size * 0.38}]}>
        {(name || '?').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {backgroundColor: colors.primarySoft},
  fallback: {
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {color: colors.primary, fontWeight: '800'},
});
