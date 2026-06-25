import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ResetPasswordModal } from '../components/ResetPasswordModal'
import { StatusBadge } from '../components/StatusBadge'
import { getErrorMessage } from '../lib/errors'
import { formatTime } from '../lib/format'
import type { AdminUser, PageProps, UserListResponse, UserStatus } from '../types'

const EMPTY_USERS: UserListResponse = {
  items: [],
  total: 0,
  offset: 0,
  count: 50,
}

export function UsersPage({
  loading,
  request,
  setError,
  setLoading,
  setNotice,
}: PageProps) {
  const [users, setUsers] = useState<UserListResponse>(EMPTY_USERS)
  const [userSearch, setUserSearch] = useState('')
  const [userStatus, setUserStatus] = useState<UserStatus | ''>('')
  const [resetUser, setResetUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const loadUsers = useCallback(async (event?: FormEvent) => {
    event?.preventDefault()
    setLoading(true)
    setNotice('')
    try {
      const params = new URLSearchParams({
        offset: '0',
        count: '50',
      })
      if (userSearch.trim()) {
        params.set('search', userSearch.trim())
      }
      if (userStatus) {
        params.set('status', userStatus)
      }
      const data = await request<UserListResponse>(
        `/admin/users?${params.toString()}`,
      )
      setUsers(data)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [request, setError, setLoading, setNotice, userSearch, userStatus])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    request<UserListResponse>('/admin/users?offset=0&count=50')
      .then((data) => {
        if (mounted) {
          setUsers(data)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [request, setError, setLoading])

  async function submitResetPassword(event: FormEvent) {
    event.preventDefault()
    if (!resetUser) {
      return
    }
    setLoading(true)
    setNotice('')
    try {
      await request<AdminUser>(
        `/admin/users/${encodeURIComponent(resetUser.userID)}/reset-password`,
        {
          method: 'POST',
          body: JSON.stringify({ newPassword }),
        },
      )
      setNotice(`已重置 ${resetUser.phoneNumber} 的密码`)
      closeResetModal()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function toggleUserStatus(user: AdminUser) {
    const nextStatus = user.status === 'disabled' ? 'active' : 'disabled'
    setLoading(true)
    setNotice('')
    try {
      await request<AdminUser>(
        `/admin/users/${encodeURIComponent(user.userID)}/status`,
        {
          method: 'POST',
          body: JSON.stringify({ status: nextStatus }),
        },
      )
      setNotice(
        nextStatus === 'disabled'
          ? `已禁用 ${user.phoneNumber} 登录`
          : `已启用 ${user.phoneNumber} 登录`,
      )
      await loadUsers()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  function closeResetModal() {
    setResetUser(null)
    setNewPassword('')
  }

  return (
    <>
      <section className="panel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">User Control</p>
            <h2>用户管理</h2>
          </div>
          <p>共 {users.total} 个用户</p>
        </div>

        <form className="filters" onSubmit={loadUsers}>
          <input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            placeholder="搜索手机号或 userID"
          />
          <select
            value={userStatus}
            onChange={(event) =>
              setUserStatus(event.target.value as UserStatus | '')
            }
          >
            <option value="">全部状态</option>
            <option value="active">可登录</option>
            <option value="disabled">已禁用</option>
            <option value="pending">注册中</option>
          </select>
          <button type="submit" disabled={loading}>
            查询
          </button>
        </form>

        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>手机号</th>
                <th>角色</th>
                <th>状态</th>
                <th>用户 ID</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.items.map((user) => (
                <tr key={user.userID}>
                  <td>{user.phoneNumber}</td>
                  <td>{user.isAdmin ? '管理员' : '用户'}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="mono">{user.userID}</td>
                  <td>{formatTime(user.createdAt)}</td>
                  <td>
                    <div className="rowActions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setResetUser(user)}
                        disabled={user.status === 'pending'}
                      >
                        重置密码
                      </button>
                      <button
                        type="button"
                        className={
                          user.status === 'disabled' ? 'success' : 'danger'
                        }
                        onClick={() => void toggleUserStatus(user)}
                        disabled={user.status === 'pending'}
                      >
                        {user.status === 'disabled' ? '启用' : '禁用'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    暂无数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {resetUser && (
        <ResetPasswordModal
          loading={loading}
          newPassword={newPassword}
          user={resetUser}
          onCancel={closeResetModal}
          onNewPasswordChange={setNewPassword}
          onSubmit={submitResetPassword}
        />
      )}
    </>
  )
}
