---
name: ak:init
description: Initialize marketing project — discover or establish project context, brand constraints, marketing direction, and setup. Use when starting a new marketing project or onboarding an existing one.
user-invocable: true
when_to_use: "Invoke to initialize or discover the marketing project context."
category: workflow
keywords: [init, project, context, setup, marketing]
argument-hint: "[prompt]"
metadata:
  author: agentkit
  version: "1.0.3"
---

# Initialize a Marketing Project

Discover or establish the business, audience, brand, objectives, and constraints needed for marketing work. Reuse existing project knowledge; complete onboarding when the necessary context is recorded in its actual owners and material unknowns are explicit.

<user-input>$ARGUMENTS</user-input>

## Inspect Before Interviewing

Read repository instructions, README, and documentation navigation. Locate product/business context, audience research, brand and legal constraints, strategy, budget/timing, active campaigns, and reusable assets. Verify relevant claims against current evidence; do not rescan or research unrelated surfaces.

For an existing project, update the specific missing or changed context directly. For a new project, collect enough information to establish the requested marketing direction. Git or remote-repository creation is a separate action: perform it only when requested, not as an onboarding prerequisite.

## Fill Material Gaps

Reuse supplied answers and ask only about decisions that cannot be discovered. Group related missing questions without repeating a complete agency interview:

- Offering, value proposition, differentiators, and pricing model.
- Audience, buying situation, geography, and channel evidence.
- Marketing objective, success metric, budget, timing, and constraints.
- Brand voice, approved logo/assets, visual rules, and legal/approval boundaries.
- Competitors or previous campaigns relevant to the decision.

Keep optional unknowns explicit. Research only gaps that affect the outcome. Use available native capabilities directly; delegate independent research only when available, authorized, and useful, with a concrete question and ownership.

## Record and Verify

Update the existing owner for each fact, preserving custom structure and unrelated content. Create a minimal purpose-based document only when an authority is missing, and link it from existing navigation when appropriate. Do not impose a fixed documentation inventory.

Inspect the diff for factual accuracy, brand consistency, source links, and actual paths. Do not infer permission to publish, create accounts, contact prospects, or commit from an onboarding request. Continue any already-authorized follow-up without repeating approval gates.

## Finish

Report the context established, files changed, evidence checked, and material unknowns. Resolve any suggested next capability from the live installed catalog; do not invent slash commands or require a generated catalog script. Suggest the next useful action only when it follows from the objectives. When the objective is still pre-product — validating an idea, sizing a market, or choosing what to build, with no offer settled yet — the useful next capability is the installed playbook orchestrator's product-discovery playbook rather than campaign or content work.
