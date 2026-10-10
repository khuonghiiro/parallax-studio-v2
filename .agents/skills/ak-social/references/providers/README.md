# Provider adapters — index

`ak:social` publishes and schedules through provider adapters under
`scripts/providers/`. Adapter selection is config-first
(`social.channels` map) with `--provider` overriding at the CLI. Every
adapter follows the same shared interface (defined in
`scripts/lib/adapter-base.js`) and returns a normalized envelope
`{ status, providerRef, raw }`.

Auth resolution: the env resolver reads `.agentkit/.env` (project) and
`~/.agentkit/.env` (global). Shell env wins over both. Adapters refuse
to run when their required env var is missing and print the exact var
name + expected `.env` file paths.

## Supported providers

| Provider | Ref | Surface | Status |
|---|---|---|---|
| Postiz | [`postiz.md`](postiz.md) | REST + hosted MCP + CLI | Stable |
| Buffer | [`buffer.md`](buffer.md) | GraphQL + CLI + MCP | Stable (public beta 2026-05) |
| Post Bridge | [`postbridge.md`](postbridge.md) | REST + CLI + MCP | **Experimental** (paid $5/mo add-on; payload shapes unverified) |
| Typefully | [`typefully.md`](typefully.md) | REST v2 + hosted MCP | Stable |
| Zernio | [`zernio.md`](zernio.md) | REST + CLI + MCP | **Experimental** |
| Publer | [`publer.md`](publer.md) | REST (community MCP) | **Experimental** |

"Experimental" means one of:

- **Single-source vendor docs** (Zernio) — no independent adoption
  signal and no public core repo.
- **Plan-gated with unverified endpoints** (Publer) — Business plan
  gated, account-discovery endpoint not documented in the pages
  reviewed.
- **Payload shapes derived from CLI signatures, not the REST spec**
  (Post Bridge) — the Scalar-rendered API reference did not yield
  to plain WebFetch during research; first-run canary needed before
  it moves to "stable".

The `--dry-run` output and router `suggest` messages label these
adapters `(experimental)` so users see the caveat before they hit the
network.

## Promoting an adapter from experimental → stable

An adapter graduates from **experimental** to **stable** only after all
four gates below pass. Record the evidence in this file (add a dated
bullet under the adapter's status column) and update the status label
in the same commit.

1. **≥ 5 successful `publish` calls** against a real account, across
   ≥ 2 of the adapter's channels. `providerRef` must be verifiable
   from the provider dashboard (post URL or draft id).
2. **≥ 3 successful `schedule` calls** with a future `scheduleAt`,
   and the resulting scheduled item visible in the provider UI at the
   claimed time. Include one same-day and one future-day schedule.
3. **Error paths exercised.** Deliberately trigger:
   - a 401 (wrong/absent API key) → surfaces `AuthError` with the
     right env var name, no key material in the message;
   - a `channel_unsupported` case → clean `ChannelUnsupportedError`
     with suggestions;
   - a 4xx from the provider on a malformed payload → `ProviderError`
     with body summary scrubbed of any echoed credential.
4. **Payload conformance.** For REST adapters, one live-fire call
   captured with `curl -v` (or equivalent) confirms the adapter's
   payload matches the current provider spec. Attach the redacted
   trace to the promotion PR.

Post Bridge additionally requires the WebFetched Scalar reference (or
an equivalent captured OpenAPI/Scalar dump) so future edits do not
re-derive endpoints from CLI signatures.

## Excluded providers

### SocialBee

SocialBee has **no public REST/CLI/MCP surface as of 2026-08**. The
vendor's own help page ("Do you have a public API…") confirms one is
on the long-term roadmap with no timeline. Third-party trackers list an
`api.socialbee.io/v1` base URL, but it is not officially published or
developer-accessible.

Escape hatch: route through Zapier or Make (SocialBee's supported
integrations). Not implemented as a first-class adapter because the
resulting integration would depend on a third-party middleware
account, not on a SocialBee-owned interface.

If SocialBee ships a public API, add an adapter under
a new provider module and update this section after its API and adapter are verified.

Sources:
- <https://help.socialbee.com/hc/en-us/articles/29979123668375-Do-you-have-a-public-API-or-white-labeling-options>
- <https://apitracker.io/a/socialbee>
