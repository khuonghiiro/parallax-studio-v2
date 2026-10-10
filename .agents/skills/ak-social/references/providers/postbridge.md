---
provider: postbridge
status: experimental
surface: REST + official CLI + official hosted MCP
pricing: paid API add-on ($5/mo)
---

# Post Bridge adapter

Adapter: [`scripts/providers/postbridge.js`](../../scripts/providers/postbridge.js).

> **Experimental.** REST payload shapes here are derived from CLI
> signatures at `support.post-bridge.com`, not from a scraped or
> WebFetched copy of the REST reference (the interactive
> `api.post-bridge.com/reference` page is Scalar-rendered and did not
> yield to plain WebFetch during research). Run a live-fire canary
> against `POST /post` before treating this as stable. `--dry-run`
> and the router `suggest` output label this adapter `(experimental)`.

## Auth

- Env: `POSTBRIDGE_API_KEY` (format `pb_live_…`, from dashboard → API keys).
- Header: `Authorization: Bearer <key>`.
- Requires the paid API add-on ($5/mo on top of a subscription). MCP
  also supports OAuth.

## Base URL

- `https://api.post-bridge.com` — override with
  `social.postbridge.base_url` in `config.yaml`.

## Endpoints used

Endpoint paths follow the CLI signatures documented at
`support.post-bridge.com`. The interactive REST reference at
`api.post-bridge.com/reference` is Scalar-rendered and did not yield
to WebFetch during research — verify final paths against the
`post-bridge-api` npm SDK before shipping a first live-fire adapter
call.

| Method | Path (verify via SDK) | Purpose |
|---|---|---|
| GET | `/accounts` | List connected accounts |
| POST | `/post` | Publish now |
| POST | `/schedule` | Schedule for a future time |
| POST | `/upload` | Upload media |

Payload shape (schedule):

```json
{ "caption": "…", "accounts": [1, 2, 3], "media": ["…"], "schedule": "2026-08-15T14:00:00Z" }
```

## Supported channels

Instagram, TikTok, YouTube (Shorts), X, LinkedIn, Facebook, Pinterest,
Threads, Bluesky.

## Gotchas

- API is a paid add-on; adapters return an authoritative 401/403 body
  via `ProviderError` when the account lacks the add-on.
- REST reference page requires JS rendering — do not scrape it, use
  the SDK or CLI.
- Community support is via Discord (`#api`), not an SLA.

## Sources

- <https://support.post-bridge.com/api/post-bridge-api-overview-access-and-pricing>
- <https://github.com/post-bridge-hq/agent-mode>
- <https://api.post-bridge.com/reference> (JS-rendered, verify payloads via SDK)
- <https://www.npmjs.com/package/post-bridge-api>
