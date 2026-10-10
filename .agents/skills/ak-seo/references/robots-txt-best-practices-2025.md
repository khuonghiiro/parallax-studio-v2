# Robots.txt Best Practices 2025

## What is robots.txt?

Text file at domain root that controls crawler access to your site.

**Location:** `https://example.com/robots.txt` (must be at root, not subdirectory)

## Basic Structure

```txt
User-agent: *
Disallow: /admin/
Allow: /admin/public/

Sitemap: https://example.com/sitemap.xml
```

## Syntax

### User-agent
Specifies which crawler the rules apply to.

```txt
# All crawlers
User-agent: *
Disallow: /private/

# Google only
User-agent: Googlebot
Disallow: /temp/

# Bing only
User-agent: Bingbot
Allow: /
```

**Common user-agents:**
- `*` - All crawlers
- `Googlebot` - Google Search
- `Googlebot-Image` - Google Images
- `Googlebot-News` - Google News
- `Bingbot` - Bing
- `Slurp` - Yahoo (legacy)

### Disallow
Blocks crawler from accessing paths.

```txt
User-agent: *

# Block single directory
Disallow: /admin/

# Block single file
Disallow: /secret-page.html

# Block entire site (don't do this!)
Disallow: /

# Block nothing (allow all)
Disallow:
```

### Allow
Explicitly allows access (overrides Disallow).

```txt
User-agent: *
Disallow: /admin/
Allow: /admin/blog/  # Exception: allow blog
```

### Sitemap
Declares XML sitemap location.

```txt
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-images.xml
Sitemap: https://example.com/sitemap-news.xml
```

**Rules:**
- Use absolute URL (https://)
- Can have multiple Sitemap lines
- Place at end of file

### Crawl-delay
Delays between requests (seconds).

```txt
User-agent: *
Crawl-delay: 10
```

**Note:**
- Google ignores this (use Search Console instead)
- Bing supports it
- Most bots self-regulate crawl rate

## Complete Example

```txt
# Allow all crawlers
User-agent: *
Disallow: /admin/
Disallow: /api/
Disallow: /temp/
Disallow: /*.json$
Disallow: /*?*  # Block URL parameters (careful!)
Allow: /api/public/
Allow: /admin/login

# Google-specific rules
User-agent: Googlebot
Disallow: /search
Disallow: /cart

# Bing-specific rules
User-agent: Bingbot
Crawl-delay: 5

# Block bad bots
User-agent: BadBot
Disallow: /

# AI crawler rules go here only when the site owner chose a policy
# (see "AI Crawler User-Agents" below)

# Sitemaps (at end)
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-images.xml
```

## AI Crawler User-Agents

Allowing or blocking AI crawlers is a site-owner decision; do not add blocks by
default. Blocking a search or user-fetch agent removes the site from that AI
product's answers and citations, which usually defeats GEO. A common policy
allows search and user-initiated fetches and decides separately on training.

| Operator | Training | Search / answer index | User-initiated fetch |
|---|---|---|---|
| OpenAI | `GPTBot` | `OAI-SearchBot` | `ChatGPT-User` |
| Anthropic | `ClaudeBot` | `Claude-SearchBot` | `Claude-User` |
| Google | `Google-Extended` (control token for Google AI training and grounding, not a separate crawler; `Googlebot` still crawls) | `Googlebot` | — |
| Perplexity | — | `PerplexityBot` | `Perplexity-User` |
| Apple | `Applebot-Extended` (control token) | `Applebot` | — |
| Common Crawl | `CCBot` | — | — |
| Meta | `Meta-ExternalAgent` | — | — |

User-initiated fetchers may not honour robots.txt because a person requested
the page. Retired names such as `anthropic-ai` and `Claude-Web` are unused; skip
them. Operators add and rename agents; confirm current names in each
operator's crawler documentation before shipping a policy.

Example: opt out of model training while staying citable in AI search:

```txt
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: *
Allow: /
```

**Note:** AI companies may not respect robots.txt. Consider:
- Terms of Service on site
- Robots meta tag: `<meta name="robots" content="noai, noimageai">`
- Legal/copyright notices

## Pattern Matching

### Wildcards

**`*` - Matches any sequence**
```txt
# Block all PDFs
Disallow: /*.pdf$

# Block all parameters
Disallow: /*?

# Block all admin paths
Disallow: /*/admin/
```

**`$` - End of URL**
```txt
# Block only .json files (not /api/data.json/page)
Disallow: /*.json$

# Block /admin but allow /admin/blog
Disallow: /admin$
```

### Examples

```txt
# Block query parameters
Disallow: /*?

# Block specific parameters
Disallow: /*?utm_source=
Disallow: /*?sessionid=

# Block file types
Disallow: /*.pdf$
Disallow: /*.xlsx$
Disallow: /*.zip$

# Block faceted navigation
Disallow: /*?color=
Disallow: /*?size=
Disallow: /*?price=
```

## What to Block

### ✅ Always Block

```txt
# Admin areas
Disallow: /admin/
Disallow: /wp-admin/
Disallow: /dashboard/

# Private content
Disallow: /private/
Disallow: /members-only/

# Duplicate content
Disallow: /print/
Disallow: /*?print=1

# Search results
Disallow: /search
Disallow: /*?s=
Disallow: /*?q=

# Shopping cart/checkout
Disallow: /cart
Disallow: /checkout
Disallow: /order

# API endpoints
Disallow: /api/
Disallow: /v1/

# Temporary files
Disallow: /tmp/
Disallow: /temp/
Disallow: /cache/
```

### ⚠️ Consider Blocking

```txt
# URL parameters (if duplicate content)
Disallow: /*?

# Filters (e-commerce)
Disallow: /*?filter=
Disallow: /*?sort=

# Pagination (if canonical set correctly)
Disallow: /*?page=

# User-generated content
Disallow: /user/
Disallow: /profile/

# PDFs/downloads
Disallow: /*.pdf$
```

### ❌ Don't Block

```txt
# CSS/JS (needed for rendering)
# Google requires access since 2014
Allow: /*.css
Allow: /*.js

# Images (if you want them in Google Images)
Allow: /images/

# Important content
# Don't block pages you want indexed!

# Entire site
Disallow: /  # Never do this
```

## Common Mistakes

### ❌ Blocking CSS/JS
```txt
# BAD: Breaks mobile-friendly test
Disallow: /css/
Disallow: /js/
```

**Fix:** Allow CSS/JS for rendering.

### ❌ Using robots.txt for sensitive data
```txt
# BAD: Still accessible, just not indexed
Disallow: /secret-api-keys.txt
```

**Fix:** Use proper authentication. Robots.txt is public.

### ❌ Conflicting with meta robots
```html
<!-- robots.txt: Allow -->
<!-- Page has: -->
<meta name="robots" content="noindex">
```

**Result:** Page not indexed (meta tag wins).

### ❌ Wrong file location
```
https://example.com/blog/robots.txt  ❌
https://example.com/robots.txt       ✅
```

### ❌ Case sensitivity
```txt
Disallow: /Admin/  # Doesn't block /admin/
```

**Fix:** Robots.txt is case-sensitive. Block both if needed.

## Testing & Validation

### Google Search Console
1. Go to Search Console → robots.txt Tester
2. Enter URL to test
3. Click "Test"
4. Shows allowed/blocked status

### Command line
```bash
# Fetch robots.txt
curl https://example.com/robots.txt

# Test specific URL
curl -A "Googlebot" https://example.com/admin/
```

### Online tools
- robots.txt Tester: technicalseo.com/tools/robots-txt/
- Google Search Console (built-in)

## Advanced Patterns

### Block all except homepage
```txt
User-agent: *
Disallow: /
Allow: /$
```

### Block parameters but allow specific
```txt
User-agent: *
Disallow: /*?
Allow: /*?page=
```

### Different rules per crawler
```txt
# Aggressive for unknown bots
User-agent: *
Crawl-delay: 10
Disallow: /api/
Disallow: /search

# Permissive for Google
User-agent: Googlebot
Disallow: /admin/

# Optional owner choice: opt out of OpenAI training
User-agent: GPTBot
Disallow: /
```

## Security Notes

- robots.txt is **public** - anyone can read it
- Don't list sensitive paths (reveals structure)
- Not a security mechanism (use auth instead)
- Malicious bots ignore robots.txt
- Consider IP blocking for bad actors

## Checklist

- [ ] Located at /robots.txt (root level)
- [ ] Returns 200 status code
- [ ] Plain text (text/plain)
- [ ] Allows CSS/JS for Google rendering
- [ ] Blocks admin/private areas
- [ ] Blocks duplicate content (parameters, print)
- [ ] Declares sitemap(s)
- [ ] No syntax errors (test in Search Console)
- [ ] Case-sensitive paths checked
- [ ] Doesn't block important content
- [ ] AI crawler policy chosen by the owner (training vs search vs user fetch)
- [ ] Updated when site structure changes
- [ ] Accessible to crawlers (not password-protected)

## Real-World Examples

### E-commerce
```txt
User-agent: *
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /wishlist
Disallow: /*?filter=
Disallow: /*?sort=
Allow: /products/

Sitemap: https://shop.com/sitemap.xml
```

### Blog/Media site
```txt
User-agent: *
Disallow: /admin/
Disallow: /search
Disallow: /*?s=
Allow: /

Sitemap: https://blog.com/sitemap.xml
```

### SaaS/Documentation
```txt
User-agent: *
Disallow: /app/
Disallow: /dashboard/
Disallow: /api/v1/
Allow: /api/docs/
Allow: /docs/

Sitemap: https://saas.com/sitemap.xml
```

## Further Reading

- Official spec: robotstxt.org
- Google documentation: developers.google.com/search/docs/crawling-indexing/robots/intro
- Test in Search Console: search.google.com/search-console
