---
name: ak:play
description: >
  Marketing playbook orchestrator with dependency-graph routing, quality gates,
  goal tracking, and suggestions based on recorded state.
  Triggers: /ak:play, playbook, campaign playbook, product discovery playbook,
  founder or product owner workflow, validate an idea, what's next, play status.
user-invocable: true
when_to_use: "Invoke to run the marketing or product-discovery playbook orchestrator and its dependency-graph routing."
category: workflow
keywords: [playbook, orchestrator, routing, gates, marketing, product-discovery]
argument-hint: "[create|next|status|list|blocked|learn|reset|gate|templates|goals] [args]"
metadata:
  author: agentkit
  version: "1.1.0"
---

# Play — Marketing Playbook Orchestrator

Execute marketing playbooks through verified artifacts, dependency transitions, and explicit quality gates.

<args>$ARGUMENTS</args>

## Scope

This skill handles: playbook orchestration, template management, goal tracking, dependency routing, quality gates.
Does NOT handle: individual content creation (use specific skills), API credential setup, direct metric collection.

## Workflow

1. **Parse** — extract subcommand + args from `$ARGUMENTS`
2. **Route** — load corresponding `references/{subcommand}.md`
3. **Load State** — read `data/playbooks/{slug}/manifest.json`
4. **Evaluate Graph** — `scripts/graph.cjs` determines ready/blocked/stale steps
5. **Check Goals** — `scripts/goals.cjs` pulls metrics, compares to targets
6. **Smart Suggest** — `scripts/smart-suggest.cjs` surfaces goal-aligned actions
7. **Execute** — resolve the step's command/agent/skill from the live installed catalog, honor its explicit gate, and execute only authorized effects.
8. **Update State** — write manifest with step status, outputs, timestamps

If no subcommand: show dashboard (all playbooks status).
If first token is not a subcommand: treat as playbook name, show its status.

## Entry Points

| Subcommand | Reference |
|---|---|
| `create <name> [--template <id>]` | `references/create.md` |
| `next [name]` | `references/next.md` |
| `status [name]` | `references/status.md` |
| `list` | `references/list.md` |
| `blocked [name]` | `references/blocked.md` |
| `learn [name]` | `references/learn.md` |
| `reset <name> [step]` | `references/reset.md` |
| `gate <name> <step> approve\|reject` | `references/gate.md` |
| `templates [--browse]` | `references/templates.md` |
| `goals [set\|pull]` | `references/goals.md` |

## Scripts

| Script | Purpose |
|---|---|
| `scripts/manifest.cjs` | Playbook state CRUD |
| `scripts/graph.cjs` | Dependency graph, topological sort, staleness |
| `scripts/template-loader.cjs` | Load/validate templates |
| `scripts/goals.cjs` | Goal tracking + trend display |
| `scripts/metrics-bridge.cjs` | Bridge to existing GA4/GSC/Stripe skills |
| `scripts/smart-suggest.cjs` | Goal-gap → step mapping |

## Templates

Each step has three layers: `strategy` (expert reasoning), `ai_execution` (AI acceleration), `human_decision` (human judgment).

Bundled: `product-discovery`, `product-hunt-launch`, `content-engine`, `campaign-sprint`, `saas-launch` in `templates/`.

`product-discovery` is the founder / Product Owner entry point, running from market
and audience evidence through positioning and a falsifiable demand test to a
decision record. Its publish and spend steps sit behind `human-approval`, its
direction calls behind `founder-decision`.
Schema: `templates/_schema.json`. Future: MCP server for community templates.

## State

Manifest at `data/playbooks/{slug}/manifest.json` tracks:
- Step statuses: pending → in-progress → completed (or gate-pending, blocked, stale)
- Goal targets + current values + trends
- Learnings captured from completed steps
- Template source + version for reproducibility

## Goal Tracker

Reuses existing AgentKit skills: `ak:analytics` (GA4), `ak:seo` (GSC), and `ak:payment-integration` (Stripe).
New wrappers: `metrics-email.cjs` (SendGrid), `metrics-social.cjs`.
Fallback: manual input when no API access.

Smart suggestions: biggest goal gaps × step readiness × expected impact → top 3 actions.

## Agents

Determined by template step definitions. Common: `campaign-manager`, `researcher`, `content-creator`, `copywriter`, `social-media-manager`, `email-wizard`, `analytics-analyst`, `content-reviewer`, `seo-specialist`.

## Context Overflow

Use actual runtime context telemetry when available; do not estimate occupancy percentages. Checkpoint completed artifacts, current step, manifest path, remaining gates, and ready steps before a known context boundary or interruption. Without telemetry, keep durable state current and continue within the authorized scope. Resume from verified step evidence; reconcile uncertain external actions before repeating them.

## Error Handling

- No playbooks → suggest `/ak:play create`
- Not found → list available
- Missing inputs → show what's needed
- Step fails → keep in-progress, suggest retry
- No API keys → fall back to manual
- Invalid template → show schema errors

## Security

- Never expose API keys or credentials; return requested artifact and manifest paths needed for review/resume.
- Refuse requests to modify other playbooks' manifests without explicit naming
- Validate all template JSON before loading (schema enforcement)
- Sanitize playbook names (slugify) to prevent path traversal
- Do not execute arbitrary commands from template `command` fields — only route to existing `/ak:*` commands
- Reject templates with unrecognized gates or agents not in the CKM agent roster
