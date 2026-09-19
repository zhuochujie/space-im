import type { Dispatch, SetStateAction } from 'react'

export type RouteKey = 'users' | 'messages' | 'groups' | 'updates'
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
  senderNickname?: string
  recvNickname?: string
  groupName?: string
  contentType?: number
  sendTime?: number
  content?: unknown
  isRevoked?: boolean
}

export interface AdminGroup {
  groupID: string
  groupName?: string
  faceURL?: string
  ownerUserID?: string
  creatorUserID?: string
  memberCount?: number
  createTime?: number
  status?: number
  groupType?: number
  introduction?: string
  notification?: string
}

export interface AdminGroupMember {
  groupID?: string
  userID: string
  nickname?: string
  faceURL?: string
  roleLevel?: number
  joinTime?: number
  muteEndTime?: number
  joinSource?: number
  inviterUserID?: string
}

export interface GroupInfoResponse {
  group: AdminGroup | null
}

export interface GroupListResponse {
  groups: AdminGroup[]
  total: number | null
  page: number
  count: number
}

export interface GroupMembersResponse {
  members: AdminGroupMember[]
  total: number | null
  page: number
  count: number
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
