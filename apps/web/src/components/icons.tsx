/* 手绘线性图标集：24×24、1.8 描边，贴近 SF Symbols 的克制感 */

interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-6'}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V20a.9.9 0 0 0 .9.9h11.2a.9.9 0 0 0 .9-.9V9.5" />
      <path d="M9.8 20.9v-5.6h4.4v5.6" />
    </Svg>
  )
}

export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6.2C10.7 4.9 8.7 4.2 4.5 4.2v14c4.2 0 6.2.7 7.5 2 1.3-1.3 3.3-2 7.5-2v-14c-4.2 0-6.2.7-7.5 2Z" />
      <path d="M12 6.2v13.9" />
    </Svg>
  )
}

export function IconJournal(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M8.5 3.5v17" />
      <path d="M12 9.5h4M12 13h4" />
    </Svg>
  )
}

export function IconUser(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20.2c.8-3.4 3.6-5.3 7-5.3s6.2 1.9 7 5.3" />
    </Svg>
  )
}

export function IconSearch(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m19.5 19.5-3.8-3.8" />
    </Svg>
  )
}

export function IconMic(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8" />
      <path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0" />
      <path d="M12 17.4v3.1" />
    </Svg>
  )
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function IconBell(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2.2 2.2 0 0 0 4 0" />
    </Svg>
  )
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Svg>
  )
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  )
}

export function IconCart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5h2l2.2 10.4a1 1 0 0 0 1 .8h7.6a1 1 0 0 0 1-.8L19.5 8H7" />
      <circle cx="10" cy="20" r="1.3" />
      <circle cx="16.5" cy="20" r="1.3" />
    </Svg>
  )
}

export function IconCalendar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </Svg>
  )
}

export function IconUsers(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.7-3 3-4.6 5.5-4.6s4.8 1.6 5.5 4.6" />
      <path d="M15.5 5.8a3.2 3.2 0 0 1 0 5.5M17.5 15.2c1.6.7 2.7 2.1 3.1 4.3" />
    </Svg>
  )
}

export function IconChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 20V13M12 20V5M19 20v-9" />
    </Svg>
  )
}

export function IconFridge(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="6" y="3.5" width="12" height="17" rx="2.5" />
      <path d="M6 9.5h12" />
      <path d="M9 6.3v1.4M9 12.5v2.2" />
    </Svg>
  )
}

export function IconClipboard(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2.5" />
      <path d="M9 4.5a3 3 0 0 1 6 0" />
      <path d="M9 11h6M9 15h4" />
    </Svg>
  )
}

export function IconFlame(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5c.5 2.6-.6 4-1.9 5.4C8.7 10.4 7.5 11.8 7.5 14a4.5 4.5 0 0 0 9 0c0-1.2-.4-2.2-1-3.1-.9 1-1.8 1.4-1.8 1.4.5-2.7-.2-6.3-1.7-8.8Z" />
    </Svg>
  )
}

export function IconX(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
    </Svg>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  )
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function IconSparkle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4.5c.6 3.4 1.6 4.4 5 5-3.4.6-4.4 1.6-5 5-.6-3.4-1.6-4.4-5-5 3.4-.6 4.4-1.6 5-5Z" />
      <path d="M18.5 14.5c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z" />
    </Svg>
  )
}
