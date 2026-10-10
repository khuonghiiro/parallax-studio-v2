---
name: ak:content-hub
description: Browser-based asset gallery for managing marketing assets. Visual grid with filter/search, brand context sidebar, and actions (preview, edit, generate). Use when browsing assets, managing content library, or generating new assets with brand context.
user-invocable: true
when_to_use: "Invoke to open or browse the marketing asset gallery in the browser."
category: marketing
keywords: [gallery, assets, browse, search, hub]
argument-hint: "[action: open|browse|search]"
license: MIT
allowed-tools:
  - Bash
  - Read
required_capabilities:
  - run_shell
  - read_file
metadata:
  author: agentkit
  version: "1.0.1"
---

# Content Hub

Visual asset gallery for AgentKit Marketing.

## Operate the Local Gallery

Resolve open, scan, reuse, or stop intent. Check whether this project already has a running gallery and reuse it. Record the command, project, PID, and port for any server started. The stop command can stop multiple tracked servers: inspect its process ownership first and stop only servers owned by this task.

Opening and scanning are local operations; do not claim cloud synchronization or upload from manifest fields.

## Quick Start

```bash
# Open gallery
node scripts/server.cjs --open

# Rescan assets
node scripts/server.cjs --scan

# Stop server
node scripts/server.cjs --stop
```

Or use command: `/write:hub`

## Features

- **Gallery Grid**: Thumbnails of assets/ folder
- **Filter/Search**: By type (banners, designs, etc.) and keywords
- **Brand Sidebar**: Displays user's colors and voice from docs/brand-guidelines.md
- **Actions**: Preview, Edit in Claude, Copy path, Generate new
- Cloud synchronization is not implemented by this local gallery workflow.

## Developer Reference

For integration/debugging only, load `references/local-api-and-manifest.md`.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/server.cjs` | HTTP server entry |
| `scripts/lib/scanner.cjs` | Scan assets directory |
| `scripts/lib/router.cjs` | HTTP routing |
| `scripts/lib/brand-context.cjs` | Extract brand guidelines |

## Integration

**Command**: `/write:hub`

**Related Skills**: brand, ai-multimodal, design

**Agents**: content-creator, ui-ux-designer
