export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  url: string | null
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  order_arrived: '🍲 新点单',
  order_status: '👨‍🍳 状态变更',
  circle_order: '👥 圈内点单',
  circle_memory_published: '🍚 餐桌档案',
  circle_memory_contribution: '📷 餐桌记录',
  order_deadline: '⏰ 截单提醒',
  system: '📣 系统',
}
