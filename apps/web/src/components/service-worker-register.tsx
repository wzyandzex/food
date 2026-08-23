'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (error) {
        console.error('Service Worker 注册失败', error)
      }
    }

    void register()
  }, [])

  return null
}
