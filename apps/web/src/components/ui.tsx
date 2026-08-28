'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

/** iOS 大标题页头：大标题 + 副标题 + 可选右侧动作 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-end justify-between px-5 pt-3 pb-3">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-9 font-bold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  )
}

/** 二级页导航头：返回 + 居中标题 + 右侧动作（吸顶毛玻璃） */
export function NavBar({
  title,
  back,
  backLabel,
  action,
}: {
  title: string
  back?: string
  backLabel?: string
  action?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-line/60 bg-paper/85 px-2 backdrop-blur-xl">
      <div className="flex min-w-16 flex-1 justify-start">
        {back && (
          <Link href={back} className="-ml-1 rounded-lg px-1.5 py-1 text-[15px] text-tint active:opacity-50">
            ‹ {backLabel ?? '返回'}
          </Link>
        )}
      </div>
      <h1 className="truncate text-[17px] font-semibold text-ink">{title}</h1>
      <div className="flex min-w-16 flex-1 justify-end">{action}</div>
    </header>
  )
}

/** 白卡面板：全局唯一的「表面」，无阴影 */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-4 overflow-hidden rounded-xl bg-surface ${className}`}>{children}</div>
}

/** iOS 分组列表容器：小节标题 + 圆角面板 + 页脚说明 */
export function GroupedList({
  header,
  footer,
  children,
  className = '',
}: {
  header?: string
  footer?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`mt-6 ${className}`}>
      {header && (
        <h2 className="mb-1.5 px-5 text-[13px] font-medium tracking-wide text-ink-3">{header}</h2>
      )}
      <div className="mx-4 overflow-hidden rounded-xl bg-surface">{children}</div>
      {footer && <p className="mt-1.5 px-5 text-[12px] leading-5 text-ink-3">{footer}</p>}
    </section>
  )
}

/** 分组列表行：图标 + 主文案 + 副文案 + 右侧元素，整行可点 */
export function ListRow({
  icon,
  title,
  detail,
  right,
  href,
  onClick,
  danger = false,
  last = false,
}: {
  icon?: ReactNode
  title: ReactNode
  detail?: ReactNode
  right?: ReactNode
  href?: string
  onClick?: () => void
  danger?: boolean
  last?: boolean
}) {
  const content = (
    <>
      {icon && <span className="flex size-7 shrink-0 items-center justify-center text-[18px]">{icon}</span>}
      <div className={`min-w-0 flex-1 py-2.5 ${icon ? '' : ''}`}>
        <p className={`truncate text-[15px] leading-6 ${danger ? 'text-danger' : 'text-ink'}`}>{title}</p>
        {detail && <p className="mt-0.5 truncate text-[12px] leading-4 text-ink-3">{detail}</p>}
      </div>
      {right && <span className="ml-2 flex shrink-0 items-center gap-1">{right}</span>}
      {href !== undefined && (
        <span className={`ml-0.5 shrink-0 text-[17px] ${danger ? 'text-danger/50' : 'text-ink-3/70'}`}>›</span>
      )}
    </>
  )
  const rowClass = `flex w-full items-center px-4 text-left transition-colors active:bg-fill ${last ? '' : 'border-b border-line/50'}`

  if (href !== undefined) {
    return (
      <Link href={href} className={rowClass} onClick={onClick}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={rowClass} onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className={rowClass}>{content}</div>
}

/** iOS 分段控件 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={`flex rounded-[10px] bg-fill p-[3px] ${className}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-[8px] py-1.5 text-[13px] font-medium transition-all ${
            value === option.value
              ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(31,26,20,0.08)]'
              : 'text-ink-2'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** 空状态 */
export function EmptyState({
  glyph,
  title,
  description,
  action,
}: {
  glyph: string
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="flex flex-col items-center px-10 py-16 text-center">
      <span className="mb-4 text-[44px] leading-none opacity-70">{glyph}</span>
      <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1.5 text-[13px] leading-5 text-ink-2">{description}</p>}
      {action && <div className="mt-6 w-full max-w-64">{action}</div>}
    </section>
  )
}

/** 主按钮：实心 tint，每屏至多一个 */
export function PrimaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-xl bg-tint py-3 text-center text-[15px] font-semibold text-white transition active:opacity-70 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

/** 次按钮：tint-soft 底 + 深字 */
export function SecondaryButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-xl bg-tint-soft py-3 text-center text-[15px] font-semibold text-tint-deep transition active:opacity-70 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}

/** 标签 chip（静态展示） */
export function Tag({ children, tone = 'tinted' }: { children: ReactNode; tone?: 'tinted' | 'plain' }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
        tone === 'tinted' ? 'bg-tint-soft text-tint-deep' : 'bg-fill text-ink-2'
      }`}
    >
      {children}
    </span>
  )
}

/** 需要登录的占位页 */
export function LoginRequired({ glyph, title, description }: { glyph: string; title: string; description: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-10 text-center">
      <span className="mb-4 text-[44px] opacity-70">{glyph}</span>
      <h1 className="text-[20px] font-bold text-ink">{title}</h1>
      <p className="mt-2 text-[13px] leading-5 text-ink-2">{description}</p>
      <Link
        href="/login"
        className="mt-7 w-full max-w-60 rounded-xl bg-tint py-3 text-[15px] font-semibold text-white active:opacity-70"
      >
        登录 / 注册
      </Link>
    </main>
  )
}
