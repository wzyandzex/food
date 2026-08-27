'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  CheckSquare,
  Users,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: '总览看板', icon: LayoutDashboard },
  { href: '/recipes', label: '菜谱库', icon: UtensilsCrossed },
  { href: '/jobs', label: '导入任务', icon: Layers },
  { href: '/review', label: '审核中心', icon: CheckSquare },
  { href: '/users', label: '用户管理', icon: Users },
  { href: '/analytics', label: '数据监控', icon: BarChart3 },
  { href: '/settings', label: '系统设置', icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    window.location.href = '/login'
  }

  return (
    <aside className="w-64 bg-white border-r border-neutral-200 flex flex-col shrink-0 min-h-dvh">
      {/* 品牌标识 */}
      <div className="h-16 flex items-center px-6 border-b border-neutral-100 gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
          饭
        </div>
        <div>
          <div className="font-semibold text-neutral-900 leading-tight">开饭 KaiFan</div>
          <div className="text-xs text-neutral-400 font-mono">运营工作台 v1.2</div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-amber-50 text-amber-900 font-semibold'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-700' : 'text-neutral-400'}`} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* 底部管理员身份与退出 */}
      <div className="p-4 border-t border-neutral-100 flex items-center justify-between">
        <div className="text-xs text-neutral-500 truncate">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>
          管理员已在线
        </div>
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="退出登录"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  )
}
