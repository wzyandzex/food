import { TabBar } from '@/components/tab-bar'

/** App 外壳：内容区 + 底部 Tab。登录前/分享页在路由组外，不带 Tab。 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      {children}
      <TabBar />
    </div>
  )
}
