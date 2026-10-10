---
name: ak:slides
description: Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies.
user-invocable: true
when_to_use: "Invoke to create strategic HTML presentations with charts and design tokens."
category: media
keywords: [slides, presentation, html, charts, deck]
argument-hint: "[topic] [slide-count]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Slides

Strategic HTML presentation design with data visualization.

<args>$ARGUMENTS</args>

## When to Use

- Marketing presentations and pitch decks
- Data-driven slides with Chart.js
- Strategic slide design with layout patterns
- Copywriting-optimized presentation content

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `create` | Create strategic presentation slides | `references/create.md` |

## References (Knowledge Base)

| Topic | File |
|-------|------|
| Layout Patterns | `references/layout-patterns.md` |
| HTML Template | `references/html-template.md` |
| Copywriting Formulas | `references/copywriting-formulas.md` |
| Slide Strategies | `references/slide-strategies.md` |

## Routing

1. Resolve the requested output format and purpose from natural intent or `$ARGUMENTS`. This workflow produces HTML; a PPTX request must use a discovered presentation capability that produces PPTX.
2. For HTML creation, load `references/create.md` and reuse existing brand templates/tokens. Load chart recipes only for charts with supplied or sourced data.
3. Verify the actual deck, navigation, readable layouts, complete content, and chart values; deliver the requested format, not a mislabeled HTML file.

## Design Quality

Before building slides, state one line: `Reading this as: <deck purpose> for <audience>, leaning <aesthetic direction>.` Reuse the provided brief; ask only for a material missing decision.

Before final handoff, resolve an installed frontend-design capability and its design-quality reference when available; otherwise inspect these quality criteria directly — the converged catalog of generic gradients, template card grids, fake screenshots, generic content, decorative furniture, and one-note palettes. Each item is default-off, not absolute: state the exception out loud when the brand/brief justifies it.
