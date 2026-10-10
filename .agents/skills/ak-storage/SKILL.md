---
name: ak:storage
description: S3-compatible object storage integration for marketing assets. Works with Cloudflare R2, AWS S3, MinIO, Backblaze B2, DigitalOcean Spaces.
user-invocable: true
when_to_use: "Invoke to upload, download, list, or sync marketing assets in S3-compatible storage."
category: engineering
keywords: [storage, s3, upload, sync, bucket]
argument-hint: "[upload|download|list|sync] [file|path] [--bucket <name>]"
metadata:
  author: agentkit
  version: "1.0.1"
---

# Storage Skill

S3-compatible object storage integration for marketing assets. Works with Cloudflare R2, AWS S3, MinIO, Backblaze B2, DigitalOcean Spaces.

## When to Use

- Upload generated assets (images, videos, slides) to cloud storage
- Sync local asset folders to remote bucket
- Get public URLs for sharing/embedding
- List remote assets

## Resolve the Operation

Select list, upload, download, or sync and resolve the authorized endpoint, bucket, prefix, and files. Inspect destination collisions before overwrite; sync means only the requested objects and does not imply remote deletion or changing public access. The bundled client exposes individual object operations, so do not invent a sync CLI.

Verify each result and object state through an available readback capability. Reconcile uncertain uploads by deterministic key/metadata before retrying. A constructed public URL is not proof of public accessibility; verify access policy and retrieval before describing it as shareable. Keep missing-credential assets local and report that no upload occurred.

## Configuration

Required env vars in user's `.env`:
```bash
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=xxxxx
S3_SECRET_ACCESS_KEY=xxxxx
S3_BUCKET=my-assets
S3_REGION=auto                        # optional, default: auto
S3_PUBLIC_URL=https://cdn.example.com # optional, custom domain
```

## Scripts

### s3-client.cjs
S3-compatible client for storage operations.

```javascript
const s3 = require('./scripts/s3-client.cjs');

// Check if configured
if (!s3.isConfigured()) {
  console.log('S3 not configured, using local storage only');
}

// Upload
const result = await s3.upload('./assets/image.png', 'designs/image.png');
// { success: true, url: 'https://...' }

// Download
await s3.download('designs/image.png', './local/image.png');

// List
const { objects } = await s3.list('designs/');

// Get URL
const url = s3.getPublicUrl('designs/image.png');

// Delete
await s3.remove('designs/old-image.png');
```

## Fallback Behavior

If S3 not configured:
- `isConfigured()` returns `false`
- All operations return graceful errors
- No exceptions thrown
- Report local paths explicitly as local and not uploaded; never present them as public URLs.

## Provider Examples

| Provider | Endpoint |
|----------|----------|
| Cloudflare R2 | `https://<account>.r2.cloudflarestorage.com` |
| AWS S3 | `https://s3.<region>.amazonaws.com` |
| MinIO | `http://localhost:9000` |
| Backblaze B2 | `https://s3.<region>.backblazeb2.com` |
| DigitalOcean | `https://<region>.digitaloceanspaces.com` |

## Installation

Resolve the dependency environment that owns `scripts/s3-client.cjs`; reuse an available storage capability or install the SDK in that skill/project-owned environment as appropriate. Do not modify an unrelated project manifest merely to use this utility. Example dependency:
```bash
npm install @aws-sdk/client-s3
```

Without SDK installed, all operations gracefully return `{success: false, error: 'S3 not configured'}`.

## Security

- Credentials only in `.env` (gitignored)
- Never logged or exposed
- Use bucket-scoped tokens (least privilege)
