/** 本地时区日期工具（避免 UTC 偏移坑：一律用本地年月日数值拼接，不用 toISOString） */

/** 本地日期 → YYYY-MM-DD 字符串 */
export function toLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** YYYY-MM-DD → 当日零点的毫秒时间戳（按本地时区解释） */
export function parseDateKeyMs(dateKey: string): number {
  return Date.parse(`${dateKey}T00:00:00`)
}

/** 给定任意日期，返回其所在自然周的周一（本地时区） */
export function startOfWeek(date: Date | string = new Date()): Date {
  const base = typeof date === 'string' ? new Date(parseDateKeyMs(date)) : new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayOfWeek = base.getDay() // 0=周日
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + mondayOffset)
}

/** 从周一开始的连续 7 天日期键 */
export function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
    return toLocalDateKey(d)
  })
}
