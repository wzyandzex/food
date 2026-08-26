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

  // 检测当前浏览器推送权限与订阅状态
  useEffect(() => {
    const checkStatus = async () => {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPermissionState('unsupported')
        setHintText('当前浏览器不支持 Web Push。iOS 需 Safari 16.4+ 且先「添加到主屏幕」；微信内打开不支持。')
        return
      }

      const permission = Notification.permission
      if (permission === 'denied') {
        setPermissionState('denied')
        setHintText('通知权限曾被拒绝。请到系统/浏览器设置中手动允许该网站的通知。')
        return
      }

      try {
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        if (permission === 'granted' && existing) {
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

  /** 开启系统推送：请求权限 → SW subscribe → 上报服务端 */
  const handleEnablePush = async () => {
    if (!user) return
    setOperating(true)
    setHintText('')
    setTestMsg('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPermissionState('denied')
        setHintText('未授予通知权限，无法开启系统推送。')
        return
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) throw new Error('服务端尚未配置 VAPID 公钥，请联系运营者')

      const registration = await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
        })
      }

      const token = await getAccessToken()
      if (!token) throw new Error('登录状态已失效，请重新登录')

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
        throw new Error(body.error || '保存推送订阅失败')
      }

      setPermissionState('subscribed')
      onSubscribedChange?.(true)
      setTestMsg('✓ 系统推送已开启！点击下方「发送测试通知」试试效果')
    } catch (err) {
      setTestMsg(`开启失败：${(err as Error).message}`)
    } finally {
      setOperating(false)
    }
  }

  /** 关闭系统推送 */
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
      setTestMsg('已关闭本设备的系统推送（站内红点仍然可用）')
    } catch (err) {
      setTestMsg(`关闭失败：${(err as Error).message}`)
    } finally {
      setOperating(false)
    }
  }

  /** 发送测试推送 */
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
      if (!res.ok || !body.ok) {
        throw new Error(body.error || '测试推送发送失败')
      }

      setTestMsg(
        body.deliveredPushCount && body.deliveredPushCount > 0
          ? `🎉 测试通知已成功送达 ${body.deliveredPushCount} 台设备！留意手机锁屏横幅`
          : '订阅记录存在但推送未送达，可能设备离线或端点过期已被清理',
      )
    } catch (err) {
      setTestMsg(`发送失败：${(err as Error).message}`)
    } finally {
      setOperating(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">🔔 系统推送（PWA Push）</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            permissionState === 'subscribed'
              ? 'bg-green-100 text-green-700'
              : permissionState === 'denied' || permissionState === 'unsupported'
                ? 'bg-red-100 text-red-600'
                : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {permissionState === 'loading' && '检测中…'}
          {permissionState === 'unsupported' && '设备不支持'}
          {permissionState === 'denied' && '权限被拒绝'}
          {permissionState === 'default' && '未开启'}
          {permissionState === 'granted' && '待订阅'}
          {permissionState === 'subscribed' && '✓ 已开启'}
        </span>
      </div>

      <p className="text-xs leading-5 text-ink/60">
        开启后：朋友提交点单、点单状态变更时，会在手机锁屏直接弹出提醒。
        iOS 设备需先把「开饭」添加到主屏幕才能收到（Safari → 分享 → 添加到主屏幕）。
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        {(permissionState === 'default' || permissionState === 'granted') && (
          <button
            type="button"
            onClick={() => void handleEnablePush()}
            disabled={operating}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 active:scale-95"
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
              className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 active:scale-95"
            >
              📤 发送测试通知
            </button>
            <button
              type="button"
              onClick={() => void handleDisablePush()}
              disabled={operating}
              className="rounded-xl bg-neutral-100 px-4 py-2 text-xs font-medium text-ink/70 disabled:opacity-50"
            >
              关闭推送
            </button>
          </>
        )}
      </div>

      {hintText && <p className="text-xs leading-5 rounded-xl bg-amber-50 p-3 text-amber-800">{hintText}</p>}
      {testMsg && <p className="text-xs leading-5 rounded-xl bg-brand-soft p-3 text-brand-deep">{testMsg}</p>}
    </section>
  )
}
