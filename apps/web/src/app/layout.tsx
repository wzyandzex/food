import type { Metadata, Viewport } from 'next'

import { AuthProvider } from '@/components/auth-provider'
import { ServiceWorkerRegister } from '@/components/service-worker-register'

import './globals.css'

export const metadata: Metadata = {
  title: { default: '开饭 KaiFan', template: '%s · 开饭' },
  description: '找菜谱、记做饭、让别人点菜',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '开饭', statusBarStyle: 'default' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#d9480f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
