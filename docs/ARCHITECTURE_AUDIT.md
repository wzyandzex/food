# 开饭 KaiFan 系统级架构审计报告 (Architecture Audit)

> **审计执行日期**：2026-08-28  
> **审计模式**：只读静态代码分析 + 数据库模式与 RLS 审计 + 请求链路全景追踪 + 安全与并发边界测试  
> **系统定位**：手机优先的做饭记录 / 菜谱 / 点单 PWA + 现代化运营后台工作台

---

## 1. 项目拓扑与模块结构

```
E:\.food
├── apps/
│   ├── web/                     # 终端用户 PWA (Next.js 15.5 App Router + React 19 + Tailwind v4 + WebPush)
│   │   ├── src/app/             # 路由层：菜谱浏览、点单(/o/[token])、做饭记录、排餐、圈子、个人中心
│   │   ├── src/components/      # UI 组件与 AuthProvider、PWA 注册
│   │   └── src/lib/             # Supabase 客户端封装 (Anon vs ServiceRole)、WebPush 工具
│   └── admin/                   # 运营管理后台 (Next.js 15.5 App Router + React 19 + Tailwind v4 + xlsx)
│       ├── src/app/             # 路由层：看板、菜谱管理、导入中心、审核、系统设置
│       ├── src/components/      # 后台布局、导入器组件、审核组件
│       └── src/lib/             # 管理端 Supabase 客户端封装、AI 调用适配器
├── packages/
│   └── shared/                  # 跨端共享契约包 (@kaifan/shared)
│       ├── src/domain.ts        # 领域模型、状态枚举、常量定义
│       ├── src/schema/          # Zod 严格校验模式 (recipe.v1)
│       ├── src/date.ts          # 时区与格式化工具
│       └── src/samples.ts       # 离线降级样本数据
├── supabase/
│   └── migrations/              # PostgreSQL 增量迁移脚本 (0001_init.sql ~ 0006_system_settings.sql)
└── docs/                        # PRD 与工程设计规范文档
```

---

## 2. 12 条核心业务链路追踪矩阵

| # | 业务链路 | 交互起点 (UI) | 处理网关 (API/Action) | 核心领域逻辑 (Service) | 数据持久层 (Repository/DB) | 外部服务 (External) |
|---|---|---|---|---|---|---|
| 1 | **用户注册/登录** | `apps/web/src/app/login` | `POST /api/auth/register` | 邀请码校验与递增、用户 Profile 初始化 | `invite_codes`, `profiles`, `auth.users` | Supabase GoTrue Auth |
| 2 | **菜谱列表查询** | `apps/web/src/app/recipes/page.tsx` | RSC 服务端直接检索 | 状态过滤(`published`)、未删除、标签筛选、降级容灾 | `recipes` (GIN 索引) | 无 |
| 3 | **菜谱详情查询** | `apps/web/src/app/recipes/[id]/page.tsx` | RSC 服务端直接检索 | 关联食材多对一聚合、改编溯源(`derived_from`) | `recipes`, `recipe_ingredients`, `ingredients` | 无 |
| 4 | **创建点单会话** | `apps/web/src/app/orders/new` | `POST /api/orders/create` | 截止时间校验、16字节随机Token生成、圈子成员批量通知 | `order_sessions`, `share_tokens`, `notifications` | Web Push Service |
| 5 | **公开Token点单** | `apps/web/src/app/o/[token]/page.tsx` | RSC 动态解析会话 | Token生命周期与过期检测、截单锁定只读切换 | `share_tokens` -> `order_sessions` | 无 |
| 6 | **匿名提交点单** | `apps/web/src/app/o/[token]/page.tsx` | `POST /api/orders/submit` | clientKey 匿名身份持久化、重复提交更新幂等、首次提交推送发起人 | `order_entries` (唯一键: session_id + client_key) | Web Push Service |
| 7 | **做饭记录与评分** | `apps/web/src/app/cook/new/page.tsx` | `POST /api/upload/photo` & `POST /api/cook-logs` | 图片格式校验/上传、菜谱快照抗删隔离、顿记录归档 | `cook_sessions`, `cook_dishes`, Storage(`food-photos`) | Supabase Storage |
| 8 | **管理端导入(JSON/Excel)** | `apps/admin/src/app/page.tsx` (旧) | `POST /api/recipes/import(-excel)` | xlsx 解析、Zod Schema 校验、两段式事务入库与异常补偿回滚 | `recipes`, `ingredients`, `recipe_ingredients` | 无 |
| 9 | **LLM 批量生成** | `apps/admin/src/app/page.tsx` (旧) | `POST /api/recipes/generate-llm` | 动态读取系统配置、统一 Prompt 提示词、JSON Mode 校验、存入待审 | `system_settings`, `recipes` (`status='pending'`) | OpenAI / DeepSeek / GLM |
| 10 | **URL 抓取+AI抽取** | `apps/admin/src/app/page.tsx` (旧) | `POST /api/recipes/import-url` | 主机白名单过滤、HTML 正文清洗、大模型结构化抽取、来源署名 | `recipes` (`status='pending'`) | 目标网站 HTTP + LLM API |
| 11 | **OCR 图片识别** | `apps/admin/src/app/page.tsx` (旧) | `POST /api/recipes/import-image` | Base64 编码、多模态 Vision 识别、JSON 校验入库 | `recipes` (`status='pending'`) | GLM-4V / 多模态模型 |
| 12 | **审核与正式发布** | `apps/admin/src/app/review/page.tsx` | `POST /api/recipes/review` | 状态机流转(`pending` -> `published` / `reject`级联清理) | `recipes`, `recipe_ingredients` | 无 |

---

## 3. 核心风险与工程缺陷审计清单 (P0 ~ P2)

### 🔴 P0 级严重缺陷

1. **异步任务系统缺失（AI 同步阻塞与超时熔断风险）**：
   * **现状**：LLM 批量生成、URL 抽取、OCR 识别均在单次 HTTP 请求中同步处理。
   * **危害**：在 Serverless 环境下（如 Vercel 免费版 10~60s 限制），大批量菜谱（如 20 道菜）或模型延迟稍高就会导致网关 504 超时、前端报错、数据丢失。
   * **修复方案**：引入 `ImportJob` 与 `ImportJobItem` 异步任务表，提供后台 Worker、进度轮询、超时重试（退避+Jitter）、部分成功与单项重试机制。

2. **匿名点单身份标识单一与越权风险**：
   * **现状**：虽有 `client_key`，但未形成完备的匿名参与者令牌哈希与权限隔离机制，缺乏高熵 `participant_token` 双向验证，查询时容易混淆。
   * **修复方案**：建立 `order_participants` 领域模型，将 URL 分享 Token（定位会话）与 Participant Token（定位并鉴权具体参与者）严格分离。

3. **URL 抓取存在 DNS 重绑定 SSRF 漏洞**：
   * **现状**：`import-url/route.ts` 仅对 Host 字符串字面量做了正则过滤，未进行实际 DNS 解析校验与重定向跟踪校验。
   * **危害**：攻击者可通过绑定内网 IP（如 `127.0.0.1`、`169.254.169.254`）的公网域名发起请求，刺探内部网络。
   * **修复方案**：在 Node 层面进行 DNS 解析验证，过滤私有 IP / 环回地址 / 链路本地地址，并在重定向链条中逐级校验。

4. **状态机定义不统一与缺乏合法迁移防护**：
   * **现状**：`RecipeStatus`、`OrderSessionStatus`、`CookSessionStatus` 在前端、数据库、后端各处定义存在偏差（如缺少 `DRAFT`, `REVIEW_PENDING`, `ARCHIVED`, `PROCESSING`, `PARTIAL_SUCCESS` 等状态）。
   * **危害**：非法状态穿透（例如直接从草稿跳过审核发布，或已关闭的点单被强行写入）。
   * **修复方案**：在 `@kaifan/shared` 建立唯一可信的状态机与合法迁移守卫（State Transition Guards），服务层强校验。

5. **历史可回溯性不足（CookDish 快照字段不全）**：
   * **现状**：`cook_dishes` 仅存储了 `snapshot_title` 和 `snapshot_cover`，缺少食材明细、用量、步骤、份量快照。
   * **危害**：当母本菜谱后续被编辑或删除后，无法还原当年做这顿饭时的具体配方。
   * **修复方案**：为 `cook_dishes` 和 `cook_sessions` 增加完整 `recipe_snapshot JSONB` 结构。

---

### 🟡 P1 级重要问题

1. **管理端信息架构（IA）过于扁平，功能入口堆砌在首页**：
   * **现状**：首页堆叠了 JSON、Excel、LLM、URL、OCR、AI 配置等全部大卡片，缺乏统一的侧边栏、工单流转、独立审核中心和系统设置。
   * **修复方案**：重构为 7 大一级模块（总览、菜谱、导入任务、审核、用户、数据、系统），首页升级为真正的运营 Dashboard 看板。
2. **管理端缺乏敏感操作审计日志 (AdminAuditLog)**：
   * **现状**：批量导入、发布、驳回、修改系统配置没有留痕。
   * **修复方案**：新增 `admin_audit_logs` 表，记录操作人、操作动作、资源类型、资源ID、变更前后元数据。
3. **文件上传安全性校验需强化**：
   * **现状**：直接依赖请求头或扩展名，未对图片尺寸、魔法字节/MIME 真实性做二次验证。
   * **修复方案**：服务端校验文件头 Magic Bytes、文件体积上限、随机重命名 UUID 存储路径。

---

## 4. 架构整改与迁移路径图

```
Phase 0 (完成) ────> Phase 1 (P0 安全/数据/状态机/SSRF/快照) 
                             │
                             ▼
                     Phase 2 (异步任务系统 ImportJob + Retry)
                             │
                             ▼
                     Phase 3 (管理端 7 大模块 IA 彻底重构)
                             │
                             ▼
                     Phase 4 (高信息密度 UI + 设计规范对齐)
                             │
                             ▼
                     Phase 5 (全套测试验证 + 生成验收终报)
```
