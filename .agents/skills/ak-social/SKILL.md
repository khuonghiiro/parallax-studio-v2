---
name: ak:social
description: Social media content creation, scheduling, and multi-provider publishing (Postiz, Buffer, Post Bridge, Typefully, Zernio, Publer) for X, LinkedIn, Instagram, TikTok, YouTube, Facebook, Threads, Bluesky, Mastodon, and more. Platform-specific workflows, engagement templates, hook writing.
user-invocable: true
when_to_use: "Invoke to create, schedule, or publish social media content."
category: marketing
keywords: [social, content, scheduling, publishing, platforms]
argument-hint: "[platform] [type] | publish | schedule | list-providers"
metadata:
  author: agentkit
  version: "2.1.1"
---

# Social

Social media content creation, scheduling, and platform management —
with real publish/schedule through pluggable provider adapters.

<args>$ARGUMENTS</args>

## When to Use

- Social media post creation (any platform)
- Content scheduling and calendar management
- Actual publishing/scheduling through a real API (Postiz, Buffer,
  Post Bridge, Typefully, Zernio, Publer)
- Platform-specific content optimization
- Thread/carousel/reel creation
- Engagement strategy and hook writing

## Platforms

`x` (alias: `twitter`), `linkedin`, `instagram`, `tiktok`, `youtube`,
`facebook`, `threads`, `bluesky`, `mastodon`, `pinterest`, `reddit`

## Content Types

`post`, `thread`, `carousel`, `story`, `reel`

Load `references/provider-configuration.md` only for this operation.

## Subcommands

| Subcommand | Purpose | Reference |
|---|---|---|
| `publish` | Publish or schedule via a provider | `references/publish.md` |
| `schedule` | Legacy scheduling helper (kept for compatibility) | `references/schedule.md` |
| `list-providers` | Print adapters + channels + env status | `references/providers/README.md` |

## Workflow

1. Resolve draft, calendar, publish/schedule, or status intent from the request.
2. Draft directly or use available specialists when useful. Apply the writing style from `--style <name>` or `social.default_style`; drafting makes no network publication.
3. If publishing: resolve exact content, media, account/channel, and time/timezone within the user's authorization, then load the selected adapter reference and run `scripts/publish-post.js` with `--content`,
   `--channels`, and either `--provider` (explicit) or route via
   `social.channels` in config. Use `--dry-run` to validate without
   hitting a live API.
4. Platform-specific formatting + hashtag research (drafting only).
5. Output drafts to the requested/project path (fallback: `assets/posts/{platform}/{date}-{slug}.md`).
6. Verify publication/scheduling receipts. If a timeout leaves the outcome uncertain, query/read back the provider or report uncertainty before retrying; do not duplicate posts or expand accounts/channels. For status, read existing receipts or an available read-only provider operation without publishing.

## Scripts

| Script | Purpose |
|---|---|
| `scripts/publish-post.js` | Publish/schedule via provider adapters (v2.1) |
| `scripts/schedule-post.js` | Legacy scheduling helper (kept) |
| `scripts/validate-post-content.js` | Validate content against platform rules |

Adapter internals live under `scripts/providers/*.js` and
`scripts/lib/*.js`. Run the shared test suite:

```bash
node --test kits/marketing/skills/ak-social/scripts/tests/
```

## Provider selection

Precedence when resolving which adapter to call:

1. `--provider <id>` on the CLI (explicit override, wins over everything).
2. `social.channels.<channel>` in `config.yaml` — flat map of
   channel → provider id, e.g. `channels: { x: postiz, linkedin: buffer }`.
3. `social.default_provider` in `config.yaml` (workspace default).
4. Fail with a clear "no provider for channel `<x>`" error listing
   installed adapters and the env var each one needs.

Adapters refuse to run when their env var is missing and name the
exact `.env` file the user should edit. Rate limits (429) retry with
bounded backoff before surfacing `RateLimitError` to the caller.

## References (Knowledge Base)

| Topic | File |
|---|---|
| Config schema | `references/config-schema.md` |
| Writing styles | `references/writing-styles.md` |
| Providers overview | `references/providers/README.md` |
| Platform Specs | `references/platform-specs.md` |
| Hook Writing | `references/hook-writing.md` |
| Engagement Templates | `references/engagement-templates.md` |
| Thread Templates | `references/thread-templates.md` |
| Posting Best Practices | `references/posting-best-practices.md` |
| Rate Limits & Errors | `references/rate-limits-errors.md` |
| Unified API Services | `references/unified-api-services.md` |
| X/Twitter Workflow | `references/x-twitter-workflow.md` |
| LinkedIn Workflow | `references/linkedin-workflow.md` |
| Facebook Workflow | `references/facebook-workflow.md` |
| Threads Workflow | `references/threads-workflow.md` |
| TikTok Workflow | `references/tiktok-workflow.md` |
| YouTube Workflow | `references/youtube-workflow.md` |

## Routing

1. Parse first word of `$ARGUMENTS`. If it is `publish`, `schedule`,
   or `list-providers`, dispatch to that subcommand's reference.
2. Otherwise treat the first two words as `<platform> <content-type>`
   for drafting.
3. All publishing goes through the adapter interface in
   `scripts/lib/adapter-base.js`; never call provider REST endpoints
   directly from other scripts.

## Security

- Secrets stay in `.env` files. The CLI redacts headers before
  logging; only `content-type`, `accept`, `user-agent`, and
  `x-request-id` may be echoed.
- `--dry-run` never touches the network — safe for CI and previews.
- Community MCP servers listed in provider references are unofficial;
  audit them before piping your API key through them.
