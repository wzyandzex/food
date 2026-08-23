import Link from 'next/link'

const PIPELINES = [
  { name: '手动录入', desc: '管理端表单，兜底渠道', milestone: 'M1' },
  { name: 'JSON / XLSX 批量上传', desc: '统一 recipe.v1 Schema，先校验报告再入库', milestone: 'M1' },
  { name: 'URL 单篇导入', desc: '抓取正文 → LLM 抽取 → 人工核对，自动署名', milestone: 'M2' },
  { name: 'LLM 调研生成', desc: '给定菜名清单批量生成，人工抽检', milestone: 'M1' },
  { name: '图片 OCR 导入', desc: '手写/书本菜谱拍照转结构化', milestone: 'M2' },
  { name: '开放数据源', desc: 'TheMealDB 等 CC 授权库脚本化入库', milestone: 'M2' },
]

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">开饭 · 管理端</h1>
          <p className="mt-1 text-sm text-neutral-500">菜谱导入管线与内容管理</p>
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          登录
        </Link>
      </header>

      <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        M0 骨架阶段：登录为占位实现（ADMIN_PASSWORD 环境变量比对），M1 将切换为
        Supabase Auth + 管理员角色 + 中间件强制校验。
      </section>

      <h2 className="mb-4 text-sm font-semibold text-neutral-500">菜谱导入管线（六渠道）</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {PIPELINES.map((pipeline) => (
          <div key={pipeline.name} className="rounded-xl border border-neutral-200 bg-white p-5">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">{pipeline.name}</h3>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                {pipeline.milestone}
              </span>
            </div>
            <p className="text-sm text-neutral-500">{pipeline.desc}</p>
          </div>
        ))}
      </div>

      <footer className="mt-10 text-center text-xs text-neutral-400">
        与用户端 (apps/web) 完全分离部署 · PRD 见 docs/prd-v1.md §4.7
      </footer>
    </main>
  )
}
