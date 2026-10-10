---
name: ak:seo
description: SEO and GEO audits, keyword research (ReviewWeb.site API), on-page and technical SEO, AI discoverability (robots.txt, sitemap.xml, llms.txt, llms-full.txt, .md page variants, social cards, copy/share/open-in-AI page actions), programmatic SEO, JSON-LD schema, Google Search Console, Core Web Vitals.
user-invocable: true
when_to_use: "Invoke for SEO/GEO audits, keyword research, on-page optimization, schema, social metadata, or AI-discoverability requirements."
category: marketing
keywords: [seo, geo, keywords, audit, on-page, schema, llms-txt, open-graph]
argument-hint: "[audit|geo|keywords|pseo|optimize|schema] [target]"
metadata:
  author: agentkit
  version: "1.1.0"
---

# SEO

Technical SEO, keyword research (ReviewWeb.site API), Google Search Console API, and programmatic SEO.

<args>$ARGUMENTS</args>

## When to Use

- Keyword research with real data (volume, difficulty, CPC)
- Competitor domain analysis (traffic, top keywords, backlinks)
- Google Search Console data (queries, clicks, impressions, CTR, position)
- SEO audit or technical analysis
- GEO / AI discoverability: robots.txt, sitemap.xml, llms.txt, llms-full.txt, `.md` page variants, social metadata and cards, copy/share/open-in-AI page actions
- JSON+LD schema generation
- Programmatic SEO (pSEO) templates
- Core Web Vitals measurement

## Choose Evidence and Operation

Resolve technical audit, schema/on-page change, keyword/content research, GSC measurement, or pSEO template intent. A schema fix needs local page/schema evidence, not a paid keyword API. Discover only the relevant provider and authorized account/property; verify credentials through the actual script/config owner without exposing values.

For metrics, record source, date, market/language, period, and coverage. Keep absent traffic, volume, or ranking data unknown; do not infer it from a missing response. Template generation is a local artifact; publishing pages, submitting changes, or outreach requires the corresponding authorized scope.

## Quick Start: Google Search Console

```bash
node scripts/gsc-auth.cjs --auth                     # Authenticate (one-time)
node scripts/gsc-query.cjs --sites                    # List sites
node scripts/gsc-query.cjs --top-queries -s URL       # Top queries
node scripts/gsc-query.cjs --low-ctr -s URL -o low-ctr.csv -f csv
```

Config: `google_client_secret.json` in `.claude/secrets/` or `~/.claude/secrets/`

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `audit` | Technical SEO audit | `references/audit.md` |
| `geo` | AI discoverability contract and audit | `references/geo-ai-discoverability.md` |
| `keywords` | Keyword research & planning | `references/keywords.md` |
| `pseo` | Programmatic SEO template generation | `references/pseo.md` |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/gsc-auth.cjs` | OAuth2 authentication flow |
| `scripts/gsc-query.cjs` | Query analytics, sitemaps, URL inspection |
| `scripts/gsc-config-loader.cjs` | Cross-platform config/token resolution |
| `scripts/analyze-keywords.cjs` | Keyword research via ReviewWeb.site API |
| `scripts/audit-core-web-vitals.cjs` | Core Web Vitals measurement |
| `scripts/generate-sitemap.cjs` | XML sitemap generation |
| `scripts/generate-schema.cjs` | JSON+LD schema generator |
| `scripts/validate-schema.cjs` | Validate JSON-LD |
| `scripts/pseo-generator.cjs` | pSEO page generation |

## References

**Search Console:** `references/google-search-console-api-guide.md`, `references/search-console-query-patterns.md`

**API:** `references/reviewweb-api.md`, `references/reviewweb-content-api.md`

**Audit:** `references/seo-audit-workflow.md`, `references/browser-seo-audit-workflow.md`

**Keyword Research:** `references/keyword-research-workflow.md`, `references/keyword-clustering-methodology.md`, `references/content-gap-analysis-framework.md`

**GEO / AI discoverability:** `references/geo-ai-discoverability.md`

**Technical SEO:** `references/technical-seo-checklist.md`, `references/core-web-vitals-remediation.md`, `references/sitemap-best-practices.md`, `references/robots-txt-best-practices-2025.md`, `references/canonical-url-strategy.md`, `references/mobile-seo-checklist.md`

**On-Page SEO:** `references/on-page-seo-checklist-2025.md`, `references/meta-tag-templates.md`, `references/semantic-seo-framework.md`, `references/readability-scoring-guide.md`, `references/internal-linking-automation.md`

**Programmatic SEO:** `references/pseo-templates.md`, `references/pseo-best-practices.md`, `references/pseo-template-syntax.md`, `references/pseo-url-structure-guide.md`, `references/pseo-scale-architecture.md`

**Link Building:** `references/backlink-analysis-framework.md`, `references/link-building-campaign-framework.md`, `references/outreach-email-templates.md`, `references/directory-submission-list.md`

**Schema:** `references/schema-generation.md`, `references/schema-templates/`

## Agents Used

- `seo-specialist` — SEO audit and optimization
- `attraction-specialist` — Keyword research

## Output

- Audit reports → `assets/reports/seo/{date}-{domain}-audit.md`
- Keyword reports → `assets/reports/seo/{date}-{topic}-keywords.md`
- CWV reports → `assets/reports/seo/{date}-{domain}-cwv.md`
- Schema files → `assets/seo/schemas/{page}-schema.json`

## Routing

1. Resolve intent from natural language or `$ARGUMENTS`.
2. Load the table's existing reference for audit/geo/keywords/pseo; a full-site audit also runs the `geo` checklist; for schema use `references/schema-generation.md`, and for optimize select the relevant on-page/technical reference.
3. Run the applicable validator and report observed results and evidence gaps.
