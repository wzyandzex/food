# 开饭 KaiFan

手机优先的「做饭全记录」PWA——找菜谱、记做饭、让别人点菜。产品方案见 [docs/prd-v1.md](docs/prd-v1.md)。

## 仓库结构（monorepo，pnpm workspaces）

```
apps/web        用户端（Next.js PWA：manifest / Service Worker / 语音测试页）
apps/admin      管理端（独立部署：菜谱六渠道导入管线、内容管理）
packages/shared 共享代码（recipe.v1 Zod Schema、领域类型、样例数据）
supabase/       数据库迁移 SQL（对应 PRD §7 数据模型）
docs/           产品方案
```

## 开发

```bash
pnpm install                # 安装依赖
pnpm dev:web                # 用户端 http://localhost:3000
pnpm dev:admin              # 管理端 http://localhost:3001（next dev 自动让端口）
pnpm build                  # 构建全部
pnpm typecheck              # 类型检查
pnpm validate:recipes       # 校验 packages/shared/fixtures 下的样例菜谱
node apps/web/scripts/gen-icons.mjs   # 重新生成 PWA 占位图标
```

环境变量参考 `.env.example`（Supabase M1 接入；管理端密码 M0 占位认证用）。

## M0 已完成

- [x] monorepo 骨架（web / admin / shared）
- [x] recipe.v1 统一 Schema（Zod）+ 样例数据 + 校验脚本
- [x] 用户端 PWA 基础：manifest、图标、离线兜底页、SW 缓存策略
- [x] 语音搜索降级链路测试页（/voice）
- [x] 管理端骨架 + 登录占位 + 六渠道导入管线规划页
- [x] 数据库初始化 SQL（含 RLS 策略）

## 下一步（M1）

Supabase 接入 → 菜谱市场（种子库 + 搜索）→ 做饭记录 → 点单闭环。部署：Vercel Hobby 双项目（用户端/管理端分域）。

## 项目名说明

「开饭」——别人点单、我下厨、菜上桌喊一声「开饭」。备选：小灶 / 一顿 / 灶记。
