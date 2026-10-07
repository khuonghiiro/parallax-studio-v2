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

export function sortCategories(categories: BuiltInAssetCategory[]): BuiltInAssetCategory[] {
  return [...categories].sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : 9999
    const orderB = typeof b.order === 'number' ? b.order : 9999
    if (orderA !== orderB) return orderA - orderB
    return (a.title || a.id).localeCompare(b.title || b.id, 'vi')
  })
}

const DEFAULT_CATEGORIES: BuiltInAssetCategory[] = [
  {
    id: 'all',
    folder: '',
    title: 'Tất cả tài nguyên',
    icon: 'all',
    description: 'Toàn bộ tài nguyên có sẵn trong thư mục assets',
    order: 0
  },
  {
    id: 'demo_transparent',
    folder: 'demo_transparent',
    title: 'Cảnh mẫu trong suốt (2.5D)',
    icon: 'image',
    description: 'Bộ ảnh phân tầng nền trong suốt kiểm thử Parallax 2.5D',
    order: 1
  },
  {
    id: 'city',
    folder: 'city',
    title: 'Thành phố & Đô thị',
    icon: 'city',
    description: 'Ảnh phong cảnh thành phố, đường phố mưa đêm, ban công và nhà chọc trời',
    order: 2
  },
  {
    id: 'demos',
    folder: 'demos',
    title: 'Hiệu ứng & Hoạt ảnh (VFX)',
    icon: 'sparkles',
    description: 'Hoạt ảnh GIF ngọn lửa trại, quả cầu hologram, cổng năng lượng và đom đóm',
    order: 3
  },
  {
    id: 'audio',
    folder: 'audio',
    title: 'Âm thanh & Nhạc nền',
    icon: 'music',
    description: 'Nhạc nền, tiếng chuông ambient và hiệu ứng âm thanh cho phân cảnh',
    order: 4
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

interface ManifestConfig {
  categories: BuiltInAssetCategory[]
  assetsConfig: Record<string, string | { name?: string; description?: string }>
  rawJson: string
  manifestPath: string
}

async function readManifestJson(root: string): Promise<ManifestConfig> {
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath)) {
    const raw = JSON.stringify({ categories: DEFAULT_CATEGORIES }, null, 2)
    try {
      await writeFile(manifestPath, raw, 'utf-8')
    } catch {
      /* ignore write failure */
    }
    return { categories: DEFAULT_CATEGORIES, assetsConfig: {}, rawJson: raw, manifestPath }
  }

  try {
    const rawJson = await readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(rawJson)
    const list: BuiltInAssetCategory[] = Array.isArray(parsed?.categories) ? parsed.categories : []
    const normalizedList = list.map((c) => ({
      ...c,
      order: typeof c.order === 'number' ? c.order : typeof (c as { index?: number }).index === 'number' ? (c as { index?: number }).index : undefined
    }))
    const categories = sortCategories(normalizedList.length > 0 ? normalizedList : DEFAULT_CATEGORIES)
    const assetsConfig: Record<string, string | { name?: string; description?: string }> = {}

    // Support "assets": { "rel/path.png": "Tên" } or { "rel/path.png": { "name": "Tên" } }
    if (parsed?.assets && typeof parsed.assets === 'object' && !Array.isArray(parsed.assets)) {
      Object.assign(assetsConfig, parsed.assets)
    }
    // Also support "items": [ { "path": "...", "name": "..." } ]
    if (Array.isArray(parsed?.items)) {
      for (const it of parsed.items) {
        if (it && typeof it === 'object') {
          const key = it.path || it.relativePath || it.fileName
          if (key) assetsConfig[key] = it
        }
      }
    }

    return {
      categories,
      assetsConfig,
      rawJson,
      manifestPath
    }
  } catch (err) {
    console.warn('[BuiltInAssets] Failed to parse manifest.json, using fallback:', err)
    return {
      categories: DEFAULT_CATEGORIES,
      assetsConfig: {},
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

async function buildAssetItem(
  fullPath: string,
  rootDir: string,
  assetsConfig: Record<string, string | { name?: string; description?: string }> = {}
): Promise<BuiltInAssetItem | null> {
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

  // Kiểm tra tên tùy chỉnh trong manifest.json (hỗ trợ relative path, filename hoặc assets/path)
  const cfg = assetsConfig[rel] ?? assetsConfig[fileName] ?? assetsConfig[`assets/${rel}`]
  let customName: string | undefined
  if (typeof cfg === 'string' && cfg.trim()) {
    customName = cfg.trim()
  } else if (cfg && typeof cfg === 'object' && typeof cfg.name === 'string' && cfg.name.trim()) {
    customName = cfg.name.trim()
  }

  const displayName = customName || cleanName

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
    name: displayName,
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

let cachedCatalog: BuiltInCatalogResult | null = null

export async function scanBuiltInCatalog(forceRefresh = false): Promise<BuiltInCatalogResult> {
  if (cachedCatalog && !forceRefresh) {
    return cachedCatalog
  }

  const root = getAssetsRoot()
  const { categories, assetsConfig, rawJson, manifestPath } = await readManifestJson(root)
  const allFiles = await collectFilesRecursively(root, root)

  const eligibleFiles = allFiles.filter((filePath) => {
    const name = basename(filePath).toLowerCase()
    if (name === 'manifest.json' || name === 'readme.md') return false
    const rel = relative(root, filePath).replace(/\\/g, '/')
    // 3D Assembly textures belong to assembly dialog, exclude from regular 2D library
    if (rel.startsWith('assembly_3d/') || rel.startsWith('house/')) return false
    return true
  })

  const itemResults = await Promise.all(eligibleFiles.map((filePath) => buildAssetItem(filePath, root, assetsConfig)))
  const items: BuiltInAssetItem[] = itemResults.filter((it): it is BuiltInAssetItem => it !== null)

  cachedCatalog = { categories, items, manifestPath, rawJson }
  return cachedCatalog
}

export async function scanAssembly3DAssets(): Promise<BuiltInAssetItem[]> {
  const root = getAssetsRoot()
  const allFiles = await collectFilesRecursively(root, root)
  const assemblyFiles = allFiles.filter((filePath) => {
    const name = basename(filePath).toLowerCase()
    if (name === 'manifest.json' || name === 'readme.md') return false
    const rel = relative(root, filePath).replace(/\\/g, '/')
    return rel.startsWith('assembly_3d/') || rel.startsWith('house/')
  })

  const { assetsConfig } = await readManifestJson(root)
  const itemResults = await Promise.all(assemblyFiles.map((filePath) => buildAssetItem(filePath, root, assetsConfig)))
  return itemResults.filter((it): it is BuiltInAssetItem => it !== null)
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
    const catalog = await scanBuiltInCatalog(true)
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
  ipcMain.handle('builtinAssets:getAssemblyAssets', async () => scanAssembly3DAssets())

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

  // Pre-warm catalog cache immediately in the background upon registration
  scanBuiltInCatalog(false).catch((err) => {
    console.warn('[BuiltInAssets] Background catalog prewarm error:', err)
  })
}
