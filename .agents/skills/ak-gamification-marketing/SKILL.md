---
name: ak:gamification-marketing
description: Design gamified marketing campaigns using points, badges, leaderboards, streaks, challenges. Use for loyalty programs, referral campaigns, onboarding flows, engagement boosts, email gamification. Provides mechanics selection, psychology alignment, strategy docs, templates, KPIs.
user-invocable: true
when_to_use: "Invoke to design gamified campaigns with points, badges, or leaderboards."
category: marketing
keywords: [gamification, points, badges, leaderboards, engagement]
argument-hint: "[mechanic or campaign]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Gamification Marketing

Design and implement gamified marketing campaigns using behavioral psychology and game mechanics.

## Choose a Mechanic

Start from a valuable audience behavior and the reason it is difficult. Use evidence from that audience to select a mechanic; a goal alone does not justify streaks, public rankings, urgency, or variable rewards. Compare a simpler non-game intervention. Specify opt-out/privacy needs, reward cost, abuse controls, and what would disprove the hypothesis.

## Core Mechanics (10)

| Mechanic | Best For | Psychology |
|----------|----------|------------|
| Points | All goals | Achievement, progress tracking |
| Badges | Recognition, milestones | Competence, social proof |
| Leaderboards | Competition, engagement | Social comparison, status |
| Levels | Progression, retention | Mastery, unlocking content |
| Streaks | Habit formation, retention | Loss aversion, commitment |
| Challenges | Engagement, conversion | Goal-setting, achievement |
| Quests | Extended engagement | Narrative, exploration |
| Unlockables | Retention, progression | Curiosity, exclusivity |
| Rewards | All goals | Dopamine, variable schedules |
| Progress Bars | Onboarding, completion | Visual momentum, Zeigarnik |

## Workflow

1. **Identify Goal** → Define useful behavior, audience evidence, and guardrails
2. **Select Mechanics** → See [mechanics-selection.md](references/mechanics-selection.md)
3. **Align Psychology** → See [psychology-frameworks.md](references/psychology-frameworks.md)
4. **Design Campaign** → See [campaign-templates.md](references/campaign-templates.md)
5. **Implement** → See [implementation-guide.md](references/implementation-guide.md)
6. **Measure** → See [kpi-tracking.md](references/kpi-tracking.md)

## Measure Value and Side Effects

Define the useful outcome (qualified referral, learned skill, repeat product value), exposure/cohort/window, and baseline. Track churn, fatigue/unsubscribes, reward cost, and abuse as guardrails. Engagement counts alone do not establish value.

Player archetypes and psychology frameworks are design lenses, not population percentages or causal evidence. Use `references/case-studies.md` for patterns only unless its claims are independently verified with source, date, and cohort. Do not promise ROI or retention uplift.

## References

- [mechanics-selection.md](references/mechanics-selection.md) - Mechanics guide, selection matrix
- [psychology-frameworks.md](references/psychology-frameworks.md) - Octalysis, SDT, Fogg model
- [campaign-templates.md](references/campaign-templates.md) - Email templates, calendar
- [challenge-configs.md](references/challenge-configs.md) - JSON configs, rules engine
- [implementation-guide.md](references/implementation-guide.md) - Architecture, API, caching
- [database-schema.md](references/database-schema.md) - PostgreSQL schemas
- [kpi-tracking.md](references/kpi-tracking.md) - Metrics, alerts, reporting
- [analytics-events.md](references/analytics-events.md) - Event schemas, tracking
- [case-studies.md](references/case-studies.md) - Duolingo, Starbucks, Nike

## Report Output

**Activate:** `assets-organizing` skill for report file paths

Gamification reports go to `assets/reports/performance/{date}-gamification-analysis.md`

## Common Pitfalls

| Issue | Fix |
|-------|-----|
| Too many mechanics | Pick 2-3 core; phased rollout |
| Unclear reward value | Show math: "100 pts = $5" |
| Leaderboard toxicity | Prefer private progress or opt-in groups; remove public ranking when audience evidence rejects it |
| Impossible challenges | Start easy, progressive difficulty |
| No personalization | Segment by player type |
