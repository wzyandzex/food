import { getAdminClient } from '@/lib/supabase'

export interface AuditLogInput {
  actorId?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

/**
 * 记录管理端重要操作审计日志 (AdminAuditLog)
 */
export async function logAdminAction(input: AuditLogInput): Promise<void> {
  try {
    const supabase = getAdminClient()
    await supabase.from('admin_audit_logs').insert({
      actor_id: input.actorId || null,
      action: input.action,
      resource_type: input.resourceType,
      resource_id: input.resourceId || null,
      metadata: input.metadata || {},
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
    })
  } catch (err) {
    // 审计日志写入异常不应中断主业务，但打出警告
    console.warn('[AdminAudit] 写入审计日志异常:', err)
  }
}
