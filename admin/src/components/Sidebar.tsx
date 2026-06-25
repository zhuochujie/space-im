import type { MouseEvent } from 'react'
import type { RouteKey } from '../types'

interface SidebarProps {
  route: RouteKey
  onNavigate: (route: RouteKey) => void
}

export function Sidebar({ route, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div>
        <p className="eyebrow">SPACE IM</p>
        <h1>管理后台</h1>
      </div>
      <nav className="tabs" aria-label="管理模块">
        <RouteLink
          active={route === 'users'}
          href="/users"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('users')
          }}
        >
          用户管理
        </RouteLink>
        <RouteLink
          active={route === 'messages'}
          href="/messages"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('messages')
          }}
        >
          消息管理
        </RouteLink>
        <RouteLink
          active={route === 'updates'}
          href="/updates"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('updates')
          }}
        >
          App 更新
        </RouteLink>
      </nav>
    </aside>
  )
}

interface RouteLinkProps {
  active: boolean
  children: string
  href: string
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void
}

function RouteLink({ active, children, href, onClick }: RouteLinkProps) {
  return (
    <a className={active ? 'active' : ''} href={href} onClick={onClick}>
      {children}
    </a>
  )
}
