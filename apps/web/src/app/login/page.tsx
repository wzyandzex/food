'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Segmented } from '@/components/ui'
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
      }

      const supabase = getBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(signInError.message === 'Invalid login credentials' ? '邮箱或密码错误' : signInError.message)
        return
      }

      let redirectTo = '/'
      try {
        const storedRedirect = sessionStorage.getItem('kaifan_redirect_after_login')
        if (storedRedirect?.startsWith('/')) {
          redirectTo = storedRedirect
          sessionStorage.removeItem('kaifan_redirect_after_login')
        }
      } catch {
        // 忽略
      }

      router.push(redirectTo)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  const MODE_OPTIONS = [
    { value: 'login' as const, label: '登录' },
    { value: 'register' as const, label: '注册' },
  ]

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-tint text-2xl">
          🍚
        </div>
        <h1 className="text-[22px] font-bold text-ink">开饭</h1>
        <p className="text-[13px] text-ink-3">做饭全记录 · 私人生活 App</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-3">
        <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />

        <div className="pt-2">
          <label htmlFor="email" className="mb-1 block text-[12px] font-medium text-ink-3">
            邮箱
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="field text-[14px]"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-[12px] font-medium text-ink-3">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="field text-[14px]"
            placeholder={mode === 'register' ? '至少 6 位' : ''}
            required
          />
        </div>

        {mode === 'register' && (
          <>
            <div>
              <label htmlFor="nickname" className="mb-1 block text-[12px] font-medium text-ink-3">
                昵称（选填）
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="field text-[14px]"
                placeholder="怎么称呼你"
              />
            </div>

            <div>
              <label htmlFor="inviteCode" className="mb-1 block text-[12px] font-medium text-ink-3">
                邀请码 *
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="field text-[14px]"
                placeholder="向发起人要一个邀请码"
                required
              />
            </div>
          </>
        )}

        {error && <p className="text-[12px] text-danger bg-danger-soft p-2.5 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={pending || !email || !password || (mode === 'register' && !inviteCode)}
          className="btn-primary"
        >
          {pending ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
      </form>

      <Link href="/" className="mt-4 text-center text-[13px] text-ink-3 hover:text-ink">
        ← 先逛逛，不用登录
      </Link>
    </main>
  )
}
