'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { getBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setError('')

    try {
      if (mode === 'register') {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, nickname, inviteCode }),
        })
        const body = (await response.json()) as { error?: string }
        if (!response.ok) {
          setError(body.error ?? '注册失败')
          return
        }
        // 注册成功后直接登录
      }

      const supabase = getBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials' ? '邮箱或密码错误' : signInError.message)
        return
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand text-3xl">
          🍚
        </div>
        <h1 className="text-xl font-bold">开饭</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-5 flex rounded-lg bg-neutral-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'login' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-md py-1.5 font-medium ${mode === 'register' ? 'bg-white shadow-sm' : 'text-neutral-500'}`}
          >
            注册
          </button>
        </div>

        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          邮箱
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder="you@example.com"
        />

        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          placeholder={mode === 'register' ? '至少 6 位' : ''}
        />

        {mode === 'register' && (
          <>
            <label htmlFor="nickname" className="mb-1 block text-sm font-medium">
              昵称（选填）
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="mb-3 w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="怎么称呼你"
            />

            <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium">
              邀请码
            </label>
            <input
              id="inviteCode"
              type="text"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              className="mb-3 w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="向发起人要一个邀请码"
            />
          </>
        )}

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending || !email || !password || (mode === 'register' && !inviteCode)}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {pending ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>

      <Link href="/" className="mt-4 text-center text-sm text-ink/50">
        ← 先逛逛，不用登录
      </Link>
    </main>
  )
}