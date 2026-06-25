import type { AdminSession } from '../types'

interface TopbarProps {
  error: string
  loading: boolean
  notice: string
  user: AdminSession['user']
  onLogout: () => void
}

export function Topbar({
  error,
  loading,
  notice,
  user,
  onLogout,
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="adminIdentity">
        <span>管理员</span>
        <strong>{user.phoneNumber}</strong>
      </div>
      <div className="topbarStatus">
        {loading && <span className="spinner" />}
        {notice && <span className="notice">{notice}</span>}
        {error && <span className="error">{error}</span>}
      </div>
      <button type="button" className="secondary" onClick={onLogout}>
        退出登录
      </button>
    </header>
  )
}
