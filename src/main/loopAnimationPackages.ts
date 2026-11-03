import { existsSync } from 'fs'
import { mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { toUnaccentedSnakeCase } from '../shared/slugify'
import type { LoopAnimationPackageJson } from '../shared/types'

export interface SaveLoopPackagePayload {
  folderName: string
  name: string
  category?: string
  jsonContent: string
  frames: Array<{
    fileName: string
    data: Uint8Array | string
  }>
  thumbnail?: {
    fileName: string
    data: Uint8Array | string
  }
}

export interface SaveLoopPackageResult {
  ok: boolean
  folderName?: string
  folderPath?: string
  relPath?: string
  jsonRelPath?: string
  thumbnailRelPath?: string
  error?: string
}

function bufferFromData(data: Uint8Array | string): Buffer {
  if (data instanceof Uint8Array) {
    return Buffer.from(data)
  }
  if (typeof data === 'string') {
    if (data.startsWith('data:')) {
      const idx = data.indexOf(',')
      if (idx >= 0) {
        return Buffer.from(data.slice(idx + 1), 'base64')
      }
    }
    return Buffer.from(data, 'base64')
  }
  return Buffer.alloc(0)
}

/**
 * Lưu gói hoạt ảnh lặp vào thư mục không dấu `assets/loop_animations/<slug>/`
 * gồm các tệp frame ảnh PNG đã tách nền sẵn, ảnh đại diện thumbnail và tệp animation.json
 */
export async function saveLoopAnimationPackageToDisk(
  root: string,
  payload: SaveLoopPackagePayload
): Promise<SaveLoopPackageResult> {
  try {
    if (!payload.name && !payload.folderName) {
      return { ok: false, error: 'Thiếu tên hoạt ảnh lặp' }
    }

    const folderSlug = toUnaccentedSnakeCase(payload.folderName || payload.name, 'loop_anim')
    const loopRoot = join(root, 'loop_animations')
    const targetDir = join(loopRoot, folderSlug)

    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    // 1. Ghi từng file frame ảnh PNG
    let firstFrameBuffer: Buffer | null = null
    for (const f of payload.frames) {
      if (!f.fileName || !f.data) continue
      const buf = bufferFromData(f.data)
      if (buf.length === 0) continue
      if (!firstFrameBuffer) firstFrameBuffer = buf
      const fPath = join(targetDir, f.fileName)
      await writeFile(fPath, buf)
    }

    // 2. Ghi thumbnail.png
    let thumbBuf: Buffer | null = null
    if (payload.thumbnail?.data) {
      thumbBuf = bufferFromData(payload.thumbnail.data)
    } else if (firstFrameBuffer) {
      thumbBuf = firstFrameBuffer
    }
    if (thumbBuf && thumbBuf.length > 0) {
      await writeFile(join(targetDir, 'thumbnail.png'), thumbBuf)
    }

    // 3. Chuẩn hoá và ghi animation.json
    let parsed: any = {}
    try {
      parsed = JSON.parse(payload.jsonContent)
    } catch {
      parsed = {}
    }
    parsed.version = parsed.version || '1.0'
    parsed.id = folderSlug
    parsed.slug = folderSlug
    parsed.name = payload.name.trim() || parsed.name || folderSlug
    parsed.category = payload.category || parsed.category || 'custom'
    parsed.thumbnail = 'thumbnail.png'
    parsed.updatedAt = Date.now()
    if (!parsed.createdAt) parsed.createdAt = parsed.updatedAt

    const jsonPath = join(targetDir, 'animation.json')
    await writeFile(jsonPath, JSON.stringify(parsed, null, 2), 'utf-8')

    // 4. Đồng bộ vào manifests/loop-animator.json và manifest.json
    await syncPackageToManifests(root, folderSlug, parsed)

    const relPath = `loop_animations/${folderSlug}`
    const jsonRelPath = `${relPath}/animation.json`
    const thumbnailRelPath = `${relPath}/thumbnail.png`

    return {
      ok: true,
      folderName: folderSlug,
      folderPath: targetDir,
      relPath,
      jsonRelPath,
      thumbnailRelPath
    }
  } catch (err) {
    console.error('[loopAnimationPackages] Failed to save loop package:', err)
    return { ok: false, error: String(err) }
  }
}

/** Cập nhật manifest để xưởng loop animator nhận diện ngay lập tức */
async function syncPackageToManifests(
  root: string,
  slug: string,
  parsedMeta: any
): Promise<void> {
  const assetKey = `loop_animations/${slug}/animation.json`
  const metaEntry = {
    name: parsedMeta.name || slug,
    category: parsedMeta.category || 'custom',
    folder: `loop_animations/${slug}`,
    frameCount: Array.isArray(parsedMeta.frames) ? parsedMeta.frames.length : parsedMeta.frameCount || 0,
    fps: parsedMeta.fps || 12,
    loopMode: parsedMeta.loopMode || 'loop',
    thumbnail: `loop_animations/${slug}/thumbnail.png`,
    status: 'active'
  }

  // 1. manifests/loop-animator.json
  const loopManifestPath = join(root, 'manifests', 'loop-animator.json')
  if (existsSync(loopManifestPath)) {
    try {
      const raw = await readFile(loopManifestPath, 'utf-8')
      const data = JSON.parse(raw)
      data.assets = data.assets || {}
      data.assets[assetKey] = metaEntry
      await writeFile(loopManifestPath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.warn('[loopAnimationPackages] Could not update loop-animator.json:', e)
    }
  }

  // 2. manifest.json
  const mainManifestPath = join(root, 'manifest.json')
  if (existsSync(mainManifestPath)) {
    try {
      const raw = await readFile(mainManifestPath, 'utf-8')
      const data = JSON.parse(raw)
      data.assets = data.assets || {}
      data.assets[assetKey] = metaEntry
      await writeFile(mainManifestPath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (e) {
      console.warn('[loopAnimationPackages] Could not update main manifest.json:', e)
    }
  }
}

/** Đọc cấu hình tệp animation.json từ đĩa */
export async function loadLoopAnimationPackageFromDisk(
  root: string,
  relPathOrJson: string
): Promise<{ ok: boolean; data?: LoopAnimationPackageJson; error?: string }> {
  try {
    let clean = relPathOrJson.replace(/\\/g, '/').replace(/^assets\//, '').replace(/^builtin:/, '').trim()
    if (!clean.endsWith('animation.json')) {
      clean = clean.replace(/\/+$/, '') + '/animation.json'
    }
    const fullPath = join(root, clean)
    if (!existsSync(fullPath)) {
      return { ok: false, error: `Không tìm thấy tệp cấu hình: ${clean}` }
    }
    const raw = await readFile(fullPath, 'utf-8')
    const data = JSON.parse(raw) as LoopAnimationPackageJson
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

/** Quét toàn bộ thư mục loop_animations/ để tìm các gói hoạt ảnh */
export async function scanLoopAnimationPackagesOnDisk(
  root: string
): Promise<LoopAnimationPackageJson[]> {
  const loopRoot = join(root, 'loop_animations')
  const results: LoopAnimationPackageJson[] = []
  if (!existsSync(loopRoot)) return results

  try {
    const entries = await readdir(loopRoot, { withFileTypes: true })
    for (const ent of entries) {
      if (!ent.isDirectory()) continue
      const jsonFile = join(loopRoot, ent.name, 'animation.json')
      if (existsSync(jsonFile)) {
        try {
          const raw = await readFile(jsonFile, 'utf-8')
          const parsed = JSON.parse(raw) as LoopAnimationPackageJson
          results.push(parsed)
        } catch {
          /* ignore corrupted json */
        }
      }
    }
  } catch {
    /* ignore read errors */
  }
  return results
}
