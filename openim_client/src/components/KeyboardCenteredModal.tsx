import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Props = {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function KeyboardCenteredModal({ children, onPress, style }: Props) {
  const keyboardHeightRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [windowHeight, setWindowHeight] = useState(
    Dimensions.get('window').height,
  );

  const updateKeyboardHeight = useCallback(
    (event: KeyboardEvent) => {
      if (keyboardHeightRef.current > 0) {
        return;
      }

      const keyboardTop = event.endCoordinates.screenY;
      const nextKeyboardHeight = Math.max(windowHeight - keyboardTop, 0);

      keyboardHeightRef.current = nextKeyboardHeight;
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardHeight(nextKeyboardHeight);
    },
    [windowHeight],
  );

  const resetKeyboardHeight = useCallback((event: KeyboardEvent) => {
    if (keyboardHeightRef.current === 0) {
      return;
    }

    keyboardHeightRef.current = 0;
    Keyboard.scheduleLayoutAnimation(event);
    setKeyboardHeight(0);
  }, []);

  useEffect(() => {
    const dimensionSubscription = Dimensions.addEventListener(
      'change',
      ({ window }) => {
        setWindowHeight(window.height);
      },
    );
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      updateKeyboardHeight,
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      resetKeyboardHeight,
    );

    return () => {
      dimensionSubscription.remove();
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [resetKeyboardHeight, updateKeyboardHeight]);

  const centeredHeight = Math.max(windowHeight - keyboardHeight, 0);

  return (
    <Pressable onPress={onPress} style={[styles.backdrop, style]}>
      <View style={[styles.centerArea, { height: centeredHeight }]}>
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 32, 51, 0.45)',
  },
  centerArea: {
    width: '100%',
    justifyContent: 'center',
    padding: 24,
  },
});
