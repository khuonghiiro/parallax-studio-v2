---
provider: zernio
status: experimental
surface: REST + official CLI + hosted MCP
---

# Zernio adapter

Adapter: [`scripts/providers/zernio.js`](../../scripts/providers/zernio.js).

> **Experimental.** All facts here trace back to a single vendor doc
> site (`docs.zernio.com`); no public core repo and no independent
> adoption signal were found during research. Corroborate with a live
> test call before committing production traffic. `--dry-run` output
> labels this adapter `(experimental)`.

## Auth

- Env: `ZERNIO_API_KEY` (format `sk_…`, from dashboard → Settings → API keys).
- Header: `Authorization: Bearer <key>`.

## Base URL

- `https://zernio.com/api/v1` — override with `social.zernio.base_url`.

## Endpoints used

| Method | Path | Purpose |
|---|---|---|
| POST | `/posts` | Create/schedule |
| GET | `/posts/{id}` | Post status |
| GET | `/accounts` | List connected accounts |
| GET | `/connect/{platform}` | OAuth URL for a new account |
| GET/POST | `/profiles` | Profile containers |
| GET | `/analytics` | Post performance |

Payload shape:

```json
{
  "profileId": "…",
  "platforms": ["twitter", "linkedin"],
  "content": "…",
  "mediaUrls": ["…"],
  "scheduledAt": "2026-08-15T09:00:00Z"
}
```

`x` normalizes to `twitter` in the platforms list (Zernio's naming).

## Supported channels

X (as `twitter`), Instagram, Facebook, LinkedIn, TikTok, YouTube,
Pinterest, Reddit, Bluesky, Threads, Google Business, Telegram,
Snapchat, WhatsApp, Discord.

## Gotchas

- No public repo for the core product; adapter tests cannot use a
  known-good fixture set from source.
- Rate limits mentioned in docs but not quantified. Pull actual
  numbers from the dashboard before wiring aggressive retries.
- Vendor claims "371 CLI commands" and "496 MCP tools" — treat as
  marketing until verified with `zernio --help`.

## Sources

- <https://docs.zernio.com/>
- <https://zernio.com/>
- <https://github.com/zernio-dev/latewiz> (third-party wrapper, confirms API exists)
