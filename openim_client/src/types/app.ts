import type { SessionType } from '@openim/rn-client-sdk';

export type ServerConfig = {
  apiAddr: string;
  wsAddr: string;
  chatServerAddr: string;
};

export type AuthCredentials = {
  phoneNumber: string;
  password: string;
  nickname?: string;
};

export type AuthSession = {
  userID: string;
  phoneNumber: string;
  token: string;
  expireTimeSeconds: number;
};

export type ChatTarget = {
  conversationID: string;
  title: string;
  userID: string;
  groupID: string;
  sessionType: SessionType;
  isNotInGroup?: boolean;
};

export type MainTab = 'messages' | 'contacts' | 'me';
