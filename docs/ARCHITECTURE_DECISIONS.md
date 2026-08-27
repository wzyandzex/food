# 开饭 KaiFan 架构决策记录 (Architecture Decisions)

本文档记录开饭 KaiFan 系统在工程级升级中做出的关键架构决策与权衡（ADR）。

---

## ADR-001：跨端单一可信契约与状态机收敛

- **背景**：之前 `RecipeStatus`、`OrderSessionStatus` 等状态在数据库、用户端与管理端存在命名不一致（如 draft/pending/published vs open/closed/cooking 等），且无服务层合法流转校验。
- **决策**：将所有状态枚举、合法迁移矩阵（`RECIPE_VALID_TRANSITIONS` / `ORDER_SESSION_VALID_TRANSITIONS`）与迁移校验守卫收敛至 `@kaifan/shared`。任何端（API/Action/Service）在修改实体状态前必须调用合法迁移校验函数，拒绝越权与非法跃迁。
- **后果**：杜绝了前端通过跳步或绕过审核直接发布菜谱的风险。

---

## ADR-002：匿名点单双令牌鉴权与身份模型分离

- **背景**：原实现仅使用 `client_key` 与 `orderer_nickname`，缺乏严格凭证，存在被篡改以及多人昵称混淆的风险。
- **决策**：
  1. **公开 URL Token**：仅用于定位点单会话（`OrderSession`），不携带任何参与者特权。
  2. **Participant Token**：高熵随机生成，本地持久化，服务端仅存储其 SHA-256 Hash（`participant_token_hash`）。
  3. 新增 `OrderParticipant` 领域表，点单明细 `order_entries` 外键关联 `participant_id`。
- **后果**：完全隔离了“查看点单”与“修改他人点单”的权限边界，即使知道点单 URL 也无法越权修改其他食客的数据。

---

## ADR-003：高耗时外部任务全面异步化与两阶段处理

- **背景**：大模型（LLM）批量生成、外部网页抓取抽取、OCR 识别直接在单次 HTTP 请求中同步执行，极易在 Serverless 环境下因网关超时（Vercel 10s~60s）而中断失败。
- **决策**：
  1. 引入 `import_jobs`（主任务表）与 `import_job_items`（子项明细表）。
  2. 请求直接创建任务并返回 `jobId`，后台由批次执行器推进或前端轮询推进。
  3. 支持错误细分类（`TIMEOUT` / `RATE_LIMIT` / `PROVIDER_ERROR` / `SSRF_BLOCKED` 等），支持指数退避重试（Attempt 计数），支持部分成功（`partial_success`）与“仅重试失败项”。
- **后果**：批量导入不再受限于 HTTP 请求时长，失败时支持断点续传与精准重试。

---

## ADR-004：URL 抓取安全防护 (SSRF & DNS Rebinding 防御)

- **背景**：抓取用户提供的菜谱 URL 时，仅对主机名做正则过滤无法防范 DNS 重绑定攻击（攻击者使用公网域名解析至 `127.0.0.1` 或 `169.254.169.254`）。
- **决策**：
  1. 在 Node 层面实现 `safeFetch`，强制执行真实 DNS lookup 解析。
  2. 对解析后的实际物理 IP 进行私网段、环回地址、链路本地与云元数据地址校验。
  3. 手动处理 301/302 重定向，重定向链条中的每个目标均重新执行 IP 白名单过滤与循环限制。
  4. 严格限制响应体体积上限（1MB~5MB）与超时熔断（15s）。
- **后果**：杜绝了以 KaiFan 为跳板探测内网基础设施与云元数据机密的安全风险。

---

## ADR-005：做饭记录历史完整快照隔离

- **背景**：做饭记录（`cook_dishes`）之前仅保存 `snapshot_title` 和封面，当菜谱被修改、用量变更或被软删物理删除时，历史记录失真。
- **决策**：在 `cook_dishes` 增加 `recipe_snapshot JSONB` 字段，快照内容包含：标题、封面、难度、耗时、份量、全部食材（含数量和单位）、步骤与营养估算。读取历史就餐记录时以快照为准。
- **后果**：实现历史就餐记录的不可变性（Immutability）。

---

## ADR-006：管理端信息架构（IA）以运营工作流为中心

- **背景**：原后台首页将 JSON、Excel、LLM、URL、OCR 等功能入口以大卡片形式垂直堆砌在首页，信息密度低，像演示页而非工作台。
- **决策**：建立规范的 7 大一级模块（总览看板、菜谱库、导入任务、审核中心、用户、数据监控、系统设置）。首页专注于数据指标、待办预警与健康度；导入功能收敛于导入中心的工作区中。
- **后果**：操作路径缩短，信息密度提升，符合专业运营后台的使用习惯。
