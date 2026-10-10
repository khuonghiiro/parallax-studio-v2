# `social:` config schema

The `ak:social` skill resolves configuration from two YAML files, in
precedence order (project overrides global at the top level):

1. `<cwd>/.agentkit/config.yaml` — project-scoped
2. `<AGENTKIT_HOME>/config.yaml` (defaults to `~/.agentkit/config.yaml`) — global

The env resolver mirrors this order for `.agentkit/.env`.

## AK desktop Config Editor status

The desktop app's Config Editor today registers widgets from the flat
step-id set in `apps/cli/internal/commands/setupcmd/steps.go` and does not
yet render a nested `social:` block. Users configure `ak:social` by editing
the YAML file directly. Wiring the `social:` section into the Config Editor
is tracked as a follow-up on top of
archived plan `260803-1235-config-editor-input-types` (indexed on AgentWiki).

The config resolver is written to **preserve unknown top-level keys** so
that a hand-edited `social:` block survives round-trips through any future
Config-Editor save. This is asserted by the
`preserves unknown top-level keys` unit test in
`scripts/tests/resolve-config.test.js`.

## Schema

```yaml
# ~/.agentkit/config.yaml or <cwd>/.agentkit/config.yaml
social:
  # Default provider for /ak:social publish/schedule when --provider is not
  # supplied. Must match one of the configured providers below.
  default_provider: postiz

  # Default writing style name. Resolved against project
  # assets/writing-styles/ then ~/.agentkit/writing-styles/.
  default_style: indie-hacker

  # Default language for drafts. Skill hands off to ak:copywriting when
  # unset.
  language: en

  # Ordered channel → provider map. First provider that supports the
  # channel wins. Missing channels fall back to default_provider.
  channels:
    x: postiz
    linkedin: buffer
    threads: typefully
    bluesky: typefully

  # Per-provider settings. Each block is optional; omit blocks for
  # providers you don't use. API keys never live in this file — they
  # come from .agentkit/.env.
  postiz:
    base_url: https://api.postiz.com/public/v1
    # Optional integration_id filter: only allow posts to these
    # connected accounts.
    integrations: []

  buffer:
    # Buffer's new GraphQL API; personal API key only (no third-party
    # OAuth as of 2026-08). See references/providers/buffer.md.
    base_url: https://api.buffer.com

  postbridge:
    base_url: https://api.post-bridge.com

  typefully:
    # Typefully v2 scopes drafts to a social_set_id. Set the default
    # here; publish-post.js resolves it at call time via GET /v2/social-sets.
    default_social_set_id: ""

  zernio:
    # experimental — vendor docs only, no independent adoption signal.
    base_url: https://zernio.com/api/v1

  publer:
    # experimental — Business plan gated; requires workspace ID.
    base_url: https://app.publer.com/api/v1
    # Publer requires two headers on every request. The workspace ID
    # can be here (public) or in .env (private) as PUBLER_WORKSPACE_ID.
    workspace_id: ""
```

## Env keys (`.agentkit/.env`)

| Env var | Consumer |
|---|---|
| `POSTIZ_API_KEY` | Postiz adapter |
| `BUFFER_API_KEY` | Buffer adapter |
| `POSTBRIDGE_API_KEY` | Post Bridge adapter |
| `TYPEFULLY_API_KEY` | Typefully adapter |
| `ZERNIO_API_KEY` | Zernio adapter (experimental) |
| `PUBLER_API_KEY` | Publer adapter (experimental) |
| `PUBLER_WORKSPACE_ID` | Publer adapter (required; may also be in config) |
| `AGENTKIT_HOME` | Overrides `~/.agentkit` for both files |

Adapters refuse to run and print the exact env var name + expected `.env`
file paths when a required key is missing. No key is ever printed back to
the shell or written to logs — `scripts/lib/http-client.js` redacts every
non-safe header before including a request in error output.

## Precedence quick reference

- `config.yaml` — project block wins over global block, key-by-key at the
  top level. Nested maps are replaced whole when the project supplies them.
- `.env` — same file precedence, plus shell env wins over both (a value
  already exported never gets overwritten). Empty shell values do not
  override file values.
- `assets/writing-styles/` — project files override same-named global
  files.

## Related

- Writing-style resolver: `scripts/lib/resolve-writing-style.js` (per this
  skill), catalog reference in
  `../../../../kits/core/skills/ak-copywriting/references/writing-styles.md`.
- Env resolver: `scripts/lib/resolve-env.js`.
- Config resolver: `scripts/lib/resolve-config.js`.
