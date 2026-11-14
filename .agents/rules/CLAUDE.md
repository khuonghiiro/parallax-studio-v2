# AgentKit & Claude Engineer Context (Parallax Studio V2)

This file is the contract for AI Agents working in this repository. Keep it short. Load the linked rule and architecture files when the current task needs them.

## Core Rules

- **Single Source of Truth:** Always follow [AGENTS.md](../../AGENTS.md) first.
- Optimize for the user's workflow: clear prompts, useful errors, real implementation, no performative ceremony — and document assumptions clearly at the end of the report when working autonomously.
- Before implementation, read `README.md` plus relevant project architecture docs in `docs/architecture/` (`gizmo-and-assembly-3d.md`, `layer-assembly-and-rigging.md`, `workflow-v2-and-timeline.md`).
- Preserve secrets and private files. Never work around privacy hooks or commit credentials.
- Use the repo's existing patterns, commands (`pnpm verify`, `pnpm test`, `pnpm pxs`), and public contracts before inventing new ones.
- Prefer small, focused changes. Keep files ≤ 1000 lines (proactively split at 500–600 lines) and functions ≤ 80 lines.

## On-Demand Rule References (`./.agents/rules/`)

- Implementation, MCP parity, and verification: [`./development-rules.md`](./development-rules.md)
- Multi-device responsive 4 breakpoints & anti-empty desert: [`./responsive-standard.md`](./responsive-standard.md)
- Dynamic manifest assets & soft-delete trash: [`./manifest-assets.md`](./manifest-assets.md)
- Autonomous mode & safety guardrails: [`./autonomous-mode.md`](./autonomous-mode.md)
- Live Electron process non-interference: [`./process-management.md`](./process-management.md)
- Feature/debug workflow shape: [`./primary-workflow.md`](./primary-workflow.md)
- Subagents or teams: [`./orchestration-protocol.md`](./orchestration-protocol.md)
- Plans and docs: [`./documentation-management.md`](./documentation-management.md)
- Review, audit, or scope cuts: [`./review-audit-self-decision.md`](./review-audit-self-decision.md)

## Key Project Skills (`./.agents/skills/`)

- Instant UI source locator (`Win + Alt` / `Win + Ctrl`): [`../skills/ai-ui-inspector/SKILL.md`](../skills/ai-ui-inspector/SKILL.md)
- Targeted MCP UI screenshot regions: [`../skills/mcp-ui-region/SKILL.md`](../skills/mcp-ui-region/SKILL.md)
- Dynamic asset manifests & trash recovery: [`../skills/manifest-assets/SKILL.md`](../skills/manifest-assets/SKILL.md)
- Session-driven Git branching & Vietnamese commits: [`../skills/ak-git/SKILL.md`](../skills/ak-git/SKILL.md)
- Vanilla CSS Tokens, Dual-Theme & Custom Controls: [`../skills/ak-ui-styling/SKILL.md`](../skills/ak-ui-styling/SKILL.md)
