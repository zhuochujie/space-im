import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from './components/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { MessagesPage } from './pages/MessagesPage'
import { UpdatesPage } from './pages/UpdatesPage'
import { UsersPage } from './pages/UsersPage'
import type {
  AdminRequest,
  AdminSession,
  AdminUpload,
  ApiResponse,
  RouteKey,
} from './types'
import './App.css'

const API_BASE = import.meta.env.VITE_CHAT_SERVER_URL ?? '/api'

function App() {
  const [route, setRoute] = useState<RouteKey>(() => readRoute())
  const [session, setSession] = useState<AdminSession | null>(() => {
    const stored = localStorage.getItem('space-admin-session')
    if (!stored) {
      return null
    }
    try {
      return JSON.parse(stored) as AdminSession
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const normalizedApiBase = useMemo(
    () => API_BASE.replace(/\/+$/, ''),
    [],
  )

  const request: AdminRequest = useCallback(async <T,>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> => {
    setError('')
    const response = await fetch(`${normalizedApiBase}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(session?.token ? { authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
    })
    const payload = (await response.json().catch(() => null)) as
      | ApiResponse<T>
      | null
    if (!response.ok || !payload || payload.code !== 0) {
      throw new Error(payload?.message || `请求失败 (${response.status})`)
    }
    return payload.data
  }, [normalizedApiBase, session?.token])

  const upload: AdminUpload = useCallback(
    <T,>(
      path: string,
      file: Blob,
      onProgress: (percentage: number) => void,
    ): Promise<T> => {
      setError('')
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', `${normalizedApiBase}${path}`)
        xhr.setRequestHeader(
          'content-type',
          'application/vnd.android.package-archive',
        )
        if (session?.token) {
          xhr.setRequestHeader('authorization', `Bearer ${session.token}`)
        }
        xhr.upload.onprogress = (event) => {
          const total = event.lengthComputable ? event.total : file.size
          if (total > 0) {
            onProgress(Math.min(100, Math.round((event.loaded / total) * 100)))
          }
        }
        xhr.onerror = () => reject(new Error('上传失败，请检查网络连接'))
        xhr.onload = () => {
          let payload: ApiResponse<T> | null = null
          try {
            payload = JSON.parse(xhr.responseText) as ApiResponse<T>
          } catch {
            reject(new Error(`请求失败 (${xhr.status})`))
            return
          }
          if (xhr.status < 200 || xhr.status >= 300 || payload.code !== 0) {
            reject(new Error(payload.message || `请求失败 (${xhr.status})`))
            return
          }
          onProgress(100)
          resolve(payload.data)
        }
        xhr.send(file)
      })
    },
    [normalizedApiBase, session?.token],
  )

  useEffect(() => {
    if (session) {
      localStorage.setItem('space-admin-session', JSON.stringify(session))
    } else {
      localStorage.removeItem('space-admin-session')
    }
  }, [session])

  useEffect(() => {
    const onPopState = () => setRoute(readRoute())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextRoute: RouteKey) {
    if (nextRoute === route) {
      return
    }
    window.history.pushState(null, '', routePath(nextRoute))
    setRoute(nextRoute)
  }

  async function login(phoneNumber: string, password: string) {
    setLoading(true)
    setError('')
    try {
      const data = await request<AdminSession>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber, password }),
      })
      setSession(data)
      setNotice('登录成功')
      window.history.replaceState(null, '', routePath(route))
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setSession(null)
    setNotice('')
    setError('')
  }

  if (!session) {
    return (
      <LoginPage
        error={error}
        loading={loading}
        onLogin={(phoneNumber, password) => void login(phoneNumber, password)}
      />
    )
  }

  return (
    <AdminLayout
      error={error}
      loading={loading}
      notice={notice}
      route={route}
      user={session.user}
      onLogout={logout}
      onNavigate={navigate}
    >
      {route === 'updates' ? (
        <UpdatesPage
          loading={loading}
          request={request}
          setError={setError}
          setLoading={setLoading}
          setNotice={setNotice}
          upload={upload}
        />
      ) : route === 'messages' ? (
        <MessagesPage
          loading={loading}
          request={request}
          setError={setError}
          setLoading={setLoading}
          setNotice={setNotice}
        />
      ) : (
        <UsersPage
          loading={loading}
          request={request}
          setError={setError}
          setLoading={setLoading}
          setNotice={setNotice}
        />
      )}
    </AdminLayout>
  )
}

function readRoute(): RouteKey {
  if (window.location.pathname.includes('/messages')) {
    return 'messages'
  }
  if (window.location.pathname.includes('/updates')) {
    return 'updates'
  }
  return 'users'
}

function routePath(route: RouteKey): string {
  if (route === 'messages') {
    return '/messages'
  }
  if (route === 'updates') {
    return '/updates'
  }
  return '/users'
}

export default App
