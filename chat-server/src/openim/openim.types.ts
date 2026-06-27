export interface OpenImResponse<T = undefined> {
  errCode: number;
  errMsg: string;
  errDlt?: string;
  data?: T;
}

export interface OpenImTokenData {
  token: string;
  expireTimeSeconds: number;
}

export interface OpenImUsersData {
  users: Array<{ userID: string }>;
}
