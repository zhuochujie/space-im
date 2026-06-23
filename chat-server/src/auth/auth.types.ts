export interface AuthUser {
  userID: string;
  username: string;
}

export interface LoginResponse extends AuthUser {
  token: string;
  expireTimeSeconds: number;
}
