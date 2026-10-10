---
provider: postiz
status: stable
surface: REST + hosted MCP + official CLI
license: AGPL-3.0
---

# Postiz adapter

Adapter: [`scripts/providers/postiz.js`](../../scripts/providers/postiz.js).

## Auth

- Env: `POSTIZ_API_KEY` (from Postiz dashboard → Settings → Developers → Public API).
- Header format: `Authorization: <apiKey>` (docs form). Set
  `POSTIZ_AUTH_STYLE=bearer` if your instance rejects the raw form and
  needs `Authorization: Bearer <apiKey>`. Real request/response ends up
  in `ProviderError.body` on 401/403 so mismatch is visible.

## Base URL

- Cloud: `https://api.postiz.com/public/v1`
- Self-hosted: same path on `NEXT_PUBLIC_BACKEND_URL`. Override with
  `social.postiz.base_url` in `config.yaml`.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| GET | `/integrations` | List connected social accounts |
| POST | `/upload` | Upload media (≤ 50MB) |
| POST | `/posts` | Create/schedule/publish |

Payload shape (schedule):

```json
{
  "type": "schedule",
  "date": "2026-08-15T09:00:00Z",
  "integrations": [ { "id": "<integration-id>", "content": "…", "media": ["…"] } ]
}
```

## Rate limit

- 90 req/hr self-hosted, 100/hr cloud on **post creation**. Read
  endpoints are not counted. The shared http-client retries `429` with
  bounded exponential backoff and surfaces `RateLimitError` when it
  gives up.

## Supported channels

X, Bluesky, Mastodon, Discord, Instagram, YouTube, LinkedIn, TikTok,
Reddit, Facebook, Pinterest, Threads, Slack, and more (~28-32).

## Gotchas

- Batch cross-platform posts in a single `POST /posts` with multiple
  `integrations[]` — do not loop per-platform (eats rate limit).
- 413 on media > 50MB. Compress before upload.
- The community `postiz-mcp` npm package is unofficial; the built-in
  hosted MCP at `https://api.postiz.com/mcp` is the one docs.postiz.com
  maintains.

## Sources

- <https://docs.postiz.com/public-api/introduction>
- <https://github.com/gitroomhq/postiz-app>
- <https://github.com/gitroomhq/postiz-agent>
- <https://mcpservers.org/servers/postiz-mcp>
