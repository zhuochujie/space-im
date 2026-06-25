import type { ReactNode } from 'react'
import type { AdminSession, RouteKey } from '../types'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface AdminLayoutProps {
  children: ReactNode
  error: string
  loading: boolean
  notice: string
  route: RouteKey
  user: AdminSession['user']
  onLogout: () => void
  onNavigate: (route: RouteKey) => void
}

export function AdminLayout({
  children,
  error,
  loading,
  notice,
  route,
  user,
  onLogout,
  onNavigate,
}: AdminLayoutProps) {
  return (
    <main className="shell">
      <Sidebar route={route} onNavigate={onNavigate} />
      <section className="content">
        <Topbar
          error={error}
          loading={loading}
          notice={notice}
          user={user}
          onLogout={onLogout}
        />
        {children}
      </section>
    </main>
  )
}
