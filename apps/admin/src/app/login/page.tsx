'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function AdminLoginPage() {
  const router = useRouter()
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
        router.push('/')
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
        <h1 className="mb-1 text-lg font-bold">开饭 · 管理端登录</h1>
        <p className="mb-6 text-sm text-neutral-500">仅运营者使用（M0 占位实现）</p>

        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          管理密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="ADMIN_PASSWORD 环境变量的值"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending || password.length === 0}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? '验证中…' : '登录'}
        </button>

        <Link href="/" className="mt-4 block text-center text-xs text-neutral-400">
          ← 返回管理端首页
        </Link>
      </form>
    </main>
  )
}
