import type { CookingStats } from '@/app/api/stats/cooking/route'

const BRAND = '#d9480f'
const BRAND_DEEP = '#a63305'
const BRAND_SOFT = '#fff7ed'
const INK = '#26211c'
const INK_SOFT = 'rgba(38, 17, 8, 0.55)'

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** 客户端绘制「做饭月报」分享海报（1080×1440，3:4），返回 PNG dataURL */
export function renderStatsPoster(stats: CookingStats, nickname: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1440
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 绘制')

  // 背景
  ctx.fillStyle = BRAND_SOFT
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // ===== 头部 =====
  ctx.fillStyle = BRAND
  roundRect(ctx, 60, 70, 960, 210, 36)
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 76px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('我的做饭月报', 110, 175)

  ctx.font = '30px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  const now = new Date()
  ctx.fillText(`${now.getFullYear()} 年 ${now.getMonth() + 1} 月 · ${nickname || '美食家'}`, 112, 235)

  // 🍚 装饰
  ctx.font = '72px serif'
  ctx.fillText('🍚', 890, 190)

  // ===== KPI 四宫格 =====
  const kpis = [
    { label: '本月做了几顿', value: String(stats.totals.monthCount), unit: '顿' },
    { label: '连续做饭', value: String(stats.streaks.currentStreakDays), unit: '天 🔥' },
    { label: '本月新菜尝试', value: String(stats.thisMonthNewDishes), unit: '道' },
    { label: '平均评分', value: stats.totals.avgRating != null ? stats.totals.avgRating.toFixed(1) : '--', unit: '分 ⭐' },
  ]

  const gridTop = 330
  kpis.forEach((kpi, index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = 60 + col * 490
    const y = gridTop + row * 250

    ctx.fillStyle = '#ffffff'
    roundRect(ctx, x, y, 470, 220, 32)
    ctx.shadowColor = 'rgba(166, 51, 5, 0.08)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 8
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    ctx.fillStyle = INK_SOFT
    ctx.font = '30px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(kpi.label, x + 40, y + 70)

    ctx.fillStyle = BRAND_DEEP
    ctx.font = 'bold 96px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(kpi.value, x + 40, y + 170)

    if (kpi.unit) {
      ctx.font = '34px "PingFang SC", "Microsoft YaHei", sans-serif'
      ctx.fillStyle = INK_SOFT
      ctx.fillText(kpi.unit, x + 40 + ctx.measureText(kpi.value).width * 0 + (kpi.value.length >= 3 ? 300 : 200), y + 165)
    }
  })

  // ===== 最常做的菜 Top3 =====
  const listTop = gridTop + 520
  ctx.fillStyle = INK
  ctx.font = 'bold 44px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText('🏆 最常做的菜', 70, listTop)

  const medals = ['🥇', '🥈', '🥉']
  const top3 = stats.topDishes.slice(0, 3)
  top3.forEach((dish, index) => {
    const y = listTop + 80 + index * 86
    ctx.font = '52px serif'
    ctx.fillText(medals[index] ?? '🏅', 80, y)

    ctx.fillStyle = INK
    ctx.font = 'bold 42px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(dish.title.slice(0, 12), 160, y)

    ctx.fillStyle = INK_SOFT
    ctx.font = '34px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText(`做了 ${dish.count} 次`, 730, y)
  })

  if (top3.length === 0) {
    ctx.fillStyle = INK_SOFT
    ctx.font = '36px "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText('这个月还没有记录，快去做第一顿饭吧！', 90, listTop + 100)
  }

  // ===== 水印底部 =====
  ctx.fillStyle = BRAND
  roundRect(ctx, 60, 1280, 960, 90, 32)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 36px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('开饭 KaiFan · 手机优先的做饭全记录', 540, 1338)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}
