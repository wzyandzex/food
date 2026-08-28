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

  useEffect(() => {
    if (!loading && !user && token) {
      try {
        sessionStorage.setItem(REDIRECT_KEY, `/join/${token}`)
      } catch {
        // 忽略
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
    return <main className="screen text-center text-xs text-ink-3 pt-20">正在校验邀请链接…</main>
  }

  if (previewError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[44px] mb-3">🤔</p>
        <h1 className="text-[18px] font-bold text-ink">无法加入圈子</h1>
        <p className="mt-2 mb-6 max-w-xs text-[13px] leading-5 text-ink-3">{previewError}</p>
        <Link href="/" className="btn-tonal w-auto px-6 py-2.5 text-[14px]">
          回到首页逛逛
        </Link>
      </main>
    )
  }

  if (!preview) return null

  if (joinedCircleId) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[44px] mb-3">🎉</p>
        <h1 className="text-[20px] font-bold text-ink">
          {alreadyMember ? '你已经在圈子里啦' : `已加入「${preview.circleName}」`}
        </h1>
        <p className="mt-2 mb-8 text-[13px] leading-5 text-ink-2">
          {alreadyMember ? '可以直接进入圈子查看点单动态' : '圈内一有新点单，你会第一时间收到通知'}
        </p>
        <Link
          href={`/circles/${joinedCircleId}`}
          className="btn-primary"
        >
          进入「{preview.circleName}」→
        </Link>
        <Link href="/" className="mt-4 text-[13px] text-ink-3 underline">先回首页看看</Link>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="text-[44px] mb-3">👥</p>
        <h1 className="text-[18px] font-bold text-ink">
          {preview.ownerNickname} 邀请你加入「{preview.circleName}」
        </h1>
        <p className="mt-2 mb-8 text-[13px] leading-5 text-ink-3">
          圈子成员需要登录账号，登录后自动回到本页完成加入
        </p>
        <Link href="/login" className="btn-primary">
          登录 / 注册后加入
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 pt-16">
      <header className="card p-6 text-center space-y-2">
        <p className="text-[36px]">🍽️</p>
        <h1 className="text-[20px] font-bold leading-7 text-ink">
          {preview.ownerNickname} 邀请你加入<br />「{preview.circleName}」
        </h1>
        <p className="text-[12px] text-ink-3">
          当前 {preview.memberCount} 位成员{preview.isFull ? ' · 已满员' : ''}
        </p>
      </header>

      {preview.isFull ? (
        <p className="mt-4 card p-3 text-center text-[13px] text-caution bg-caution-soft">
          这个圈子已满员，请让群主先移出部分成员
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {joinError && (
            <p className="card p-3 text-center text-[12px] text-danger bg-danger-soft">
              {joinError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={joining}
            className="btn-primary"
          >
            {joining ? '加入中…' : '确认加入这个圈子'}
          </button>
        </div>
      )}

      <footer className="mt-8 text-center text-[12px] leading-5 text-ink-3">
        加入后你在圈内以昵称出现 · 可随时在圈子页退出
      </footer>
    </main>
  )
}
