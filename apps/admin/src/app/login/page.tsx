'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (response.ok) {
        // 使用原生跳转替代 router.push，确保浏览器完整携带新写入的 Cookie 并刷新中间件状态
        window.location.href = '/'
        return
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? `登录失败（${response.status}）`)
    } catch {
      setError('网络错误，请重试')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-1 text-lg font-bold text-neutral-900">开饭 · 管理端登录</h1>
        <p className="mb-6 text-sm text-neutral-500">仅运营者使用</p>

        <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-neutral-700">
          管理密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="请输入管理密码"
        />

        {error && <p className="mb-4 text-xs text-red-600 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={pending || password.length === 0}
          className="w-full rounded-xl bg-brand py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-deep disabled:opacity-40 active:scale-95 transition"
        >
          {pending ? '验证中…' : '进入管理后台'}
        </button>

        <Link href="/" className="mt-4 block text-center text-xs text-neutral-400 hover:text-neutral-600">
          ← 返回管理端首页
        </Link>
      </form>
    </main>
  )
}
