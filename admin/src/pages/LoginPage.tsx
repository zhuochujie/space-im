import { useState } from 'react'
import type { FormEvent } from 'react'

interface LoginPageProps {
  error: string
  loading: boolean
  onLogin: (phoneNumber: string, password: string) => void
}

export function LoginPage({ error, loading, onLogin }: LoginPageProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    onLogin(phoneNumber.trim(), password)
  }

  return (
    <main className="loginShell">
      <form className="loginPanel" onSubmit={submit}>
        <p className="eyebrow">SPACE IM</p>
        <h1>管理后台登录</h1>
        <label>
          手机号
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="管理员手机号"
          />
        </label>
        <label>
          密码
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="管理员密码"
            type="password"
          />
        </label>
        {error && <span className="error">{error}</span>}
        <button
          type="submit"
          disabled={loading || phoneNumber.trim().length !== 11 || password.length < 6}
        >
          登录
        </button>
      </form>
    </main>
  )
}
