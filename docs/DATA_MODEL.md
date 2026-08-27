# 开饭 KaiFan 领域数据模型规范 (Data Model)

本文档定义开饭 KaiFan 的核心领域实体、表关系、字段约束与快照规范。

---

## 1. 实体关系全景 (ER Overview)

```text
Profiles (用户档案)
  │
  ├── 1:N ── Recipes (菜谱资产)
  │            ├── 1:N ── RecipeIngredients (菜谱-食材关联) ──> Ingredients (标准化词库)
  │            └── 1:N ── Collections (收藏)
  │
  ├── 1:N ── CookSessions (做饭记录「顿」- 核心聚合根)
  │            └── 1:N ── CookDishes (菜品明细，含完整 RecipeSnapshot 快照)
  │
  └── 1:N ── OrderSessions (点单会话)
               ├── 1:N ── ShareTokens (公开分享短链)
               ├── 1:N ── OrderParticipants (匿名/实名参与者)
               └── 1:N ── OrderEntries (点单明细项，唯一键: session_id + client_key)

ImportJobs (异步导入任务主表)
  └── 1:N ── ImportJobItems (子任务明细，含 Attempt、状态与错误归因)

AdminAuditLogs (操作审计留痕，只追加)
```

---

## 2. 核心数据表详细定义

### 2.1 Recipes（菜谱表）
- `id` (uuid, PK)
- `title` (text, not null, GIN trgm 索引)
- `cover_url` (text, nullable)
- `source_type` (text: manual / json / xlsx / url / llm / ocr / open_data / user)
- `source_url` (text, nullable): 外部抓取时保留原文署名
- `servings` (int, 默认 2)
- `difficulty` (int, 1-5 星)
- `minutes` (int, 烹饪总耗时)
- `tags` (text[], GIN 索引)
- `steps` (jsonb, [{ step, text, tip, timerMinutes }])
- `status` (text: draft / processing / pending / approved / published / rejected / offline / archived / failed)
- `deleted_at` (timestamptz, 软删除标记)
- `derived_from` (uuid, FK recipes.id): 改编/Fork 溯源

### 2.2 CookDishes 与 RecipeSnapshot（做饭明细与历史快照）
- `id` (uuid, PK)
- `session_id` (uuid, FK cook_sessions.id)
- `recipe_id` (uuid, FK recipes.id, `ON DELETE SET NULL`)
- `snapshot_title` (text, 兜底标题)
- `snapshot_cover` (text, 兜底封面)
- `recipe_snapshot` (jsonb, 核心快照):
  ```json
  {
    "id": "uuid",
    "title": "回锅肉",
    "servings": 2,
    "difficulty": 2,
    "minutes": 35,
    "ingredients": [
      { "name": "五花肉", "qty": 300, "unit": "g" },
      { "name": "青蒜", "qty": 100, "unit": "g" }
    ],
    "steps": [ ... ],
    "snapshotAt": "2026-08-28T02:00:00.000Z"
  }
  ```
- `photos` (text[], 做饭成品照片数组)
- `adjust_note` (text, 咸淡用量复盘备忘)

### 2.3 OrderParticipants（匿名参与者模型）
- `id` (uuid, PK)
- `order_session_id` (uuid, FK order_sessions.id)
- `participant_token_hash` (text, not null)
- `nickname` (text, not null)
- `user_id` (uuid, nullable, FK profiles.id): 渐进式登录归并
- `last_seen_at` (timestamptz)
- 约束：`unique(order_session_id, participant_token_hash)`

### 2.4 ImportJobs & ImportJobItems（异步任务模型）
- **`import_jobs`**：
  - `id` (uuid, PK)
  - `type` (text: json / xlsx / url / llm_batch / ocr / open_data)
  - `status` (text: pending / running / succeeded / partial_success / failed / canceled)
  - `total` / `completed` / `succeeded` / `failed` (int)
  - `payload` (jsonb)
- **`import_job_items`**：
  - `id` (uuid, PK)
  - `job_id` (uuid, FK import_jobs.id)
  - `input` (jsonb)
  - `status` (text: pending / running / succeeded / failed / canceled)
  - `attempt` (int, 当前重试次数)
  - `max_attempts` (int, 上限 3)
  - `error_code` (text: TIMEOUT / RATE_LIMIT / PROVIDER_ERROR / SSRF_BLOCKED 等)
  - `error_message` (text)
  - `recipe_id` (uuid, FK recipes.id)
