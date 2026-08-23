import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: { default: '开饭 · 管理端', template: '%s · 开饭管理端' },
  description: '菜谱导入管线与内容管理（仅运营者使用）',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  )
}
