---
name: ak:write
description: Marketing authoring front door for blog posts, copy drafting, CTA/CRO revisions, enhancement, and publication-ready content. Maps natural requests to one authoring workflow; strategy and analytics belong to their respective capabilities.
user-invocable: true
when_to_use: "Invoke to write creative copy, blog posts, or CRO content."
category: marketing
keywords: [write, copy, blog, cro, content]
argument-hint: "[audit|blog|blog-youtube|cro|enhance|fast|good|publish] [args]"
metadata:
  author: agentkit
  version: "1.0.1"
---

## Subcommands

| Subcommand | Description | Reference |
|------------|-------------|-----------|
| `audit` | Audit content quality against copywriting, SEO, and platform standards | `references/audit.md` |
| `blog` | 💡💡 Create SEO-optimized blog content | `references/blog.md` |
| `blog-youtube` | 💡💡 Generate SEO-optimized blog article from YouTube video | `references/blog-youtube.md` |
| `cro` | Analyze the current content and optimize for conversion | `references/cro.md` |
| `enhance` | Analyze the current copy issues and enhance it | `references/enhance.md` |
| `fast` | Write creative & smart copy [FAST] | `references/fast.md` |
| `formula` | Generate copy using proven copywriting formulas (AIDA, PAS, BAB, etc.) | `references/formula.md` |
| `good` | Write good creative & smart copy [GOOD] | `references/good.md` |
| `publish` | Audit content, auto-fix issues, output publish-ready version | `references/publish.md` |

## Routing

1. Accept natural language or the existing subcommand. Map blog writing to `blog`, YouTube adaptation to `blog-youtube`, a CTA/conversion revision to `cro`, editing to `enhance`, a quick draft to `fast`, considered copy to `good`, explicit formula work to `formula`, and review/readiness to `audit`/`publish`.
2. Load only that reference, reusing supplied audience, source material, and brand voice. For a content program/strategy or performance analysis, discover the installed strategy or analytics owner rather than forcing an authoring subcommand.
3. Deliver the requested content with verified claims. The `publish` subcommand prepares a publish-ready artifact; external publication needs an authorized target and an available publishing capability.