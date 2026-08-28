'use client'

import { useEffect, useRef, useState } from 'react'
import type { CookingStats } from '@kaifan/shared'
import { renderStatsPoster } from './poster'

interface PosterModalProps {
  stats: CookingStats
  nickname: string
  onClose: () => void
}

export function PosterModal({ stats, nickname, onClose }: PosterModalProps) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // copied 提示的定时器需要在卸载时清理，避免对已卸载组件 setState
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current)
    }
  }, [])

  useEffect(() => {
    // 绘制放到下一帧，让 loading 态先渲染
    const raf = requestAnimationFrame(() => {
      try {
        setPosterUrl(renderStatsPoster(stats, nickname))
      } catch (err) {
        setError(`海报生成失败：${(err as Error).message}`)
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [stats, nickname])

  const handleSave = () => {
    if (!posterUrl) return
    const link = document.createElement('a')
    link.href = posterUrl
    link.download = `kaifan-月报-${new Date().toISOString().slice(0, 7)}.png`
    link.click()
  }

  const handleCopy = async () => {
    if (!posterUrl) return
    try {
      const blob = await (await fetch(posterUrl)).blob()
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setCopied(true)
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('复制失败——长按上方图片选择「保存/分享」即可')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 px-6 py-8" role="dialog">
      <div className="flex w-full max-w-sm items-center justify-between pb-3">
        <span className="text-sm font-semibold text-white">🎨 我的做饭月报</span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/20 px-3 py-1 text-xs text-white">
          关闭 ✕
        </button>
      </div>

      <div className="max-h-[62vh] w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
        {error ? (
          <p className="p-6 text-center text-xs text-red-600">{error}</p>
        ) : posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="做饭月报分享海报" className="w-full" />
        ) : (
          <div className="flex h-72 items-center justify-center text-xs text-ink/50">正在绘制海报…</div>
        )}
      </div>

      {posterUrl && !error && (
        <div className="flex w-full max-w-sm gap-2 pt-4">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-brand py-3 text-xs font-semibold text-white shadow-sm active:scale-95"
          >
            ⬇️ 保存图片
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex-1 rounded-xl bg-white py-3 text-xs font-semibold text-ink shadow-sm active:scale-95"
          >
            {copied ? '✓ 已复制' : '📋 复制图片'}
          </button>
        </div>
      )}

      {!error && (
        <p className="pt-3 text-center text-[10px] leading-4 text-white/70">
          手机上也可直接长按图片保存或分享到朋友圈
        </p>
      )}
    </div>
  )
}
