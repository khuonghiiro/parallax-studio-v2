# Local Gallery API and Manifest

Read for integration/debugging; R2 fields do not prove any cloud upload. Source owners are `scripts/lib/router.cjs` and `scripts/lib/scanner.cjs`.

## API Routes

| Route | Purpose |
|-------|---------|
| `/hub` | Gallery HTML |
| `/api/assets` | Asset list JSON |
| `/api/brand` | Brand context JSON |
| `/api/scan` | Trigger rescan |
| `/file/*` | Serve local files |

## Manifest Schema

Assets stored in `.assets/manifest.json` with R2 fields:

```json
{
  "id": "abc123",
  "path": "banners/hero.png",
  "category": "banner",
  "r2": {
    "status": "local",  // local|pending|synced|error
    "bucket": null,
    "url": null
  }
}
```
