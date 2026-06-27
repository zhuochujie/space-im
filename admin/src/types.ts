import type { Dispatch, SetStateAction } from 'react'

export type RouteKey = 'users' | 'messages' | 'updates'
export type UserStatus = 'pending' | 'active' | 'disabled'
export type AdminRequest = <T>(
  path: string,
  options?: RequestInit,
) => Promise<T>
export type AdminUpload = <T>(
  path: string,
  file: Blob,
  onProgress: (percentage: number) => void,
) => Promise<T>

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface AdminUser {
  userID: string
  phoneNumber: string
  isAdmin: boolean
  status: UserStatus
  createdAt?: string
  updatedAt?: string
}

export interface AdminSession {
  token: string
  user: Pick<AdminUser, 'isAdmin' | 'phoneNumber' | 'userID'>
}

export interface UserListResponse {
  items: AdminUser[]
  total: number
  offset: number
  count: number
}

export interface MessageRow {
  clientMsgID?: string
  sendID?: string
  recvID?: string
  groupID?: string
  contentType?: number
  sendTime?: number
  content?: unknown
}

export interface AppUpdateInfo {
  apkUrl: string
  fileSize: number
  forceUpdate: boolean
  platform: 'android'
  releaseNotes: string
  sha256: string
  updatedAt?: string
  versionCode: number
  versionName: string
}

export interface PageProps {
  loading: boolean
  request: AdminRequest
  setLoading: Dispatch<SetStateAction<boolean>>
  setNotice: Dispatch<SetStateAction<string>>
  setError: Dispatch<SetStateAction<string>>
}
