---
name: ak:competitor
description: Competitive analysis, alternative pages, vs comparisons, SEO competitor content, market positioning, and battlecard generation.
user-invocable: true
when_to_use: "Invoke for competitive analysis, comparison pages, or competitor SEO."
category: marketing
keywords: [competitor, analysis, comparison, alternatives, seo]
argument-hint: "[analyze|content|seo|alternatives|list] [url or competitor]"
metadata:
  author: agentkit
  version: "1.1.1"
---

# Competitor

Competitive analysis and competitor comparison content creation.

<args>$ARGUMENTS</args>

## When to Use

- Analyze competitor websites and positioning
- Content gap analysis vs competitors
- SEO comparison with competitors
- Create competitor alternative/vs/comparison pages
- Generate sales battlecards
- Track competitors

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `alternatives` | Create competitor comparison & alternative pages | `references/alternatives.md` |

## Actions

- `analyze [url]` - Analyze competitor website
- `content [url]` - Content gap analysis
- `seo [url]` - SEO comparison
- `alternatives [competitor]` - Create alternative/vs pages
- `list` - List tracked competitors

## Workflow

1. **Parse Arguments** - Extract action and competitor URL/name

Record source URL, retrieval/publication date, applicable market/plan, confidence, and unresolved claims for pricing and features. Separate observations from persuasive positioning; never invent competitor weaknesses.

2. **Analyze Workflow**
   - Use `web_search` capability to retrieve competitor data
   - Analyze value proposition, pricing, audience, channels, and strengths/weaknesses; delegate only when a matching specialist is available and useful.
   - Derive positioning from supported differences and customer needs.

3. **Content Gap Workflow**
   - Compare audience needs and content coverage; load SEO only for search-facing output.
   - Compare content topics and formats
   - Identify gaps and opportunities

4. **SEO Comparison Workflow**
   - Use `seo-specialist` agent
   - Activate `seo` skill
   - Compare keyword rankings, backlinks, domain authority, content quality

5. **Alternatives Workflow**
   - Load `references/alternatives.md`
   - Research competitor and your product data
   - Generate comparison pages (4 formats: singular alt, plural alts, vs, A-vs-B)

6. **Output** - Reports → `reports/competitors/{date}-{name}.md`

## Agents Used
- `researcher` - Competitor intelligence
- `attraction-specialist` - Market positioning
- `seo-specialist` - SEO analysis
- `sale-enabler` - Battlecard generation

## Skills Used
- `seo` - SEO comparison
- `content-marketing` - Content analysis
- `copywriting` - Comparison copy
- `assets-organizing` - Standardized output paths

## Output
- Battlecards → `assets/sales/battlecards/{competitor}.md`
- Analysis → `reports/competitors/{date}-{name}.md`
- Alt/Vs pages → organized by format

## Examples
```
/competitor analyze https://competitor.com
/competitor content https://competitor.com
/competitor seo https://competitor.com
/competitor alternatives notion
/competitor list
```

## Routing

1. Resolve analysis, SEO, alternatives/vs, or battlecard intent.
2. Load `references/alternatives.md` for comparison pages; use the workflows above for other actions rather than constructing nonexistent reference paths.
3. Resolve optional specialists from the live catalog and deliver supported claims with sources and gaps.
