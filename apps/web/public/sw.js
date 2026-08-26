/* 开饭 PWA Service Worker：页面网络优先、静态资源缓存优先、离线兜底页 + Web Push 系统通知支持 */
const CACHE_NAME = 'kaifan-v2'
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 排除 API 路由拦截，API 永远走实时网络
  if (url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached ?? caches.match('/offline')),
        ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFill = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached ?? networkFill
    }),
  )
})

// ====================== M2 Web Push 通知接收 ======================

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {
    title: '开饭消息提醒',
    body: '您有一条新的做饭/点单动态',
    url: '/notifications',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  }

  try {
    payload = { ...payload, ...event.data.json() }
  } catch {
    payload.body = event.data.text() || payload.body
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    data: {
      url: payload.url || '/notifications',
    },
    vibrate: [100, 50, 100],
    tag: payload.tag || `kaifan-${Date.now()}`,
    renotify: true,
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

// 点击系统横幅/通知后，唤起/聚焦窗口并跳转至对应路由
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/notifications'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // 如果已有打开的窗口，聚焦并跳转
        for (const client of windowClients) {
          if (client.url && 'focus' in client) {
            void client.navigate(targetUrl)
            return client.focus()
          }
        }
        // 若没有，打开新独立窗口
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      }),
  )
})
