# 开饭 KaiFan 异步任务与执行队列规范 (Job System)

本文档定义 KaiFan 异步任务系统（ImportJob Pipeline）的模型设计、重试退避策略、超时熔断与错误分类体系。

---

## 1. 架构目标与设计原则

1. **摆脱 HTTP 同步阻塞**：所有高耗时大模型批量生成、URL 网页抓取、OCR 图片识别与大批量数据导入均异步化，彻底消除 Vercel Serverless Function 504 网关超时风险。
2. **两阶段生命周期（Import -> Review -> Publish）**：
   - 任务后台将标准化数据写入 `pending`（待审核暂存区）。
   - 人工在管理端审核中心确认后，正式上线 `published`。
3. **部分成功容错与单项重试**：当 20 道菜中仅 2 道因第三方模型限流失败时，任务标记为 `PARTIAL_SUCCESS`，支持在后台“仅重试失败项”。

---

## 2. 状态机与流转模型

```text
[PENDING] ──> [RUNNING] ──┬──> [SUCCEEDED] (所有子项均成功)
                          ├──> [PARTIAL_SUCCESS] (部分成功，部分达最大重试上限)
                          ├──> [FAILED] (所有子项均失败)
                          └──> [CANCELED] (人工取消)
```

---

## 3. 错误分类体系 (JobErrorCode)

| 错误代码 | 触发场景 | 是否可重试 | 重试策略 |
|:---|:---|:---:|:---|
| `RATE_LIMIT` | 大模型 API 报 429 或并发超限 | 是 | 指数退避 (2s, 4s, 8s) + Jitter |
| `TIMEOUT` | 模型响应耗时超过 55s 或 URL 抓取超过 15s | 是 | 增加单次尝试计数，重试最多 3 次 |
| `NETWORK` | 上游连接重置或网络抖动 | 是 | 立即重试或退避 1s |
| `PROVIDER_ERROR` | LLM 返回 500/502/503 | 是 | 退避重试 |
| `SSRF_BLOCKED` | URL 包含私网 IP 或重绑定风险 | **否** | 立即终止，记录安全事件 |
| `SCHEMA_ERROR` | 模型输出未能通过 `recipe.v1` 校验且自动纠错失败 | **否** | 终止并记录校验差异 |
| `CONTENT_ERROR` | 目标网页不包含菜谱文本或图片无法解码 | **否** | 终止并提示人工核对 |

---

## 4. 任务推进与批次执行器 (Job Runner)

- **调度接口**：`POST /api/jobs`
  - `action='create'`：创建任务并初始化所有子项，触发前置首批执行。
  - `action='process'`：拉取待执行子项推进下一批次（默认 BatchSize = 3）。
  - `action='retry_failed'`：将指定任务下所有失败子项重置为 `pending`，清空错误信息，重新排队执行。
