import type { UserStatus } from '../types'

export function statusText(status: UserStatus): string {
  const map: Record<UserStatus, string> = {
    pending: '注册中',
    active: '可登录',
    disabled: '已禁用',
  }
  return map[status]
}

export function formatTime(value?: string): string {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString()
}

export function formatMessageTime(value?: number): string {
  if (!value) {
    return '-'
  }
  const time = value < 10_000_000_000 ? value * 1000 : value
  return new Date(time).toLocaleString()
}
