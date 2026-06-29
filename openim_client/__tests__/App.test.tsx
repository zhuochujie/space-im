/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@openim/rn-client-sdk', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    off: jest.fn(),
    getSelfUserInfo: jest.fn(() => Promise.resolve(undefined)),
    setAppBackgroundStatus: jest.fn(() => Promise.resolve()),
    setSelfInfo: jest.fn(() => Promise.resolve()),
    setGroupInfo: jest.fn(() => Promise.resolve()),
    resetConversationGroupAtType: jest.fn(() => Promise.resolve()),
    createTextAtMessage: jest.fn(() => Promise.resolve({})),
    uploadFile: jest.fn(() =>
      Promise.resolve({ url: 'https://example.test/avatar.jpg' }),
    ),
  },
  OpenIMEvent: {
    OnConnecting: 'onConnecting',
    OnConnectSuccess: 'onConnectSuccess',
    OnConnectFailed: 'onConnectFailed',
    OnKickedOffline: 'onKickedOffline',
    OnUserTokenExpired: 'onUserTokenExpired',
    OnUserTokenInvalid: 'onUserTokenInvalid',
    OnSelfInfoUpdated: 'onSelfInfoUpdated',
  },
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/tmp',
  DocumentDirectoryPath: '/tmp',
  copyFile: jest.fn(() => Promise.resolve()),
  downloadFile: jest.fn(() => ({
    promise: Promise.resolve({ statusCode: 200 }),
  })),
  unlink: jest.fn(() => Promise.resolve()),
  mkdir: jest.fn(() => Promise.resolve()),
  hash: jest.fn(() => Promise.resolve('sha256')),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-native-create-thumbnail', () => ({
  createThumbnail: jest.fn(),
}));

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: {
    save: jest.fn(() => Promise.resolve('file:///tmp/photo.jpg')),
  },
}));

jest.mock('react-native-nitro-sound', () => ({
  __esModule: true,
  default: {
    startRecorder: jest.fn(() => Promise.resolve('/tmp/voice.m4a')),
    stopRecorder: jest.fn(() => Promise.resolve('/tmp/voice.m4a')),
    startPlayer: jest.fn(() => Promise.resolve('started')),
    stopPlayer: jest.fn(() => Promise.resolve('stopped')),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
    addPlayBackListener: jest.fn(),
    removePlayBackListener: jest.fn(),
    addPlaybackEndListener: jest.fn(),
    removePlaybackEndListener: jest.fn(),
  },
}));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

jest.mock('react-native-camera-kit', () => ({
  Camera: 'Camera',
  CameraType: { Back: 'back' },
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
