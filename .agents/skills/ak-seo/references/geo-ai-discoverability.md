# GEO and AI Discoverability

Generative engine optimization (GEO) makes a site easy for search crawlers, AI
answer engines, and people who paste pages into chat assistants. Treat it as one
contract across discovery files, per-page machine-readable variants, metadata,
and on-page actions. Implement only what the site's framework and hosting can
serve; report missing surfaces as gaps instead of claiming them.

## Surface contract

| Surface | Requirement | Verify |
|---|---|---|
| `/robots.txt` | Allows public pages, blocks private/admin/search-result paths, lists `Sitemap:` with an absolute URL. AI crawler policy (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended) is an explicit owner decision, not a default. | `curl -s <origin>/robots.txt`; see `robots-txt-best-practices-2025.md` |
| `/sitemap.xml` | Absolute canonical URLs only (200, indexable, no redirects), real `lastmod`, XML-escaped `<loc>`, split into a sitemap index above 50,000 URLs or 50 MB. Do not list `.md` variants. | `curl -s <origin>/sitemap.xml`; see `sitemap-best-practices.md` |
| `/llms.txt` | llmstxt.org format: H1, blockquote summary, H2 sections of `- [Title](url): description`, `## Optional` last. Link to the `.md` variant of each page. Curated, not every URL. | H1 present, every link resolves 200 |
| `/llms-full.txt` | Same curated set with full Markdown inlined, each page under its own heading with its canonical URL. Regenerated from the same source as the pages, never hand-maintained. | Size is reasonable for a context window; no private or draft content |
| `<page>.md` | Every public HTML page has a Markdown twin at its URL plus `.md` (llmstxt.org): `/docs/intro` → `/docs/intro.md`; a URL ending in `/` uses `index.html.md` (`/` → `/index.html.md`). Served as `text/markdown; charset=utf-8`, same content as the HTML (no nav, footer, or tracking), starts with `# Title` and the canonical URL. | `curl -sI <url>.md` shows 200 and the content type |
| Markdown discovery | HTML head has `<link rel="alternate" type="text/markdown" href="<page>.md">`. Optionally honour `Accept: text/markdown` on the HTML URL with `Vary: Accept`. | View source; `curl -H 'Accept: text/markdown'` |
| Canonical and indexing | HTML page carries `rel=canonical` to itself. `.md`, `llms.txt`, and `llms-full.txt` send `X-Robots-Tag: noindex` (they may still be crawled) so they never compete with the HTML page in search results. | `curl -sI` headers |
| Structured data | JSON-LD per page type (`Organization` + `WebSite` sitewide; `Article`, `BreadcrumbList`, `FAQPage`, `Product`, `SoftwareApplication`, or `HowTo` per page) matching visible content. | `scripts/validate-schema.cjs`, Rich Results Test; see `schema-generation.md` |
| Social metadata | Unique `title`/`description`, `og:title`, `og:description`, `og:url` (canonical), `og:image` (absolute, 1200×630, <5 MB, with `og:image:alt`), `og:type`, `og:site_name`, `twitter:card=summary_large_image`. | Card validators or `curl` + meta grep; see `meta-tag-templates.md` |
| Social cards | Per-page generated OG image (title, section, brand) rather than one sitewide image; cached and deterministic for the same content. | Fetch the `og:image` URL; check dimensions |
| Page actions | Visible "Copy as Markdown", "Copy URL", "Open in ChatGPT/Claude", and "Share" controls on content pages (see below). | Manual or browser test on desktop and mobile |

## Page actions

Place one compact action group near the page title of docs, blog, and guide
pages. All actions work without login and never send page content to a third
party until the user clicks.

| Action | Behaviour |
|---|---|
| Copy as Markdown | Fetch the page's `.md` URL, write it with `navigator.clipboard.writeText`, and show a short "Copied" state. Fall back to a selectable text dialog when the Clipboard API is unavailable (insecure context, denied permission). |
| Copy URL | Copy the canonical URL, not `location.href` with tracking parameters. |
| Open in ChatGPT | `https://chatgpt.com/?hints=search&prompt=<encoded prompt>` |
| Open in Claude | `https://claude.ai/new?q=<encoded prompt>` |
| Open in Gemini | Gemini has no documented prefill parameter. Copy the prompt to the clipboard, then open `https://gemini.google.com/app` and tell the user to paste. Do not claim a prefill. |
| Share | `navigator.share({ title, text, url })` when available (mostly mobile); otherwise a menu with X (`https://x.com/intent/post?text=&url=`), LinkedIn (`https://www.linkedin.com/sharing/share-offsite/?url=`), Facebook (`https://www.facebook.com/sharer/sharer.php?u=`), email (`mailto:?subject=&body=`), and Copy URL. |

Build the AI prompt from the `.md` URL, not the inlined page body, to keep the
query string short and let the assistant fetch current content, for example:
`Read <page>.md and help me with questions about it.` Encode with
`encodeURIComponent` or `URLSearchParams`. Open external links with
`target="_blank" rel="noopener noreferrer"`. Give each control an accessible
name and a visible focus state; announce the copied state with `aria-live`.
Provider URL formats change; re-check them when adding or updating the buttons.

## Audit checklist

- [ ] `robots.txt` reachable, correct `Sitemap:` line, intentional AI crawler policy
- [ ] `sitemap.xml` valid, canonical URLs only, real `lastmod`, no `.md` variants
- [ ] `llms.txt` valid per llmstxt.org and every link returns 200
- [ ] `llms-full.txt` present when docs exist, generated from source, no private content
- [ ] Sampled pages return 200 for `<page>.md` with `text/markdown` and matching content
- [ ] HTML pages expose `rel=alternate type=text/markdown`; Markdown variants are `noindex`
- [ ] JSON-LD valid and consistent with visible content on each page type
- [ ] OG and Twitter tags complete and absolute; per-page social image renders at 1200×630
- [ ] Copy as Markdown, Copy URL, Open in AI, and Share work and degrade gracefully
- [ ] Answer-first content: a direct 40-60 word answer under each question-style heading,
      visible author/date, cited sources, and descriptive headings (see `semantic-seo-framework.md`)

Report each item as pass, fail, or not applicable with the observed URL and
response. Implementation for a specific framework belongs to that framework's
skill; this reference defines what must be true when it ships.
