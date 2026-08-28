import Link from 'next/link'

export const metadata = { title: '离线' }

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-8 text-center">
      <p className="text-[44px] mb-3">📵</p>
      <h1 className="text-[20px] font-bold text-ink">当前处于离线状态</h1>
      <p className="mt-2 mb-6 text-[13px] leading-5.5 text-ink-2">
        网络连接不可用。之前浏览过的菜谱仍可离线查看；联网后将自动恢复同步。
      </p>
      <Link href="/" className="btn-tonal w-auto px-6 py-2.5 text-[14px]">
        返回首页
      </Link>
    </main>
  )
}
