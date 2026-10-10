---
provider: buffer
status: stable
surface: GraphQL (public beta) + official CLI + official MCP
---

# Buffer adapter

Adapter: [`scripts/providers/buffer.js`](../../scripts/providers/buffer.js).

## Auth

- Env: `BUFFER_API_KEY` (personal API key from Buffer → Settings → API).
- Header: `Authorization: Bearer <API key>`.
- Third-party OAuth is **not yet enabled** in the public beta — only
  personal API keys work. A multi-tenant app that onboards other users'
  Buffer accounts is not possible in 2026-08.

## Base URL

- `https://api.buffer.com` — GraphQL, `POST` only. Override with
  `social.buffer.base_url` in `config.yaml`.

## Endpoints used

- `POST /` — GraphQL:
  - `query { account { organizations { id name channels { id name service } } } }`
  - `mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { id status } }`

Terminology shifts from legacy REST: profiles → channels, updates →
posts, scheduling is per-post, cursor pagination.

## Rate limit

- Header-driven per Buffer docs. The docs page listing exact numbers
  404'd during research (2026-08-07); the shared http-client retries
  `429` with exponential backoff.

## Supported channels

Instagram, Facebook, LinkedIn, Pinterest, X — per docs at time of
research. Verify Stories/carousel-specific support against the live
GraphQL schema.

## Gotchas

- **Legacy REST retires 2027-02-01** (brownouts Nov + Dec 2026). Any
  existing integration on the old REST API must migrate before then.
- Public beta since 2026-05-27 — expect schema churn. Pin the queries
  above to a version-compatible schema when Buffer publishes one.
- Rate-limit numbers are not published verbatim; discover from headers.

## Sources

- <https://developers.buffer.com/>
- <https://developers.buffer.com/guides/getting-started.html>
- <https://developers.buffer.com/guides/cli.html>
- <https://buffer.com/mcp>
- <https://buffer.com/resources/rebuilding-buffers-api/>
- <https://buffer.com/resources/legacy-rest-api-retired/>
