# Provider and Configuration Background

Read when configuring an operational provider. The current adapter source, configuration resolver, and selected provider's documentation own actual support; copied status labels do not prove account access.

## Configuration

Every setting is optional; sensible defaults apply. Project overrides
global on every field.

| Kind | Project | Global |
|---|---|---|
| Config | `.agentkit/config.yaml` | `~/.agentkit/config.yaml` |
| Secrets | `.agentkit/.env` | `~/.agentkit/.env` |
| Writing styles | `assets/writing-styles/*` | `~/.agentkit/writing-styles/*` |

Full schema: [`references/config-schema.md`](config-schema.md).
Writing-styles resolver order + file formats:
[`references/writing-styles.md`](writing-styles.md).

> **Config Editor gap:** The AgentKit desktop Config Editor renders
> flat step-ids from the Go-side runtime and does not yet know about
> the nested `social:` YAML section. Edit `config.yaml` directly for
> now; a Config Editor integration is tracked as a follow-up.

Shell env wins over both `.env` files (so `POSTIZ_API_KEY=…` in the
current shell always applies). Values from `.env` files never appear in
logs — the adapters print variable names and status only.

## Providers

Provider matrix + adapter interface details:
[`references/providers/README.md`](providers/README.md).

| Provider | Ref | Status |
|---|---|---|
| Postiz | [postiz.md](providers/postiz.md) | Stable |
| Buffer | [buffer.md](providers/buffer.md) | Stable |
| Typefully | [typefully.md](providers/typefully.md) | Stable |
| Post Bridge | [postbridge.md](providers/postbridge.md) | Experimental (payload shapes unverified) |
| Zernio | [zernio.md](providers/zernio.md) | Experimental |
| Publer | [publer.md](providers/publer.md) | Experimental |

SocialBee has no public API in 2026-08 — excluded, escape via
Zapier/Make. See providers/README.md for the note.
