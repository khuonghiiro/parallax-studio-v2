---
name: ak:logo-design
description: "Design logos and explore logo styles, palettes, and brand concepts. Use for a new mark or requested revision, preserving supplied brand constraints and verifying final image formats."
user-invocable: true
when_to_use: "Invoke to design a logo across styles, palettes, and industries."
category: design
keywords: [logo, design, palette, styles, identity]
argument-hint: "[brand-name] [style]"
license: MIT
metadata:
  author: agentkit
  version: "1.0.1"
---

# Logo Design - AI-Powered Logo Intelligence

Use the supplied brand brief and references, search only unresolved style/color choices, and resolve an installed generation capability for actual provider/model support. Produce the requested variants and preserve existing identity unless redesign is requested.

## When to Apply

Activate when user requests:
- Logo design or creation
- Brand identity visual elements
- Logo style recommendations
- Color palette for logos
- Industry-specific logo guidance

## Quick Reference

Read [this official docs](https://ai.google.dev/gemini-api/docs/image-generation) for latest updates.

### 1. Generate Design Brief (RECOMMENDED START)

```bash
python3 scripts/search.py "tech startup modern" --design-brief -p "BrandName"
```

Returns: Industry analysis, style recommendations, color palettes.

### 2. Search Specific Domains

```bash
# Search styles
python3 scripts/search.py "minimalist clean modern" --domain style

# Search color palettes
python3 scripts/search.py "tech professional trust" --domain color

# Search industry guidelines
python3 scripts/search.py "healthcare medical" --domain industry
```

### 3. Generate Logo with Gemini Nano Banana model 

Use the requested background and output format. A white-background source can support the bundled preview path, but it is not a reason to override a transparent-background request. Verify the actual file; raster output is not vector artwork.

```bash
python3 scripts/generate.py --brand "TechFlow" --style minimalist --industry tech
python3 scripts/generate.py --prompt "coffee shop vintage badge" --style vintage
```

Options: `--style` (minimalist, vintage, luxury, etc.), `--industry` (tech, healthcare, food, etc.)

When a script fails, fix the script directly rather than working around it.

## Available Styles

| Category | Styles |
|----------|--------|
| General | Minimalist, Wordmark, Lettermark, Pictorial Mark, Abstract Mark, Mascot, Emblem, Combination Mark |
| Aesthetic | Vintage/Retro, Art Deco, Luxury, Playful, Corporate, Organic, Neon, Grunge, Watercolor |
| Modern | Gradient, Flat Design, 3D/Isometric, Geometric, Line Art, Duotone, Motion-Ready |
| Clever | Negative Space, Monoline, Split/Fragmented, Responsive/Adaptive |

## Color Psychology Quick Guide

| Color | Psychology | Best For |
|-------|------------|----------|
| Blue | Trust, stability, professional | Finance, tech, healthcare |
| Green | Growth, natural, sustainable | Eco, wellness, organic |
| Red | Energy, passion, urgency | Food, sports, entertainment |
| Gold | Luxury, premium, prestige | Fashion, jewelry, hotels |
| Purple | Creative, innovative, premium | Beauty, creative, tech |

## Industry Defaults

| Industry | Style | Colors | Typography |
|----------|-------|--------|------------|
| Tech | Minimalist, Abstract | Blues, purples, gradients | Geometric sans |
| Healthcare | Professional, Line Art | Blues, greens, teals | Clean sans |
| Finance | Corporate, Emblem | Navy, gold | Serif or clean sans |
| Food | Vintage Badge, Mascot | Warm reds, oranges | Friendly, script |
| Fashion | Wordmark, Luxury | Black, gold, white | Elegant serif |

## Workflow Example

**User:** "Create a logo for a sustainable coffee brand called GreenBean"

1. Generate design brief:
```bash
python3 scripts/search.py "coffee organic eco sustainable" --design-brief -p "GreenBean"
```

2. Generate logo variations:

```bash
python3 scripts/generate.py --brand "GreenBean" --style vintage --industry eco
python3 scripts/generate.py --brand "GreenBean" --style organic --industry food
```

3. Inspect spelling, silhouette, legibility at small sizes, color, background/alpha, and file format against the brief. Correct defects and deliver the actual logo files.

An HTML comparison page is optional when requested or helpful for several variants. Create it through an available rendering capability without making a preview question a completion gate. Present variants side by side when practical; do not imply vector or trademark verification from image generation.

## References

- `references/style-guide.md` - Detailed style descriptions and use cases
- `references/color-psychology.md` - Color meanings and combinations
- `references/prompt-engineering.md` - AI image generation prompts

## Setup

```bash
export GEMINI_API_KEY="your-key"  # Get from https://aistudio.google.com/apikey
pip install google-genai
```
