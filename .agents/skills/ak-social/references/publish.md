# `publish` — publish or schedule a post

Real publishing/scheduling through a provider adapter. Every call goes
through `scripts/publish-post.js`, which resolves config + env, picks
an adapter, and returns a normalized envelope `{ status, providerRef, raw }`.

## Publication Scope

Resolve the exact account/channel IDs, content/media, and time/timezone from the authorized request. Validate with dry-run when useful, then execute the approved operation. Preserve the requested channels; do not cross-post implicitly.

After a response, record the normalized receipt and verify status where supported. A timeout can occur after acceptance: reconcile through provider readback/history before retrying. If no readback exists, report the uncertain outcome instead of claiming failure or repeating the post.

## Command

```bash
node scripts/publish-post.js \
  --content "Hello world" \
  --channels x,linkedin \
  [--provider postiz] \
  [--schedule 2026-08-15T09:00:00Z] \
  [--media path/to/image.jpg] \
  [--style casual-en] \
  [--dry-run]
```

## Flags

| Flag | Required | Purpose |
|---|---|---|
| `--content <text>` | Yes (unless `--list-providers`) | Post body |
| `--channels <csv>` | Yes | `x`, `linkedin`, `instagram`, `tiktok`, `youtube`, `facebook`, `threads`, `bluesky`, `mastodon`, `pinterest`, `reddit`. `twitter` aliases to `x` |
| `--provider <id>` | No | Force a specific adapter; otherwise route via config |
| `--schedule <iso>` | No | ISO-8601 timestamp; omit to publish now |
| `--media <path>` | No | Repeatable — attach media file(s) |
| `--style <name>` | No | Apply a writing style from `assets/writing-styles/` (project) or `~/.agentkit/writing-styles/` (global) |
| `--dry-run` | No | Validate + print the payload the adapter would send. No network call |
| `--list-providers` | No | List installed adapters, channels, and env-var status. Overrides everything else |

## Precedence for adapter selection

1. `--provider <id>` on the CLI.
2. `social.channels.<channel>` in `config.yaml` — flat map, e.g.
   `channels: { x: postiz, linkedin: buffer }` (channel → provider id).
3. `social.default_provider` in `config.yaml`.
4. Fail with a clear "no provider for channel `<x>`" error naming the
   installed adapters and the env var each one needs.

## CLI vs programmatic real-publish (v2.1 limitation)

`--dry-run` is fully wired: it validates config, routes channels to
providers, resolves the writing-style, and prints the payload without
touching the network. Safe for CI.

Real publish (`--content` + `--channels` without `--dry-run`) is
wired end-to-end today for **Typefully** (uses `social_set_id` from
`social.typefully.default_social_set_id` in config). For **Postiz**,
**Buffer**, **Post Bridge**, and **Publer**, real publish also
requires provider-side integration/account IDs, which v2.1 does not
yet plumb from `config.yaml` through the CLI wrapper. Two workarounds
until v2.1.1 lands:

- Drive the adapter programmatically from
  `scripts/providers/<id>.js` — each `publish()` accepts the extra
  ids on `opts`.
- Wait for v2.1.1: the CLI will pass through
  `social.<provider>.accounts.<channel>` from config automatically.

`--dry-run` is unaffected by this limitation.

## Precedence for secrets

Shell env > project `.agentkit/.env` > global `~/.agentkit/.env`.
Values from `.env` never appear in logs — only variable names and
status.

## Errors

All errors extend `SocialError` in `scripts/lib/errors.js`. The CLI
exits non-zero and prints `code + message + a redacted body summary`.

| Code | Meaning | Action |
|---|---|---|
| `auth` | Missing/invalid credentials | Set the env var the message names |
| `rate_limit` | 429 after bounded backoff | Retry later; batch cross-platform posts to save budget |
| `channel_unsupported` | Adapter cannot post to that channel | Pick a different provider from `--list-providers` |
| `provider` | Non-2xx from provider | Read the truncated body; verify plan/scope |
| `config` | Missing/malformed config or a required setting | Follow the message's hint (path + key) |

## Examples

Publish to X + LinkedIn via the config-default provider:

```bash
node scripts/publish-post.js --content "Ship v2.1" --channels x,linkedin
```

Schedule via Postiz explicitly:

```bash
node scripts/publish-post.js \
  --content "Beta release Friday" \
  --channels x,threads \
  --provider postiz \
  --schedule 2026-08-15T09:00:00Z
```

Preview payload without hitting the API:

```bash
node scripts/publish-post.js --content "Test" --channels x --dry-run
```

Which providers are configured?

```bash
node scripts/publish-post.js --list-providers
```

## Related

- Config schema — [`config-schema.md`](config-schema.md)
- Writing styles — [`writing-styles.md`](writing-styles.md)
- Provider matrix — [`providers/README.md`](providers/README.md)
- Legacy calendar helper — [`schedule.md`](schedule.md)
