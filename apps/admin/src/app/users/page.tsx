import { getAdminClient } from '@/lib/supabase'
import { Users, UserCheck, KeyRound } from 'lucide-react'

interface UserItem {
  id: string
  nickname: string
  role: string
  created_at: string
  invite_code_used?: string | null
}

async function fetchUsers(): Promise<UserItem[]> {
  try {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname, role, created_at, invite_code_used')
      .order('created_at', { ascending: false })
      .limit(50)

    return (data as UserItem[]) || []
  } catch {
    return []
  }
}

export default async function UsersManagementPage() {
  const users = await fetchUsers()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">用户与准入管理</h1>
        <p className="text-sm text-neutral-500 mt-1">
          亲友圈用户档案、角色权限分级与邀请码准入管理
        </p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="text-xs font-semibold text-neutral-700">注册用户总数 ({users.length})</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-100 text-neutral-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3 font-semibold">用户昵称</th>
                <th className="px-4 py-3 font-semibold">角色</th>
                <th className="px-4 py-3 font-semibold">所用邀请码</th>
                <th className="px-4 py-3 font-semibold">注册时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-neutral-400">
                    暂无用户数据
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-neutral-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold">
                        {u.nickname.slice(0, 1)}
                      </div>
                      <span>{u.nickname}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          u.role === 'admin'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-neutral-500">
                      {u.invite_code_used || '系统初始化'}
                    </td>
                    <td className="px-4 py-3.5 text-neutral-400">
                      {new Date(u.created_at).toLocaleString('zh-CN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
