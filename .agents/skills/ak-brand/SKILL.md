---
name: ak:brand
description: Brand voice, visual identity, messaging frameworks, asset management, brand consistency. Activate for branded content, tone of voice, marketing assets, brand compliance, style guides.
user-invocable: true
when_to_use: "Invoke to create, review, or update brand voice, identity, and messaging."
category: design
keywords: [brand, voice, identity, messaging, guidelines]
argument-hint: "[update|review|create] [args]"
metadata:
  author: agentkit
  version: "1.0.2"
---

# Brand

Brand identity, voice, messaging, asset management, and consistency frameworks.

## When to Use

- Brand voice definition and content tone guidance
- Visual identity standards and style guide development
- Messaging framework creation
- Brand consistency review and audit
- Asset organization, naming, and approval
- Color palette management and typography specs

## Quick Start

**Inject brand context into prompts:**
```bash
node scripts/inject-brand-context.cjs
node scripts/inject-brand-context.cjs --json
```

**Validate an asset:**
```bash
node scripts/validate-asset.cjs <asset-path>
```

**Extract/compare colors:**
```bash
node scripts/extract-colors.cjs --palette
node scripts/extract-colors.cjs <image-path>
```

## Choose the Brand Operation

- Define: reuse available research and establish only the missing identity decisions.
- Update: change the requested voice, messaging, or visual fields in their actual authority; a tone change does not change palette or tokens.
- Audit/review: compare the requested assets against authority and report mismatches without rewriting the source.
- Apply: load only the voice, logo rules, or tokens needed for the deliverable.

Resolve authority through repository instructions and navigation. The bundled sync script assumes `docs/brand-guidelines.md` and `assets/design-tokens.*`; inspect its source and use it only when those are the actual owners. For color sync, inspect `--dry-run`, preserve custom tokens and generated-file ownership, then inspect the resulting diff. Do not claim the script preserves custom values without checking.

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `update` | Update the requested brand fields and affected generated consumers | `references/update.md` |

## References

| Topic | File |
|-------|------|
| Voice Framework | `references/voice-framework.md` |
| Visual Identity | `references/visual-identity.md` |
| Messaging | `references/messaging-framework.md` |
| Consistency | `references/consistency-checklist.md` |
| Guidelines Template | `references/brand-guideline-template.md` |
| Asset Organization | `references/asset-organization.md` |
| Color Management | `references/color-palette-management.md` |
| Typography | `references/typography-specifications.md` |
| Logo Usage | `references/logo-usage-rules.md` |
| Approval Checklist | `references/approval-checklist.md` |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/inject-brand-context.cjs` | Extract brand context for prompt injection |
| `scripts/sync-brand-to-tokens.cjs` | Sync brand-guidelines.md → design-tokens.json/css |
| `scripts/validate-asset.cjs` | Validate asset naming, size, format |
| `scripts/extract-colors.cjs` | Extract and compare colors against palette |

## Templates

| Template | Purpose |
|----------|---------|
| `templates/brand-guidelines-starter.md` | Complete starter template for new brands |

## Routing

1. Resolve define/create, update, audit/review, or apply from natural intent or `$ARGUMENTS`.
2. Load `references/update.md` for updates; otherwise choose only the topic reference needed.
3. Verify the output against the relevant authority and list actual changed paths.
