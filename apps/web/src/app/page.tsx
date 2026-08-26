import Link from 'next/link'

const MODULES = [
  {
    title: '菜谱市场',
    desc: '搜索、语音提问、收藏与自建菜谱',
    status: 'M1',
  },
  {
    title: '做饭记录',
    desc: '一顿多菜、拍照、复盘笔记',
    status: 'M1',
  },
  {
    title: '点单',
    desc: '分享链接免登录点菜、缺失食材清单',
    status: 'M1',
  },
]

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-12 pb-10">
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-brand text-3xl shadow-sm">
            🍚
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">开饭</h1>
            <p className="text-sm text-ink/60">找菜谱 · 记做饭 · 让别人点菜</p>
          </div>
        </div>
      </header>

      <section className="mb-8 rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm leading-6 text-ink/80">
          M0 骨架已就绪。iPhone 上用 Safari 打开本页，点分享 →
          <span className="font-semibold text-brand">「添加到主屏幕」</span>
          ，即可像原生 App 一样全屏使用。
        </p>
      </section>

      <section className="mb-8 space-y-3">
        {MODULES.map((module) => {
          const isAvailable = module.title === '菜谱市场'
          const CardContent = (
            <div
              className={`block rounded-2xl bg-white p-5 shadow-sm ${
                isAvailable ? 'active:scale-[0.99]' : 'cursor-default opacity-80'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-semibold">{module.title}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isAvailable
                      ? 'bg-brand-soft text-brand-deep'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  {isAvailable ? '已上线' : `${module.status} 即将上线`}
                </span>
              </div>
              <p className="text-sm text-ink/60">{module.desc}</p>
            </div>
          )

          return isAvailable ? (
            <Link key={module.title} href="/recipes">
              {CardContent}
            </Link>
          ) : (
            <div key={module.title}>{CardContent}</div>
          )
        })}
      </section>

      <Link
        href="/voice"
        className="rounded-2xl bg-brand px-5 py-4 text-center font-semibold text-white shadow-sm active:scale-[0.99]"
      >
        🎙️ 语音搜索能力测试（M0 验证）
      </Link>

      <footer className="mt-10 text-center text-xs text-ink/40">
        开饭 KaiFan · 方案见 docs/prd-v1.md
      </footer>
    </main>
  )
}
