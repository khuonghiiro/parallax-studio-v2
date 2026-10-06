/**
 * Helper to load binary asset data from the assets folder.
 * Supports:
 * - Electron renderer runtime via window.api.loadBuiltInAssetBytes
 * - Node.js runtime (Vitest unit tests, MCP server, scripts) via fs/promises
 */
export async function loadAssetBytesFromDiskOrBuiltIn(
  targetPath: string
): Promise<{ name: string; mime: string; data: Uint8Array } | null> {
  if (!targetPath) return null
  const clean = targetPath.replace(/\\/g, '/').replace(/^assets\//, '')

  // 1. Electron renderer runtime
  if (typeof window !== 'undefined' && window.api?.loadBuiltInAssetBytes) {
    try {
      const res = await window.api.loadBuiltInAssetBytes(clean)
      if (res && res.data) return res
    } catch {
      /* try node fallback */
    }
  }

  // 2. Node.js runtime fallback (Vitest, MCP, scripts)
  try {
    const { readFile } = await import('fs/promises')
    const { join, basename, extname } = await import('path')
    const full = join(process.cwd(), 'assets', clean)
    const buf = await readFile(full)
    const ext = extname(clean).slice(1).toLowerCase()
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'gif'
        ? 'image/gif'
        : ext === 'webp'
        ? 'image/webp'
        : ext === 'wav'
        ? 'audio/wav'
        : ext === 'mp3'
        ? 'audio/mpeg'
        : 'image/png'

    return { name: basename(clean), mime, data: new Uint8Array(buf) }
  } catch {
    return null
  }
}
