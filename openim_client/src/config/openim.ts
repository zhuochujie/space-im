import type { ServerConfig } from '../types/app';

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
  apiAddr: 'http://chat.spacefi.us:10002',
  wsAddr: 'ws://chat.spacefi.us:10001',
  chatServerAddr: 'http://chat.spacefi.us:3000',
};
