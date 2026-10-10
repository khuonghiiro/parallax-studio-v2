---
name: ak:campaign
description: Marketing campaign planning, execution, optimization. Create campaigns, track status, analyze performance, manage budgets, coordinate multi-channel efforts.
user-invocable: true
when_to_use: "Invoke to plan, run, or analyze a marketing campaign end to end."
category: workflow
keywords: [campaign, planning, execution, status, analysis]
argument-hint: "[create|status|analyze|email] [name]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Campaign

End-to-end campaign planning, execution, and optimization.

<args>$ARGUMENTS</args>

## When to Use

- Campaign planning and launch execution
- Multi-channel coordination
- Budget allocation and timeline management
- Performance tracking and optimization
- Email campaign management

## Campaign Types

Product Launch, Seasonal/Promotional, Brand Awareness, Lead Generation, Re-engagement

## Workflow

1. Resolve plan/create, status, analyze, email, or execute intent and the named campaign from the request.
2. For planning, reuse the brief, budget, channels, and launch criteria; load `references/create.md`.
3. For status, read current campaign files and receipts directly; load `references/status.md`. Report data age and missing evidence without triggering analysis or publication.
4. For analysis, load `references/analyze.md` and resolve available authorized data sources.
5. For execution, identify the approved campaign, account/channel, content, launch time/timezone, and spend limits. Route only to a discovered operational capability and verify its receipt. A planning request does not authorize external changes.

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `analyze` | Analyze campaign performance | `references/analyze.md` |
| `create` | Create comprehensive digital marketing campaign | `references/create.md` |
| `email` | Email campaign management | `references/email.md` |
| `status` | Get campaign status | `references/status.md` |

## References (Knowledge Base)

| Topic | File |
|-------|------|
| Campaign Brief | `references/campaign-brief.md` |
| Launch Checklist | `references/launch-checklist.md` |
| Budget Allocation | `references/budget-allocation.md` |
| Optimization Framework | `references/optimization-framework.md` |

## Optional Specialists

Discover availability before delegating; direct work is sufficient for small status or planning requests.

- `campaign-manager` — Campaign orchestration
- `funnel-architect` — Funnel design
- `analytics-analyst` — Performance tracking
- `campaign-debugger` — Issue diagnosis

## Output

- Campaign briefs → `assets/campaigns/{date}-{slug}/briefs/`
- Campaign creatives → `assets/campaigns/{date}-{slug}/creatives/`
- Campaign reports → `assets/campaigns/{date}-{slug}/reports/`
- Analysis reports → `assets/diagnostics/campaign-audits/{date}-{name}.md`

## Routing

Use the table for existing subcommands. Natural execution intent routes through the authorized channel owner; it does not create a new local command or assumed reference file.
