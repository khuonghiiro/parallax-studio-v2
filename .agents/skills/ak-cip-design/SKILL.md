---
name: ak:cip-design
description: "Design Corporate Identity Program mockups and brand applications such as stationery, signage, apparel, and packaging. Preserve existing identity or develop new concepts within the requested brief."
user-invocable: true
when_to_use: "Invoke to design a corporate identity program and its deliverables."
category: design
keywords: [cip, corporate-identity, deliverables, styles, brand]
argument-hint: "[deliverable or brand-element]"
license: MIT
dependencies:
  - ai-multimodal  # Resolve the installed generation capability before use
metadata:
  author: agentkit
  version: "1.0.1"
---

# CIP Design - Corporate Identity Program Intelligence

Comprehensive Corporate Identity Program (CIP) design system with 50+ deliverables, 20 design styles, 20 industry guides. Search design guidelines and generate mockups using Gemini Nano Banana (Flash/Pro) models.

Resolve the installed image-generation owner and supported provider/model before rendering. Bundled scripts are an implementation option, not evidence of account access. Reuse the accepted brief and render only named deliverables.

For an established brand, use the actual logo/reference and inspect its fidelity; never let missing input silently become a redesigned identity. A new brand may use clearly labeled concepts when logo creation is in scope.

## When to Apply

Activate when user requests:
- Corporate identity or brand identity design
- CIP/CI deliverable mockups (business cards, letterheads, signage, etc.)
- Brand application guidelines
- Vehicle branding, office signage, uniforms
- Complete brand identity packages

## Quick Reference

### 1. Generate CIP Brief (RECOMMENDED START)

```bash
python3 scripts/search.py "tech startup" --cip-brief -b "BrandName"
```

Returns: Industry analysis, style recommendations, key deliverables.

### 2. Search Specific Domains

```bash
# Search deliverables
python3 scripts/search.py "business card letterhead" --domain deliverable

# Search design styles
python3 scripts/search.py "luxury premium elegant" --domain style

# Search industry guidelines
python3 scripts/search.py "hospitality hotel" --domain industry

# Search mockup contexts
python3 scripts/search.py "office reception" --domain mockup
```

### 3. Generate CIP Mockups with Gemini Nano Banana

**RECOMMENDED: Use --logo for accurate brand mockups**

```bash
# Generate with brand logo (RECOMMENDED - uses image editing)
python3 scripts/generate.py --brand "TopGroup" --logo /path/to/logo.png --deliverable "business card" --industry "consulting"

# Full-set example only when the requested deliverables match the script set
python3 scripts/generate.py --brand "TopGroup" --logo /path/to/logo.png --industry "consulting" --set

# Use Pro model for higher quality / 4K text rendering
python3 scripts/generate.py --brand "TopGroup" --logo logo.png --deliverable "business card" --model pro

# Custom deliverables with aspect ratio
python3 scripts/generate.py --brand "GreenLeaf" --logo logo.png --industry "organic food" --deliverables "letterhead,packaging,vehicle" --ratio 16:9

# New-brand concept only; never use for an established logo
python3 scripts/generate.py --brand "TechFlow" --deliverable "business card" --no-logo-prompt
```

Check `scripts/generate.py --help` and the installed provider owner for supported model flags. Do not infer provider availability or output quality from the example model names.

**Image Editing Mode:**
When `--logo` is provided, uses Gemini's text-and-image-to-image capability to incorporate your ACTUAL logo into mockups. Without `--logo`, the script can invent an interpretation; use that path only for authorized new-brand concepts.

## Deliverable Categories

| Category | Items |
|----------|-------|
| Core Identity | Logo, Logo Variations |
| Stationery | Business Card, Letterhead, Envelope, Folder, Notebook, Pen |
| Security/Access | ID Badge, Lanyard, Access Card |
| Office Environment | Reception Signage, Wayfinding, Meeting Room Signs, Wall Graphics |
| Apparel | Polo Shirt, T-Shirt, Cap, Jacket, Apron |
| Promotional | Tote Bag, Gift Box, USB Drive, Water Bottle, Mug, Umbrella |
| Vehicle | Car Sedan, Van, Truck |
| Digital | Social Media, Email Signature, PowerPoint, Document Templates |
| Product | Packaging Box, Labels, Tags, Retail Display |
| Events | Trade Show Booth, Banner Stand, Table Cover, Backdrop |

## Design Styles Quick Guide

| Style | Colors | Best For |
|-------|--------|----------|
| Corporate Minimal | Navy, White, Blue | Finance, Legal, Consulting |
| Modern Tech | Purple, Cyan, Green | Tech, Startups, SaaS |
| Luxury Premium | Black, Gold, White | Fashion, Jewelry, Hotels |
| Warm Organic | Brown, Green, Cream | Food, Organic, Artisan |
| Bold Dynamic | Red, Orange, Black | Sports, Entertainment |

## Workflow Example

**User:** "Create a complete CIP for a luxury hotel called Grand Vista"

1. Generate CIP brief:
```bash
python3 scripts/search.py "luxury hospitality hotel" --cip-brief -b "Grand Vista"
```

2. Generate key deliverables with logo (RECOMMENDED):
```bash
python3 scripts/generate.py --brand "Grand Vista" --logo /path/to/grandvista-logo.png --industry "hospitality" --style "luxury premium" --set
```

3. For a new-brand concept only, when no established logo must be preserved:
```bash
python3 scripts/generate.py --brand "Grand Vista" --industry "hospitality" --style "luxury premium" --set --no-logo-prompt
```

**Note:** If no logo exists, consider using the `logo-design` skill first to generate one.

### 4. Optional HTML Presentation

Create an HTML presentation when requested or when comparison materially helps. The mockups are complete without a preview gate; report actual formats and distinguish mockups from print-ready production files.

```bash
# Generate HTML presentation from CIP images
python3 scripts/render-html.py --brand "TopGroup" --industry "consulting" --images /path/to/cip-output

# Specify custom output path
python3 scripts/render-html.py --brand "TopGroup" --industry "consulting" --images ./topgroup-cip --output presentation.html
```

**HTML Presentation Features:**
- Hero section with brand name, industry, style, and mood
- Individual deliverable cards with mockup images
- Detailed descriptions: concept, purpose, specifications
- Responsive design for desktop and mobile viewing
- Dark theme professional aesthetic
- Images embedded as base64 (single-file portable)

## References

- `references/deliverable-guide.md` - Detailed deliverable specifications
- `references/style-guide.md` - Design style descriptions
- `references/prompt-engineering.md` - AI generation prompts

## Setup

```bash
export GEMINI_API_KEY="your-key"  # Get from https://aistudio.google.com/apikey
pip install google-genai pillow
```

Load the `ai-multimodal` skill for detailed Nano Banana image-generation guidance.
