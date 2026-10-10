---
name: ak:email
description: Email campaigns, newsletters, drip sequences, automation flows, email copywriting, deliverability, subject line formulas, A/B testing. Generate email content for any marketing purpose.
user-invocable: true
when_to_use: "Invoke to write email campaigns, newsletters, or drip and automation sequences."
category: marketing
keywords: [email, newsletter, drip, sequence, automation]
argument-hint: "[flow|sequence|newsletter|cold|launch|nurture] [args]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Email

Email content creation, automation flows, and campaign management.

<args>$ARGUMENTS</args>

## When to Use

- Email content generation (newsletter, cold, launch, nurture, welcome, winback)
- Email automation flow design
- Drip sequence creation
- Subject line optimization
- Deliverability best practices

## Email Types

`newsletter`, `cold`, `followup`, `launch`, `nurture`, `welcome`, `winback`

## Workflow

1. Parse type from `$ARGUMENTS`
2. Reuse audience, message, CTA, brand voice, and segmentation constraints; ask only for material gaps.
3. Draft directly or resolve available email/copywriting specialists when useful.
4. Generate subject lines (3-5 variants), preview text, body, CTA
5. Deliver a local draft or flow design at the requested/project path (fallback: `assets/copy/emails/{date}-{type}-{slug}.md`). Preserve supplied unsubscribe, consent, suppression, and segmentation requirements.
6. Send or schedule only through an available authorized capability with exact content, audience, account, and time/timezone. Load deliverability guidance for sending; verify the provider receipt.

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `flow` | Generate complete email automation sequence | `references/flow.md` |
| `sequence` | Generate complete email drip sequence with copy | `references/sequence.md` |

## References (Knowledge Base)

| Topic | File |
|-------|------|
| Automation Flows | `references/automation-flows.md` |
| Subject Line Formulas | `references/subject-line-formulas.md` |
| Email Templates | `references/email-templates.md` |
| Deliverability Checklist | `references/deliverability-checklist.md` |

## Routing

1. Resolve natural email intent or an existing subcommand.
2. Load `references/flow.md` or `references/sequence.md` for those operations; use `references/email-templates.md` for newsletter/cold/launch/nurture drafts.
3. A flow document is not a deployed automation or sent campaign.
