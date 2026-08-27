# 开饭 KaiFan 数据库迁移与升级方案 (Migration Plan)

本文档规划并记录 KaiFan 数据库演进规范、可回滚设计、双轨兼容与发布执行方案。

---

## 1. 迁移执行原则与安全边界

1. **版本化脚本**：所有数据库表结构、函数或索引变更必须提交为 `supabase/migrations/` 下严格递增的 `.sql` 脚本，禁止在生产控制台随意手动修改而不留版本代码。
2. **渐进式演进（Expand -> Migrate -> Contract）**：
   - 第一阶段（Expand）：新增非空字段必须提供默认值或允许 NULL（如本次 `recipe_snapshot`、`participant_id`、`raw_name`）。
   - 第二阶段（Migrate）：部署双写与双读代码，对历史记录进行平滑适配。
   - 第三阶段（Contract）：废弃过时逻辑，确保零中断。
3. **回滚友好**：所有 `CREATE TABLE` / `ALTER TABLE` 均使用 `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`。

---

## 2. 0007 升级迁移详细清单 (`0007_p0_architecture_upgrade.sql`)

### 2.1 新增表与索引
1. `ingredient_aliases`：食材同义词映射表，支持“西红柿”与“番茄”别名归一。
2. `order_participants`：匿名/实名点单参与者，建立 `(order_session_id, participant_token_hash)` 唯一复合索引。
3. `import_jobs`：异步任务主表，建立 `(status, created_at desc)` 复合索引以加速排队扫描。
4. `import_job_items`：任务明细表，建立 `(job_id, status)` 索引以加速批次任务读取。
5. `admin_audit_logs`：管理员操作审计日志表，建立 `(actor_id, created_at desc)` 与 `(resource_type, resource_id)` 索引。

### 2.2 存量表平滑字段扩展
1. `cook_dishes` 扩充 `recipe_snapshot jsonb`：支持存入完整配方快照，历史就餐记录读取时若 snapshot 为空则自动从原母本动态拼装，保证新老数据 100% 兼容。
2. `order_entries` 扩充 `participant_id uuid`：关联匿名参与者，同时保留 `client_key` 维持前端免登录兼容。
3. `recipe_ingredients` 扩充 `raw_name text`：记录导入时的原始食材名。

---

## 3. 部署与验证执行步骤

```bash
# 1. 验证迁移脚本语法无误
pnpm db:check # 或 supabase db diff

# 2. 推送迁移至远端 PostgreSQL / Supabase
supabase db push

# 3. 运行跨端自动化类型检查与单元测试
pnpm -r typecheck
node --test packages/shared/src/domain.test.ts
```
