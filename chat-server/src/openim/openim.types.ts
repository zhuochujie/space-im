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
  users: Array<{ userID: string }> | null;
}

export interface OpenImGroupsData {
  groupInfos?: unknown[] | null;
  groups?: unknown[] | null;
  total?: number;
}

export interface OpenImGroupMembersData {
  members?: unknown[] | null;
  total?: number;
}
