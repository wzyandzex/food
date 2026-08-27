# 开饭 KaiFan 安全审计与防护规范 (Security Audit)

本文档系统性梳理开饭系统在认证、鉴权、权限策略、网络安全与数据边界方面的设计与整改。

---

## 1. 认证与敏感凭证安全

### 1.1 Supabase Key 隔离策略
- **浏览器端 / 客户端**：仅允许加载 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，使用该 Key 仅能触发数据库 RLS 允许的公开或用户自管查询。
- **服务端 / Route Handlers**：统一在 Node 运行时内部读取 `SUPABASE_SERVICE_ROLE_KEY`。严禁将该密钥添加 `NEXT_PUBLIC_` 前缀，严禁打入前端 JS Bundle。
- **动态系统设置与 AI API Key**：
  - 管理端存储在 `system_settings` 表中，该表 RLS 默认全拒（除 service_role 外任何角色不可读）。
  - 前端回显时自动掩码（Masking，如 `sk-******abcd`），禁止在控制台或普通客户端接口明文返回。

### 1.2 管理端鉴权与会话
- **HttpOnly Cookie 验证**：管理端采用强 Cookie 隔离机制（`kaifan_admin`），防止 XSS 窃取。
- **中间件守护**：`apps/admin/src/middleware.ts` 对所有受限后台路由进行拦截，未通过身份验证直接跳转登录。
- **操作审计日志 (`admin_audit_logs`)**：对管理员的发布、驳回、修改配置、创建/重试任务进行结构化留痕（记录 Actor、Action、IP 与时间戳）。

---

## 2. 匿名点单与参与者越权防护

- **身份解耦**：将 URL 分享凭证与参与者身份凭证彻底解耦。
- **高熵 Token 与哈希存储**：食客客户端生成的 `participantToken` 采用 128-bit 高熵随机串，服务端只持久化其 SHA-256 哈希值。
- **只读锁定与截止时间竞争**：
  - 当点单状态非 `open` 或当前服务器时间超过 `deadline` 时，服务端接口原子级拒绝写入。
  - 杜绝截单后通过并发请求继续篡改订单。

---

## 3. URL 抓取与 SSRF 深度防护

所有用户提交的外部 URL（如菜谱网页导入）必须经过 `safeFetch` 处理，执行多层防御：
1. **协议白名单**：仅允许 `http:` 与 `https:`，禁止 `file:`、`gopher:` 等危险协议。
2. **DNS 真实解析**：通过 `dns.lookup` 获取域名解析的所有目标 IP。
3. **私网与保留网段拦截**：
   - `127.0.0.0/8`（回环）
   - `10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`（内网私有地址）
   - `169.254.0.0/16`（云厂商元数据服务，如 AWS/GCP/Aliyun Instance Metadata）
   - `::1`、`fe80::/10`、`fc00::/7`（IPv6 私有/链路本地）
4. **重定向逐级审查**：禁止无脑跟随重定向（防止目标域名 302 跳入内网地址），每跳均重复执行 IP 校验。
5. **体积与超时熔断**：单次响应体上限 1MB~5MB，超时强制设为 15s，防止慢速 DoS 攻击。

---

## 4. 数据库 Row Level Security (RLS) 矩阵

| 数据表 | SELECT | INSERT | UPDATE | DELETE | 关键隔离维度 |
|:---|:---|:---|:---|:---|:---|
| `profiles` | 公开/已登录 | 本人绑定 | 本人更新 | 禁止 | `id = auth.uid()` |
| `recipes` | 已发布(`published`)且未删除 | 登录作者 | 仅作者可更新 | 软删保留历史 | `author_id = auth.uid()` |
| `recipe_ingredients` | 所有人(随菜谱可读) | 仅作者/ServiceRole | 仅作者/ServiceRole | 级联清除 | `recipe_id` |
| `cook_sessions` | 仅本人 | 仅本人 | 仅本人 | 仅本人 | `user_id = auth.uid()` |
| `cook_dishes` | 仅本人 | 仅本人 | 仅本人 | 仅本人 | 校验父级 `session_id` 所有权 |
| `order_sessions` | 公开(凭Token) / 发起人 | 发起人 | 发起人 | 发起人 | `host_id = auth.uid()` |
| `order_participants` | ServiceRole / 凭Token | 匿名或用户 | 本人Token更新 | 禁止 | `participant_token_hash` |
| `order_entries` | 凭Token只读 / 发起人 | 对应参与者 | 对应参与者(截单前) | 禁止 | `(session_id, client_key)` |
| `system_settings` | 仅 ServiceRole | 仅 ServiceRole | 仅 ServiceRole | 禁止 | 管理员后台走服务端代管 |
| `admin_audit_logs` | 仅 ServiceRole | 仅 ServiceRole | 禁止更新 (只追加) | 禁止物理删除 | 审计留痕只写不可篡改 |
