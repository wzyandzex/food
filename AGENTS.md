# 开饭 KaiFan

手机优先的「做饭全记录」PWA。pnpm monorepo:`apps/web`(用户端)、`apps/admin`(管理端)、`packages/shared`(共享 schema/fixtures)。产品规格见 `docs/prd-v1.md`。

## Agent skills

### Issue tracker

Issues 使用 GitHub Issues(`gh` CLI),外部 PR 不作为 triage 入口。见 `docs/agents/issue-tracker.md`。

### Triage labels

使用五个默认标签:`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

单一上下文:根目录 `CONTEXT.md` + `docs/adr/`(按需创建,不预建)。见 `docs/agents/domain.md`。
