# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: single-context

- **`CONTEXT.md`** at the repo root (created lazily via `/domain-modeling` when terms get resolved).
- **`docs/adr/`** — ADRs at the repo root (created lazily when decisions get made).

If these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

The authoritative product spec is **`docs/prd-v1.md`** — its language (顿、点单、菜谱市场、两段式导入 等) is the project's domain vocabulary.

## Before exploring, read these

- **`docs/prd-v1.md`** — product spec and domain vocabulary.
- **`CONTEXT.md`** at the repo root, if it exists.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `docs/prd-v1.md` / `CONTEXT.md`. Don't drift to synonyms.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
