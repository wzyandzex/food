export const metadata = { title: '离线' }

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-8 text-center">
      <div className="mb-4 text-5xl">📵</div>
      <h1 className="mb-2 text-xl font-bold">当前离线</h1>
      <p className="text-sm leading-6 text-ink/60">
        网络不可用。之前浏览过的菜谱和页面仍可离线查看；
        新的做饭记录会在联网后自动同步。
      </p>
    </main>
  )
}
