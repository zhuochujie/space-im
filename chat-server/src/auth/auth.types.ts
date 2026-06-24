export interface AuthUser {
  userID: string;
  phoneNumber: string;
}

export interface LoginResponse extends AuthUser {
  token: string;
  expireTimeSeconds: number;
}
