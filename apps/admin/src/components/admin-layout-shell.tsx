'use client'

import { usePathname } from 'next/navigation'
import { AdminSidebar } from '@/components/admin-sidebar'

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <main>{children}</main>
  }

  return (
    <div className="flex min-h-dvh bg-neutral-50/60">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
