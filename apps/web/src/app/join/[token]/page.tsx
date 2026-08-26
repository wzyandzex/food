'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

interface PreviewPayload {
  circleName: string
  ownerNickname: string
  memberCount: number
  isFull: boolean
}

const REDIRECT_KEY = 'kaifan_redirect_after_login'

export default function JoinCirclePage({ params }: { params: Promise<{ token: string }> }) {
  const { user, loading, getAccessToken } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewPayload | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [joinedCircleId, setJoinedCircleId] = useState<string | null>(null)
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    void params.then(({ token: value }) => setToken(value))
  }, [params])

  // 预览邀请信息（无需登录）
  useEffect(() => {
    if (!token) return
    fetch(`/api/join-circle?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json()) as Partial<PreviewPayload> & { error?: string }
        if (!res.ok || !body.circleName) throw new Error(body.error ?? '邀请无效')
        setPreview(body as PreviewPayload)
      })
      .catch((err: Error) => setPreviewError(err.message))
  }, [token])

  // 未登录时记住回跳路径
  useEffect(() => {
    if (!loading && !user && token) {
      try {
        sessionStorage.setItem(REDIRECT_KEY, `/join/${token}`)
      } catch {
        // 忽略存储失败
      }
    }
  }, [loading, user, token])

  const handleJoin = async () => {
    if (!token) return
    setJoining(true)
    setJoinError('')
    try {
      const requestToken = await getAccessToken()
      if (!requestToken) throw new Error('登录状态已失效，请重新登录')

      const res = await fetch('/api/join-circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${requestToken}` },
        body: JSON.stringify({ token }),
      })
      const body = (await res.json()) as { ok?: boolean; circleId?: string; alreadyMember?: boolean; error?: string }
      if (!res.ok || !body.ok || !body.circleId) throw new Error(body.error ?? '加入失败')

      setJoinedCircleId(body.circleId)
      setAlreadyMember(Boolean(body.alreadyMember))
    } catch (err) {
      setJoinError((err as Error).message)
    } finally {
      setJoining(false)
    }
  }

  if (loading || (!token || (preview === null && !previewError))) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-10 pb-16 text-center text-xs text-ink/50">
        正在校验邀请链接…
      </main>
    )
  }

  // 无效/过期/已满的友好落地页
  if (previewError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-4xl">🤔</div>
        <h1 className="mb-2 text-lg font-bold">无法加入圈子</h1>
        <p className="mb-6 max-w-xs text-xs leading-5 text-ink/55">{previewError}</p>
        <Link href="/" className="rounded-xl bg-neutral-100 px-5 py-2.5 text-xs font-semibold text-ink/70">
          回到首页逛逛菜谱
        </Link>
      </main>
    )
  }

  if (!preview) return null

  // 加入成功态
  if (joinedCircleId) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-3 text-5xl">🎉</div>
        <h1 className="mb-1 text-xl font-bold">{alreadyMember ? '你已经在圈子里啦' : `已加入「${preview.circleName}」`}</h1>
        <p className="mb-8 text-xs leading-5 text-ink/55">
          {alreadyMember ? '可以直接进入圈子查看点单动态' : '以后圈内一有新点单，你会第一时间收到通知'}
        </p>
        <Link
          href={`/circles/${joinedCircleId}`}
          className="w-full rounded-2xl bg-brand py-4 font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          进入「{preview.circleName}」→
        </Link>
        <Link href="/" className="mt-4 text-xs text-ink/50 underline">先回首页看看</Link>
      </main>
    )
  }

  // 未登录：引导登录（登录页读取中转键后自动回来）
  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-4xl mb-3">👥</p>
        <h1 className="mb-2 text-lg font-bold">
          {preview.ownerNickname} 邀请你加入「{preview.circleName}」
        </h1>
        <p className="mb-8 text-xs leading-5 text-ink/55">
          圈子成员需要登录账号（这样大家才能互相看到谁在点单）。<br />
          登录后会自动回到本页面完成加入。
        </p>
        <Link href="/login" className="rounded-2xl bg-brand px-8 py-3.5 font-semibold text-white shadow-sm active:scale-[0.98]">
          登录 / 注册后加入
        </Link>
      </main>
    )
  }

  // 登录态：确认加入
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-16">
      <header className="mb-8 rounded-2xl bg-brand p-6 text-center text-white shadow-sm">
        <p className="text-3xl">🍽️</p>
        <h1 className="mt-2 text-xl font-bold leading-7">
          {preview.ownerNickname} 邀请你加入<br />「{preview.circleName}」
        </h1>
        <p className="mt-1.5 text-[11px] opacity-80">
          当前 {preview.memberCount} 位成员{preview.isFull ? ' · 已满员' : ''}
        </p>
      </header>

      {preview.isFull ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800">
          这个圈子已满员，请让群主先移出部分成员或另建新圈。
        </p>
      ) : (
        <>
          {joinError && (
            <p className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-xs text-red-700">
              {joinError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={joining}
            className="w-full rounded-2xl bg-brand py-4 font-semibold text-white shadow-sm disabled:opacity-50 active:scale-[0.99]"
          >
            {joining ? '加入中…' : '确认加入这个圈子'}
          </button>
        </>
      )}

      <footer className="mt-10 text-center text-[11px] leading-5 text-ink/40">
        加入后你在圈内以昵称出现；<br />
        可随时在圈子页退出。
      </footer>
    </main>
  )
}
