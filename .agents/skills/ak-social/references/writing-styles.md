# Writing styles in `ak:social`

`ak:social` shares the writing-style catalog and file format with
an installed copywriting capability when present. Resolve its writing-style
reference from the live catalog for additional guidance; the resolver and
descriptor shape below own this social workflow's local behavior.

## Resolver order

`scripts/lib/resolve-writing-style.js` reads, in precedence order:

1. `<cwd>/assets/writing-styles/` — project styles
2. `<AGENTKIT_HOME>/writing-styles/` (default `~/.agentkit/writing-styles/`) — global styles

Same-named files in the project directory win. Missing directories return
an empty catalog — never an error.

## Supported extensions

- `.yaml` / `.yml` — parsed as a structured style descriptor
- `.md` — frontmatter is parsed; the remaining body becomes `style.body`

## Style descriptor shape

```js
{
  name: 'indie-hacker',            // from `name:` field or the filename
  description: '',
  dimensions: {                    // arbitrary key/value dimensions
    tone: 'casual',
    pace: 'fast',
  },
  patterns: [ 'Short sentences', 'Fragments' ],
  avoid:    [ 'Corporate speak' ],
  examples: [ 'Shipped v1 in 48 hours.' ],
  body: '',                        // markdown body (for .md files)
  source: '/…/assets/writing-styles/indie-hacker.yaml',
  raw: { /* original parsed doc */ },
}
```

## How `ak:social` uses styles

- `/ak:social` post-drafting flows hand the resolved style descriptor to
  the `copywriter` / `content-creator` agents so drafts match the user's
  voice.
- `scripts/publish-post.js --style <name>` overrides the config default.
- The router does not modify content — provider adapters publish the
  final text as-is once drafting is done.

## Adding a new style

Drop a `.yaml` or `.md` file into either directory. Example:

```yaml
# ~/.agentkit/writing-styles/duy-vietnamese.yaml
name: duy-vietnamese
description: Duy's Vietnamese social voice — concise, evidence-first
dimensions:
  tone: warm-technical
  language: vi
patterns:
  - Câu ngắn, ý gọn
  - Trích dẫn nguồn cụ thể
avoid:
  - Marketing sáo rỗng
```
