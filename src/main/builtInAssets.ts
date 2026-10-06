import { app, ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { readdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, extname, join, relative } from 'path'
import type {
  BuiltInAssetCategory,
  BuiltInAssetItem,
  BuiltInCatalogResult,
  BuiltInSaveManifestResult
} from '@shared/ipc'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'])

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac'
}

const DEFAULT_CATEGORIES: BuiltInAssetCategory[] = [
  {
    id: 'all',
    folder: '',
    title: 'Tất cả tài nguyên',
    icon: 'all',
    description: 'Toàn bộ tài nguyên có sẵn trong thư mục assets'
  },
  {
    id: 'city',
    folder: 'city',
    title: 'Thành phố & Đô thị',
    icon: 'city',
    description: 'Ảnh phong cảnh thành phố, đường phố mưa đêm, ban công và nhà chọc trời'
  },
  {
    id: 'demos',
    folder: 'demos',
    title: 'Hiệu ứng & Hoạt ảnh (VFX)',
    icon: 'sparkles',
    description: 'Hoạt ảnh GIF ngọn lửa trại, quả cầu hologram, cổng năng lượng và đom đóm'
  },
  {
    id: 'audio',
    folder: 'audio',
    title: 'Âm thanh & Nhạc nền',
    icon: 'music',
    description: 'Nhạc nền, tiếng chuông ambient và hiệu ứng âm thanh cho phân cảnh'
  }
]

export function getAssetsRoot(): string {
  const devPath = join(process.cwd(), 'assets')
  if (existsSync(devPath)) return devPath
  const appPath = join(app.getAppPath(), 'assets')
  if (existsSync(appPath)) return appPath
  const resPath = join(process.resourcesPath, 'assets')
  if (existsSync(resPath)) return resPath
  return devPath
}

async function readManifestJson(root: string): Promise<{ categories: BuiltInAssetCategory[]; rawJson: string; manifestPath: string }> {
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath)) {
    const raw = JSON.stringify({ categories: DEFAULT_CATEGORIES }, null, 2)
    try {
      await writeFile(manifestPath, raw, 'utf-8')
    } catch {
      /* ignore write failure */
    }
    return { categories: DEFAULT_CATEGORIES, rawJson: raw, manifestPath }
  }

  try {
    const rawJson = await readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(rawJson)
    const list: BuiltInAssetCategory[] = Array.isArray(parsed?.categories) ? parsed.categories : []
    return {
      categories: list.length > 0 ? list : DEFAULT_CATEGORIES,
      rawJson,
      manifestPath
    }
  } catch (err) {
    console.warn('[BuiltInAssets] Failed to parse manifest.json, using fallback:', err)
    return {
      categories: DEFAULT_CATEGORIES,
      rawJson: JSON.stringify({ categories: DEFAULT_CATEGORIES }, null, 2),
      manifestPath
    }
  }
}

async function collectFilesRecursively(dir: string, baseDir: string): Promise<string[]> {
  const results: string[] = []
  if (!existsSync(dir)) return results

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursively(fullPath, baseDir)
      results.push(...nested)
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

async function buildAssetItem(fullPath: string, rootDir: string): Promise<BuiltInAssetItem | null> {
  const ext = extname(fullPath).slice(1).toLowerCase()
  const isImage = IMAGE_EXTS.has(ext)
  const isAudio = AUDIO_EXTS.has(ext)
  if (!isImage && !isAudio) return null

  const rel = relative(rootDir, fullPath).replace(/\\/g, '/')
  const folder = rel.includes('/') ? rel.split('/')[0] : ''
  const fileStat = await stat(fullPath)
  const mime = MIME_MAP[ext] || (isImage ? 'image/png' : 'audio/mpeg')
  const fileName = basename(fullPath)
  const cleanName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ')

  let previewUrl: string | undefined
  if (isImage && fileStat.size <= 4 * 1024 * 1024) {
    try {
      const buf = await readFile(fullPath)
      previewUrl = `data:${mime};base64,${buf.toString('base64')}`
    } catch {
      /* ignore preview generation */
    }
  }

  return {
    id: `builtin:${rel}`,
    name: cleanName,
    fileName,
    relativePath: rel,
    folder,
    ext,
    mime,
    kind: isImage ? 'image' : 'audio',
    size: fileStat.size,
    path: fullPath,
    isAnimated: ext === 'gif',
    previewUrl
  }
}

export async function scanBuiltInCatalog(): Promise<BuiltInCatalogResult> {
  const root = getAssetsRoot()
  const { categories, rawJson, manifestPath } = await readManifestJson(root)
  const allFiles = await collectFilesRecursively(root, root)

  const items: BuiltInAssetItem[] = []
  for (const filePath of allFiles) {
    if (basename(filePath).toLowerCase() === 'manifest.json') continue
    if (basename(filePath).toLowerCase() === 'readme.md') continue
    const item = await buildAssetItem(filePath, root)
    if (item) items.push(item)
  }

  return { categories, items, manifestPath, rawJson }
}

export async function saveManifestJson(rawJson: string): Promise<BuiltInSaveManifestResult> {
  try {
    const parsed = JSON.parse(rawJson)
    if (!parsed || !Array.isArray(parsed.categories)) {
      return { ok: false, error: 'JSON phải chứa thuộc tính "categories" là một danh sách mảng []' }
    }
    const root = getAssetsRoot()
    const manifestPath = join(root, 'manifest.json')
    const formatted = JSON.stringify(parsed, null, 2)
    await writeFile(manifestPath, formatted, 'utf-8')
    const catalog = await scanBuiltInCatalog()
    return { ok: true, catalog }
  } catch (err) {
    return { ok: false, error: `Lỗi cú pháp JSON: ${String(err)}` }
  }
}

export async function loadAssetBytes(relPath: string): Promise<{ name: string; mime: string; data: Uint8Array } | null> {
  const root = getAssetsRoot()
  const fullPath = join(root, relPath)
  if (!existsSync(fullPath)) return null

  const ext = extname(fullPath).slice(1).toLowerCase()
  const mime = MIME_MAP[ext] || 'application/octet-stream'
  const data = await readFile(fullPath)
  return {
    name: basename(fullPath),
    mime,
    data: new Uint8Array(data)
  }
}

export function registerBuiltInAssetsIpc(): void {
  ipcMain.handle('builtinAssets:getCatalog', async () => scanBuiltInCatalog())

  ipcMain.handle('builtinAssets:saveManifest', async (_e, rawJson: string) => saveManifestJson(rawJson))

  ipcMain.handle('builtinAssets:loadAssetBytes', async (_e, relPath: string) => loadAssetBytes(relPath))

  ipcMain.handle('builtinAssets:openFolder', async (_e, subFolder?: string) => {
    const root = getAssetsRoot()
    const target = subFolder ? join(root, subFolder) : root
    if (existsSync(target)) {
      await shell.openPath(target)
    } else {
      await shell.openPath(root)
    }
  })
}
