---
provider: typefully
status: stable
surface: REST v2 + official hosted MCP
---

# Typefully adapter

Adapter: [`scripts/providers/typefully.js`](../../scripts/providers/typefully.js).

## Auth

- Env: `TYPEFULLY_API_KEY` (Settings → API in the Typefully app).
- Header (v2): `Authorization: Bearer <key>`.
- v1 uses `x-api-key`; v1 new-key creation is disabled and v1 is
  deprecated as of 2026-06-15. Do not use v1.

## Base URL

- `https://api.typefully.com`. Override with `social.typefully.base_url`.

## Scope + social_set_id

Every draft/schedule call in v2 is scoped to a `social_set_id`. Set:

- `social.typefully.default_social_set_id` in `config.yaml`, or
- pass `opts.socialSetId` from the caller.

Fetch available sets via `GET /v2/social-sets` (adapter
`listAccounts()`). The adapter refuses to publish/schedule if no
social_set_id is available.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| POST | `/v2/social-sets/{id}/drafts` | Create draft (publish now via `publish_at: "now"` or schedule via ISO) |
| GET | `/v2/social-sets/{id}/drafts` | List drafts |
| GET | `/v2/social-sets/{id}/drafts/{draftId}` | Get draft |
| PATCH | `/v2/social-sets/{id}/drafts/{draftId}` | Update / schedule an existing draft |
| DELETE | `/v2/social-sets/{id}/drafts/{draftId}` | Delete draft |
| GET | `/v2/social-sets` | List sets |

Payload shape:

```json
{
  "platforms": { "x": { "text": "…" }, "threads": { "text": "…" } },
  "publish_at": "2026-08-15T09:00:00Z"
}
```

## Rate limit

Header-driven: `X-RateLimit-User-Limit/Remaining/Reset` +
`X-RateLimit-SocialSet-Limit/Remaining/Reset`. `429` on exceed. Sized
for personal/team use — contact Typefully first for multi-user apps.

## Supported channels

X (Twitter), LinkedIn, Threads, Bluesky, Mastodon.

## Gotchas

- WRITE scope creates drafts; PUBLISH scope is required to schedule
  or publish immediately.
- v1 `GET /notifications/` has no v2 equivalent — do not depend on
  notification polling.

## Sources

- <https://support.typefully.com/en/articles/8718287-typefully-api>
- <https://typefully.com/docs/api>
- <https://support.typefully.com/en/articles/13128440-typefully-mcp-server>
- <https://support.typefully.com/en/articles/13133296-typefully-api-v1-v2-migration-guide>
