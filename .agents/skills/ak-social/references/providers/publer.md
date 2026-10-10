---
provider: publer
status: experimental
surface: REST (community MCPs only)
pricing: Business plan required
---

# Publer adapter

Adapter: [`scripts/providers/publer.js`](../../scripts/providers/publer.js).

> **Experimental.** The API is gated behind the Publer Business plan,
> and the account-discovery endpoint (`GET /accounts` or
> `GET /workspaces`) was not documented in the pages reviewed during
> research (2026-08-07). Verify against
> `publer.com/docs/api-reference/introduction` before shipping account
> discovery. `--dry-run` output labels this adapter `(experimental)`.

## Auth

- Env: `PUBLER_API_KEY` (from Settings → Access & Login → API Keys).
- Env: `PUBLER_WORKSPACE_ID` (or `social.publer.workspace_id` in
  `config.yaml`). Required on every request.
- Headers:
  - `Authorization: Bearer-API <key>` (note the `-API` suffix)
  - `Publer-Workspace-Id: <workspace-id>`

## Base URL

- `https://app.publer.com/api/v1` — override with
  `social.publer.base_url`.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| GET | `/posts?state=scheduled` | Fallback account/workspace probe |
| POST | `/posts/schedule` | Schedule draft (async job) |
| POST | `/posts/schedule/publish` | Publish now (async job) |
| GET | `/job_status/{job_id}` | Poll async job |

Schedule/publish are **asynchronous** — the initial POST returns a
job id, and `pollJobStatus(jobId)` polls `/job_status/{id}` with
bounded backoff.

Payload shape:

```json
{
  "bulk": {
    "state": "scheduled",
    "posts": [{
      "networks": { "twitter": { "type": "status", "text": "…" } },
      "accounts": [ { "id": "…", "scheduled_at": "2026-08-15T09:00:00Z" } ]
    }]
  }
}
```

## Supported channels

Facebook, Instagram, X (as `twitter`), LinkedIn, Pinterest, YouTube,
TikTok, Google Business, WordPress, Telegram, Mastodon, Threads,
Bluesky.

## Gotchas

- Business plan gated — 401/403 with a "requires plan upgrade" body
  surfaces via `ProviderError` when the account isn't eligible.
- Two-header auth is unusual — both must be present, or the request
  is rejected at the edge.
- Community MCPs (`alexkess/publer-mcp-server`, `IsliBasha/publer-mcp`)
  are unofficial. Audit before using them against your API key.

## Sources

- <https://publer.com/docs/getting-started/authentication>
- <https://publer.com/docs/api-reference/posts>
- <https://publer.com/docs/posting/create-posts>
- <https://github.com/alexkess/publer-mcp-server>
