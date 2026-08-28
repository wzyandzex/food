'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { IconBook, IconHome, IconJournal, IconUser } from '@/components/icons'

const TABS = [
  { href: '/', label: '首页', Icon: IconHome },
  { href: '/recipes', label: '菜谱', Icon: IconBook },
  { href: '/logs', label: '记录', Icon: IconJournal },
  { href: '/me', label: '我的', Icon: IconUser },
] as const

/** 底部四 Tab：毛玻璃 + hairline 顶边 + 安全区留白 */
export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line/60 bg-paper/90 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-[52px] items-stretch">
        {TABS.map(({ href, label, Icon }) => {
          // 二级页（如 /recipes/xxx）保持对应 Tab 高亮
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 active:opacity-60"
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={`size-[22px] ${active ? 'text-tint' : 'text-ink-3'}`} />
              <span className={`text-[10px] ${active ? 'font-semibold text-tint' : 'text-ink-3'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
