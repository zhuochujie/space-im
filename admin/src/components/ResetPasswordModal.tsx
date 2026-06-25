import type { FormEvent } from 'react'
import type { AdminUser } from '../types'

interface ResetPasswordModalProps {
  loading: boolean
  newPassword: string
  user: AdminUser
  onCancel: () => void
  onNewPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}

export function ResetPasswordModal({
  loading,
  newPassword,
  user,
  onCancel,
  onNewPasswordChange,
  onSubmit,
}: ResetPasswordModalProps) {
  return (
    <div className="modalBackdrop" role="presentation">
      <form className="modal" onSubmit={onSubmit}>
        <h2>重置密码</h2>
        <p>{user.phoneNumber}</p>
        <label>
          新密码
          <input
            autoFocus
            value={newPassword}
            minLength={6}
            maxLength={128}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            type="password"
            placeholder="至少 6 位"
          />
        </label>
        <div className="modalActions">
          <button type="button" className="secondary" onClick={onCancel}>
            取消
          </button>
          <button type="submit" disabled={loading || newPassword.length < 6}>
            确认重置
          </button>
        </div>
      </form>
    </div>
  )
}
