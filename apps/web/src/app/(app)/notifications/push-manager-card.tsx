'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

type PushPermissionState = 'unsupported' | 'denied' | 'default' | 'granted' | 'subscribed' | 'loading'

interface PushManagerCardProps {
  onSubscribedChange?: (subscribed: boolean) => void
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function PushManagerCard({ onSubscribedChange }: PushManagerCardProps) {
  const { user, getAccessToken } = useAuth()
  const [permissionState, setPermissionState] = useState<PushPermissionState>('loading')
  const [operating, setOperating] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [hintText, setHintText] = useState('')

  useEffect(() => {
    const checkStatus = async () => {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPermissionState('unsupported')
        setHintText('当前浏览器不支持系统推送。iOS 需在 Safari 点分享 → 添加到主屏幕。')
        return
      }

      const permission = Notification.permission
      if (permission === 'denied') {
        setPermissionState('denied')
        setHintText('通知权限曾被拒绝。请在系统或浏览器设置中允许通知。')
        return
      }

      try {
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        if (permission === 'granted' && existing) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          if (vapidPublicKey) {
            const expected = urlBase64ToUint8Array(vapidPublicKey)
            const actual = new Uint8Array(existing.options.applicationServerKey ?? [])
            const keyMatches =
              actual.length === expected.length && actual.every((byte, idx) => byte === expected[idx])
            if (actual.length > 0 && !keyMatches) {
              await existing.unsubscribe()
              setPermissionState('granted')
              setHintText('推送密钥已更新，请重新点击开启。')
              return
            }
          }
          setPermissionState('subscribed')
        } else {
          setPermissionState(permission === 'granted' ? 'granted' : 'default')
        }
      } catch {
        setPermissionState('default')
      }
    }

    void checkStatus()
  }, [])

  const handleEnablePush = async () => {
    if (!user) return
    setOperating(true)
    setHintText('')
    setTestMsg('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPermissionState('denied')
        setHintText('未授予通知权限。')
        return
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) throw new Error('服务端尚未配置 VAPID 公钥')

      const registration = await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
        })
      }

      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效')

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subscription.toJSON().keys,
          userAgent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error || '保存订阅失败')
      }

      setPermissionState('subscribed')
      onSubscribedChange?.(true)
      setTestMsg('✓ 系统推送已开启！')
    } catch (err) {
      setTestMsg(`开启失败：${(err as Error).message}`)
    } finally {
      setOperating(false)
    }
  }

  const handleDisablePush = async () => {
    setOperating(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const token = await getAccessToken()
        if (token) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ endpoint: subscription.endpoint }),
          }).catch(() => {})
        }
        await subscription.unsubscribe()
      }
      setPermissionState('granted')
      onSubscribedChange?.(false)
      setTestMsg('已关闭本设备的系统推送')
    } catch (err) {
      setTestMsg(`关闭失败：${(err as Error).message}`)
    } finally {
      setOperating(false)
    }
  }

  const handleTestPush = async () => {
    setOperating(true)
    setTestMsg('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('请先登录')

      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = (await res.json()) as { ok?: boolean; deliveredPushCount?: number; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error || '测试推送发送失败')

      setTestMsg(
        body.deliveredPushCount && body.deliveredPushCount > 0
          ? `🎉 测试通知已送达 ${body.deliveredPushCount} 台设备`
          : '未送达，可能设备离线',
      )
    } catch (err) {
      setTestMsg(`发送失败：${(err as Error).message}`)
    } finally {
      setOperating(false)
    }
  }

  return (
    <section className="card p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold text-ink">系统推送（锁屏通知）</h2>
        <span
          className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
            permissionState === 'subscribed'
              ? 'bg-success-soft text-success'
              : permissionState === 'denied' || permissionState === 'unsupported'
                ? 'bg-danger-soft text-danger'
                : 'bg-fill text-ink-3'
          }`}
        >
          {permissionState === 'loading' && '检测中…'}
          {permissionState === 'unsupported' && '不支持'}
          {permissionState === 'denied' && '已拒绝'}
          {permissionState === 'default' && '未开启'}
          {permissionState === 'granted' && '待订阅'}
          {permissionState === 'subscribed' && '已开启'}
        </span>
      </div>

      <p className="text-[12px] leading-5 text-ink-3">
        好友提交点单或状态变更时在锁屏弹出提醒（iOS 需先添加到主屏幕）
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        {(permissionState === 'default' || permissionState === 'granted') && (
          <button
            type="button"
            onClick={() => void handleEnablePush()}
            disabled={operating}
            className="btn-primary w-auto px-4 py-2 text-[12px]"
          >
            {operating ? '处理中…' : '开启系统推送'}
          </button>
        )}
        {permissionState === 'subscribed' && (
          <>
            <button
              type="button"
              onClick={() => void handleTestPush()}
              disabled={operating}
              className="btn-tonal w-auto px-3.5 py-1.5 text-[12px]"
            >
              📤 测试通知
            </button>
            <button
              type="button"
              onClick={() => void handleDisablePush()}
              disabled={operating}
              className="rounded-xl bg-fill px-3.5 py-1.5 text-[12px] font-medium text-ink-2 disabled:opacity-40"
            >
              关闭
            </button>
          </>
        )}
      </div>

      {hintText && <p className="text-[11px] leading-4 text-caution">{hintText}</p>}
      {testMsg && <p className="text-[11px] leading-4 text-tint-deep">{testMsg}</p>}
    </section>
  )
}
