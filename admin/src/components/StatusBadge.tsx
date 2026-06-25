import { statusText } from '../lib/format'
import type { UserStatus } from '../types'

interface StatusBadgeProps {
  status: UserStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`badge ${status}`}>{statusText(status)}</span>
}
