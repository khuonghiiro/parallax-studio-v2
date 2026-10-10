---
name: ak:marketing-planning
description: Plan marketing strategies, campaigns, funnels, content calendars, and initiatives using frameworks such as RACE, SOSTAC, and STP. Reuses current evidence and researches material gaps.
user-invocable: true
when_to_use: "Invoke to plan marketing strategies, funnels, and content calendars."
category: marketing
keywords: [planning, strategy, funnels, calendar, roadmap]
argument-hint: "[goal or timeframe]"
license: MIT
metadata:
  author: agentkit
  version: "1.0.3"
---

# Marketing Planning

Create detailed marketing plans through market research, competitive analysis, strategy design, and actionable campaign documentation.

## Skill Invocation

Reuse the accepted brief, brand authority, and research whose freshness fits the decision. Activate an installed marketing-research capability only for missing or stale evidence that could change the plan.

## When to Use

Use this skill when:
- Planning marketing campaigns and launches
- Creating content strategies and editorial calendars
- Developing brand positioning and messaging
- Designing customer acquisition funnels
- Building multi-channel marketing initiatives
- Evaluating marketing approach trade-offs

## Core Responsibilities & Rules

Focus on actionable marketing strategy and campaign planning.
**Be honest, be brutal, straight to the point, and be concise.**

### 1. Market Research
Load: `references/research-phase.md`
**Skip if:** Provided with market research reports

### 2. Brand & Context Understanding
Load: `references/brand-context.md`
**Skip if:** Provided with brand guidelines or strategy docs

### 3. Strategy Design
Load: `references/strategy-design.md`

### 4. Plan Creation & Organization
Load: `references/plan-organization.md`

### 5. Task Breakdown & Output Standards
Load: `references/output-standards.md`

## Workflow Process

1. **Initial Analysis** → Read brand docs, understand business context
2. **Evidence Gaps** → Research only missing or stale market, competitor, or audience evidence.
3. **Synthesis** → Analyze insights, identify positioning opportunities
4. **Strategy Phase** → Define positioning, channels, messaging
5. **Plan Documentation** → Write comprehensive marketing plan
6. **Review & Refine** → Ensure completeness, feasibility, brand alignment

## Output Requirements

- DO NOT execute campaigns - only create plans
- Respond with plan file path and summary
- Ensure self-contained plans with brand context
- Include creative concepts when clarifying approach
- Provide multiple options with trade-offs when appropriate
- Respect the brand authority discovered through the project navigation; do not assume a fixed file.

**Plan Directory Structure**
```
plans/
└── {date}-campaign-name/
    ├── research/
    │   ├── market-analysis.md
    │   ├── competitor-audit.md
    │   └── audience-insights.md
    ├── reports/
    │   └── campaign-brief.md
    ├── plan.md
    ├── phase-XX-phase-name.md
    └── ...
```

## Active Plan State

Prevents version proliferation by tracking current working plan via session state.

### Active vs Suggested Plans

Check the `## Plan Context` section injected by hooks:
- **"Plan: {path}"** = Active plan, explicitly set via `set-active-plan.cjs` - use for reports
- **"Suggested: {path}"** = Branch-matched, hint only - do NOT auto-use
- **"Plan: none"** = No active plan

### Rules

1. **If "Plan:" shows a path**: Reuse it when it matches the requested work; inspect its acceptance criteria and completed evidence.
2. **If "Suggested:" shows a path**: Inspect it as a hint. Reuse only when its scope matches; ask only if competing plans make the target ambiguous.
3. **If "Plan: none"**: Create new plan using naming from `## Naming` section
4. **Update on create**: Run `node "$(find . -path '*/node_modules' -prune -o -path '*/.git' -prune -o -path '*/backups' -prune -o -name set-active-plan.cjs -print 2>/dev/null | head -1)" {plan-dir}`
   (the installed path varies by runtime — locate it instead of hardcoding one)

### Report Output Location

All agents writing reports MUST:
1. Check `Plan Context` section injected by hooks for `Reports Path`
2. Only `$CK_ACTIVE_PLAN` plans use plan-specific reports path
3. `$CK_SUGGESTED_PLAN` plans use default `plans/reports/` (not plan folder)
4. Use naming: `{date}-{agent}-{slug}.md`

**Important:** Suggested plans do NOT get plan-specific reports - this prevents pollution of old plan folders.

## Quality Standards

- State the strategy concretely enough that a marketer can execute it without asking follow-ups
- Keep brand consistency and voice
- Look up facts you are unsure of rather than asserting them
- Address competitive differentiation
- Validate against brand guidelines
