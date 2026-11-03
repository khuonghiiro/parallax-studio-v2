import {
  saveLoopAnimationPackageToDisk,
  loadLoopAnimationPackageFromDisk,
  type SaveLoopPackagePayload,
  type SaveLoopPackageResult
} from './loopAnimationPackages'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises'
import { basename, extname, join, relative } from 'path'
import type {
  BuiltInAssetCategory,
  BuiltInAssetItem,
  BuiltInCatalogResult,
  BuiltInSaveManifestResult,
  ManifestAssetMeta,
  ManifestItemStatus,
  ManifestModuleId,
  ManifestPruneReport
} from '@shared/ipc'
import {
  markInternalManifestWrite,
  pruneAllManifestsOnDisk,
  readAllManifestModules,
  restoreDeletedBuiltInAsset,
  saveModuleManifestFile,
  softDeleteOrRemoveBuiltInAsset,
  startManifestDirectoryWatcher,
  type SoftDeleteAssetOptions
} from './manifestCoordinator'

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

const previewDataUrlCache = new Map<string, { mtimeMs: number; size: number; previewUrl: string }>()

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
    description: 'Toàn bộ tài nguyên công khai có sẵn trong thư mục assets',
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
    id: 'audio',
    folder: 'audio',
    title: 'Âm thanh & Nhạc nền',
    icon: 'music',
    description: 'Nhạc nền, tiếng chuông ambient và hiệu ứng âm thanh cho phân cảnh',
    order: 2
  }
]

export function getAssetsRoot(): string {
  const devPath = join(process.cwd(), 'assets')
  if (existsSync(devPath)) return devPath
  try {
    const appPath = join(app.getAppPath(), 'assets')
    if (existsSync(appPath)) return appPath
  } catch {
    /* app not ready in unit test */
  }
  if (process.resourcesPath) {
    const resPath = join(process.resourcesPath, 'assets')
    if (existsSync(resPath)) return resPath
  }
  return devPath
}

interface ManifestConfig {
  categories: BuiltInAssetCategory[]
  assetsConfig: Record<string, string | ManifestAssetMeta>
  rawJson: string
  manifestPath: string
  parsedRoot: any
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
    return { categories: DEFAULT_CATEGORIES, assetsConfig: {}, rawJson: raw, manifestPath, parsedRoot: {} }
  }

  try {
    const rawJson = await readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(rawJson)
    const list: BuiltInAssetCategory[] = Array.isArray(parsed?.categories) ? parsed.categories : []
    const normalizedList = list.map((c) => ({
      ...c,
      status: c.status || 'active',
      order:
        typeof c.order === 'number'
          ? c.order
          : typeof (c as { index?: number }).index === 'number'
            ? (c as { index?: number }).index
            : undefined
    }))
    const categories = sortCategories(normalizedList.length > 0 ? normalizedList : DEFAULT_CATEGORIES)
    const assetsConfig: Record<string, string | ManifestAssetMeta> = {}

    if (parsed?.assets && typeof parsed.assets === 'object' && !Array.isArray(parsed.assets)) {
      Object.assign(assetsConfig, parsed.assets)
    }
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
      manifestPath,
      parsedRoot: parsed
    }
  } catch (err) {
    console.warn('[BuiltInAssets] Failed to parse manifest.json, using fallback:', err)
    return {
      categories: DEFAULT_CATEGORIES,
      assetsConfig: {},
      rawJson: JSON.stringify({ categories: DEFAULT_CATEGORIES }, null, 2),
      manifestPath,
      parsedRoot: {}
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
  assetsConfig: Record<string, string | ManifestAssetMeta> = {},
  isDeletedItem = false
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

  const cfg = assetsConfig[rel] ?? assetsConfig[fileName] ?? assetsConfig[`assets/${rel}`]
  let customName: string | undefined
  let customCategory: string | undefined
  let customStatus: ManifestItemStatus | undefined
  let tempPath: string | undefined
  let deletedAt: string | undefined

  if (typeof cfg === 'string' && cfg.trim()) {
    customName = cfg.trim()
  } else if (cfg && typeof cfg === 'object') {
    if (typeof cfg.name === 'string' && cfg.name.trim()) customName = cfg.name.trim()
    if (typeof cfg.category === 'string' && cfg.category.trim()) customCategory = cfg.category.trim()
    if (cfg.status) customStatus = cfg.status
    if (typeof cfg.tempPath === 'string') tempPath = cfg.tempPath
    if (typeof cfg.deletedAt === 'string') deletedAt = cfg.deletedAt
  }

  // Nếu mục trong manifest được đánh dấu status === 'deleted' hoặc 'hidden', bỏ qua khỏi danh sách active
  if (!isDeletedItem && (customStatus === 'deleted' || customStatus === 'hidden')) {
    return null
  }

  const displayName = customName || cleanName

  let previewUrl: string | undefined
  if (isImage && fileStat.size <= 4 * 1024 * 1024) {
    const cached = previewDataUrlCache.get(fullPath)
    if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
      previewUrl = cached.previewUrl
    } else {
      try {
        const buf = await readFile(fullPath)
        previewUrl = `data:${mime};base64,${buf.toString('base64')}`
        previewDataUrlCache.set(fullPath, {
          mtimeMs: fileStat.mtimeMs,
          size: fileStat.size,
          previewUrl
        })
      } catch {
        /* ignore preview generation */
      }
    }
  }

  return {
    id: `builtin:${rel}`,
    name: displayName,
    fileName,
    relativePath: rel,
    folder,
    category: customCategory || folder,
    ext,
    mime,
    kind: isImage ? 'image' : 'audio',
    size: fileStat.size,
    path: fullPath,
    isAnimated: ext === 'gif',
    previewUrl,
    status: isDeletedItem ? 'deleted' : customStatus || 'active',
    tempPath: isDeletedItem ? tempPath || `_temp_deleted/${rel}` : tempPath,
    deletedAt
  }
}

let cachedCatalog: BuiltInCatalogResult | null = null

function broadcastCatalogUpdated(catalog: BuiltInCatalogResult): void {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('builtinAssets:updated', catalog)
      }
    }
  } catch {
    /* ignore outside Electron runtime */
  }
}

function isPrivateOrSystemRelPath(rel: string): boolean {
  return (
    rel.startsWith('_temp_deleted/') ||
    rel.startsWith('loop_animations/') ||
    rel.startsWith('loop-animations/') ||
    rel.startsWith('manifests/') ||
    rel.startsWith('icons/') ||
    rel.startsWith('assembly_3d/') ||
    rel.startsWith('house/') ||
    rel.startsWith('character_cutout_demo/') ||
    rel.startsWith('character_human_') ||
    rel.startsWith('animal_modular/') ||
    rel.startsWith('nature_modular/')
  )
}

export async function scanBuiltInCatalog(forceRefresh = false): Promise<BuiltInCatalogResult> {
  if (cachedCatalog && !forceRefresh) {
    return cachedCatalog
  }

  const root = getAssetsRoot()
  const { categories, assetsConfig, rawJson, manifestPath, parsedRoot } = await readManifestJson(root)
  const { coordinator, modules, iconUrls, mergedAssetsConfig } = await readAllManifestModules(
    root,
    sortCategories,
    parsedRoot
  )

  const combinedAssetsConfig: Record<string, string | ManifestAssetMeta> = {
    ...mergedAssetsConfig,
    ...assetsConfig
  }

  const allFiles = await collectFilesRecursively(root, root)
  const eligibleFiles = allFiles.filter((filePath) => {
    const name = basename(filePath).toLowerCase()
    if (name === 'manifest.json' || name === 'readme.md' || name === '.gitkeep') return false
    const rel = relative(root, filePath).replace(/\\/g, '/')
    if (isPrivateOrSystemRelPath(rel)) return false
    return true
  })

  const tempRoot = join(root, coordinator.tempTrashFolder || '_temp_deleted')
  const tempAllFiles = existsSync(tempRoot) ? await collectFilesRecursively(tempRoot, tempRoot) : []
  const eligibleTempFiles = tempAllFiles.filter((filePath) => {
    const name = basename(filePath).toLowerCase()
    if (name === 'manifest.json' || name === 'readme.md' || name === '.gitkeep') return false
    const rel = relative(tempRoot, filePath).replace(/\\/g, '/')
    // Trong gói hoạt ảnh lặp loop_animations/<slug>/, chỉ hiển thị đại diện thumbnail.png để tránh lặp 16 frame
    if (/^loop_animations\/[^/]+\/frame_\d+\.png$/i.test(rel)) {
      const thumbSibling = join(filePath, '..', 'thumbnail.png')
      if (existsSync(thumbSibling) || name !== 'frame_000.png') return false
    }
    return true
  })

  const [itemResults, deletedResults] = await Promise.all([
    Promise.all(eligibleFiles.map((filePath) => buildAssetItem(filePath, root, combinedAssetsConfig, false))),
    Promise.all(eligibleTempFiles.map((filePath) => buildAssetItem(filePath, tempRoot, combinedAssetsConfig, true)))
  ])

  const items: BuiltInAssetItem[] = itemResults.filter((it): it is BuiltInAssetItem => it !== null)
  const deletedItems: BuiltInAssetItem[] = deletedResults.filter((it): it is BuiltInAssetItem => it !== null)

  // Cũng bao gồm các mục được đánh dấu status === 'deleted' trực tiếp trong manifest dù chưa chuyển file vật lý
  const existingDeletedRel = new Set(deletedItems.map((d) => d.relativePath))
  for (const [k, v] of Object.entries(combinedAssetsConfig)) {
    if (v && typeof v === 'object' && v.status === 'deleted' && !existingDeletedRel.has(k)) {
      const full = join(root, k)
      if (existsSync(full)) {
        const softItem = await buildAssetItem(full, root, combinedAssetsConfig, true)
        if (softItem) {
          deletedItems.push(softItem)
          existingDeletedRel.add(k)
        }
      }
    }
  }

  const activeCategories = categories.filter((c) => c.status !== 'deleted' && c.status !== 'hidden')

  cachedCatalog = {
    categories: activeCategories,
    items,
    deletedItems,
    manifestPath,
    rawJson,
    tempTrashFolder: coordinator.tempTrashFolder,
    iconsFolder: coordinator.iconsFolder,
    iconUrls,
    coordinator,
    modules
  }
  return cachedCatalog
}

export async function scanAssembly3DAssets(): Promise<BuiltInAssetItem[]> {
  const root = getAssetsRoot()
  const allFiles = await collectFilesRecursively(root, root)
  const assemblyFiles = allFiles.filter((filePath) => {
    const name = basename(filePath).toLowerCase()
    if (name === 'manifest.json' || name === 'readme.md') return false
    if (name.includes('review') || name.includes('_raw') || name.includes('thumb') || name.includes('raw_crop')) return false
    const rel = relative(root, filePath).replace(/\\/g, '/')
    return rel.startsWith('assembly_3d/') || rel.startsWith('house/')
  })

  const { assetsConfig } = await readManifestJson(root)
  const itemResults = await Promise.all(
    assemblyFiles.map(async (filePath) => {
      const item = await buildAssetItem(filePath, root, assetsConfig)
      if (item && item.relativePath.includes('house')) {
        item.folder = 'architecture'
      }
      return item
    })
  )
  const itemsMap = new Map<string, BuiltInAssetItem>()
  for (const it of itemResults) {
    if (it) itemsMap.set(it.fileName, it)
  }

  try {
    const asset3dsRoot = join(process.cwd(), 'asset-3ds')
    if (existsSync(asset3dsRoot)) {
      const asset3dsFiles = await collectFilesRecursively(asset3dsRoot, asset3dsRoot)
      const textureFiles = asset3dsFiles.filter((p) => {
        const name = basename(p).toLowerCase()
        const ext = extname(p).slice(1).toLowerCase()
        return (
          IMAGE_EXTS.has(ext) &&
          name !== 'manifest.json' &&
          !name.includes('thumb') &&
          !name.includes('review') &&
          !name.includes('_raw') &&
          !name.includes('raw_crop')
        )
      })
      await Promise.all(
        textureFiles.map(async (filePath) => {
          const fileName = basename(filePath)
          if (itemsMap.has(fileName)) return

          const rel = relative(asset3dsRoot, filePath).replace(/\\/g, '/')
          const parts = rel.split('/')
          const cat = parts.length > 1 ? parts[0] : 'custom'
          const statData = await stat(filePath)
          const ext = extname(filePath).slice(1).toLowerCase()
          const mime = MIME_MAP[ext] || 'image/png'
          let previewUrl: string | undefined
          if (statData.size <= 4 * 1024 * 1024) {
            const cached = previewDataUrlCache.get(filePath)
            if (cached && cached.mtimeMs === statData.mtimeMs && cached.size === statData.size) {
              previewUrl = cached.previewUrl
            } else {
              const buf = await readFile(filePath)
              previewUrl = `data:${mime};base64,${buf.toString('base64')}`
              previewDataUrlCache.set(filePath, {
                mtimeMs: statData.mtimeMs,
                size: statData.size,
                previewUrl
              })
            }
          }
          itemsMap.set(fileName, {
            id: `asset3ds:${rel}`,
            name: basename(filePath, extname(filePath)).replace(/[_-]/g, ' '),
            fileName,
            relativePath: `asset-3ds/${rel}`,
            folder: cat,
            ext,
            mime,
            kind: 'image' as const,
            size: statData.size,
            path: filePath,
            previewUrl
          })
        })
      )
    }
  } catch (err) {
    console.warn('[BuiltInAssets] Error scanning asset-3ds textures:', err)
  }

  return Array.from(itemsMap.values())
}

export async function saveManifestJson(rawJson: string): Promise<BuiltInSaveManifestResult> {
  return saveModuleManifest('coordinator', rawJson)
}

export async function saveModuleManifest(
  moduleId: ManifestModuleId | 'coordinator',
  rawJson: string
): Promise<BuiltInSaveManifestResult> {
  const root = getAssetsRoot()
  const res = await saveModuleManifestFile(root, moduleId, rawJson)
  if (!res.ok) return { ok: false, error: res.error }
  const catalog = await scanBuiltInCatalog(true)
  broadcastCatalogUpdated(catalog)
  return { ok: true, catalog }
}

export async function loadAssetBytes(relPath: string): Promise<{ name: string; mime: string; data: Uint8Array } | null> {
  if (!relPath) return null
  const root = getAssetsRoot()
  const cleanTarget = relPath
    .replace(/\\/g, '/')
    .replace(/^builtin:/, '')
    .replace(/^assets\//, '')
    .trim()
  let fullPath = join(root, cleanTarget)
  if (!existsSync(fullPath)) {
    const tempPath = join(root, '_temp_deleted', cleanTarget)
    if (existsSync(tempPath)) {
      fullPath = tempPath
    } else if (existsSync(relPath)) {
      fullPath = relPath
    } else {
      return null
    }
  }

  const ext = extname(fullPath).slice(1).toLowerCase()
  const mime = MIME_MAP[ext] || 'application/octet-stream'
  const data = await readFile(fullPath)
  return {
    name: basename(fullPath),
    mime,
    data: new Uint8Array(data)
  }
}

export async function deleteBuiltInAsset(
  relPath: string,
  opts?: SoftDeleteAssetOptions
): Promise<{ ok: boolean; status?: ManifestItemStatus; tempPath?: string; error?: string; catalog?: BuiltInCatalogResult }> {
  if (!relPath) return { ok: false, error: 'Thiếu đường dẫn tệp' }
  const root = getAssetsRoot()
  const res = await softDeleteOrRemoveBuiltInAsset(root, relPath, opts)
  if (!res.ok) return res
  const catalog = await scanBuiltInCatalog(true)
  broadcastCatalogUpdated(catalog)
  return { ...res, catalog }
}

export async function restoreBuiltInAsset(
  relPath: string
): Promise<{ ok: boolean; relPath?: string; error?: string; catalog?: BuiltInCatalogResult }> {
  if (!relPath) return { ok: false, error: 'Thiếu đường dẫn tệp cần khôi phục' }
  const root = getAssetsRoot()
  const res = await restoreDeletedBuiltInAsset(root, relPath)
  if (!res.ok) return res
  const catalog = await scanBuiltInCatalog(true)
  broadcastCatalogUpdated(catalog)
  return { ...res, catalog }
}

export async function pruneBuiltInManifest(opts?: {
  keepEmpty?: boolean
  addNew?: boolean
}): Promise<{ ok: boolean; report?: ManifestPruneReport; error?: string; catalog?: BuiltInCatalogResult }> {
  try {
    const root = getAssetsRoot()
    const current = await scanBuiltInCatalog(true)
    const activeRelFiles = current.items.map((it) => it.relativePath)
    const tempRelFiles = (current.deletedItems || []).map((it) => it.relativePath)
    const report = await pruneAllManifestsOnDisk(root, activeRelFiles, tempRelFiles, opts)
    const catalog = await scanBuiltInCatalog(true)
    broadcastCatalogUpdated(catalog)
    return { ok: true, report, catalog }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function importBuiltInAssetFile(opts: {
  name: string
  buffer: Uint8Array
  folder?: string
  title?: string
}): Promise<{ ok: boolean; relPath?: string; fullPath?: string; item?: BuiltInAssetItem; error?: string }> {
  if (!opts.name || !opts.buffer || !opts.buffer.length) {
    return { ok: false, error: 'Thiếu tên tệp hoặc dữ liệu tệp rỗng' }
  }

  const root = getAssetsRoot()
  const ext = extname(opts.name).slice(1).toLowerCase()
  const isAudio = AUDIO_EXTS.has(ext)
  const isImage = IMAGE_EXTS.has(ext)

  if (!isImage && !isAudio) {
    return { ok: false, error: `Định dạng tệp .${ext} không được hỗ trợ` }
  }

  const targetFolder = (opts.folder && opts.folder !== 'all' ? opts.folder : isAudio ? 'audio' : 'uploads')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '')
  const folderDir = join(root, targetFolder)

  try {
    if (!existsSync(folderDir)) {
      await mkdir(folderDir, { recursive: true })
    }

    const baseName =
      basename(opts.name, `.${ext}`)
        .replace(/[^a-zA-Z0-9_\-\.\s\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')
        .trim() || 'asset'
    let finalFileName = `${baseName}.${ext}`
    let destinationPath = join(folderDir, finalFileName)
    let counter = 1

    while (existsSync(destinationPath)) {
      finalFileName = `${baseName}_${counter}.${ext}`
      destinationPath = join(folderDir, finalFileName)
      counter++
    }

    await writeFile(destinationPath, Buffer.from(opts.buffer))

    const relPath = `${targetFolder}/${finalFileName}`.replace(/\\/g, '/')
    const cleanTitle = opts.title?.trim() || baseName.replace(/[_-]/g, ' ')

    // Cập nhật cả manifest.json và manifests/builtin.json
    for (const fileRel of ['manifest.json', 'manifests/builtin.json']) {
      const mPath = join(root, fileRel)
      if (!existsSync(mPath) && fileRel !== 'manifest.json') continue
      try {
        const raw = existsSync(mPath) ? await readFile(mPath, 'utf-8') : '{}'
        const data = JSON.parse(raw)
        if (!Array.isArray(data.categories)) data.categories = [...DEFAULT_CATEGORIES]
        const existingCat = data.categories.find((c: any) => c.folder === targetFolder || c.id === targetFolder)
        if (!existingCat && targetFolder === 'uploads') {
          data.categories.push({
            id: 'uploads',
            folder: 'uploads',
            title: 'Tài nguyên tải lên',
            shortTitle: 'Tải lên',
            icon: 'image',
            iconText: 'UP',
            description: 'Tài nguyên ảnh và vật liệu người dùng thêm vào kho',
            order: 10,
            status: 'active'
          })
        }
        if (!data.assets || typeof data.assets !== 'object') data.assets = {}
        data.assets[relPath] = {
          name: cleanTitle,
          category: targetFolder,
          status: 'active'
        }
        await writeFile(mPath, JSON.stringify(data, null, 2), 'utf-8')
      } catch (manifestErr) {
        console.warn(`[BuiltInAssets] Failed to update ${fileRel} on import:`, manifestErr)
      }
    }

    const refreshed = await scanBuiltInCatalog(true)
    broadcastCatalogUpdated(refreshed)
    const item = refreshed.items.find((it) => it.relativePath === relPath) || null

    return {
      ok: true,
      relPath,
      fullPath: destinationPath,
      item: item || undefined
    }
  } catch (err) {
    console.error('[BuiltInAssets] Error importing asset file:', err)
    return { ok: false, error: String(err) }
  }
}


export async function saveLoopAnimationPackage(
  payload: SaveLoopPackagePayload
): Promise<SaveLoopPackageResult & { catalog?: BuiltInCatalogResult }> {
  const root = getAssetsRoot()
  markInternalManifestWrite()
  const res = await saveLoopAnimationPackageToDisk(root, payload)
  if (res.ok) {
    const catalog = await scanBuiltInCatalog(true)
    broadcastCatalogUpdated(catalog)
    return { ...res, catalog }
  }
  return res
}

export async function loadLoopAnimationPackage(
  relPathOrJson: string
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const root = getAssetsRoot()
  return loadLoopAnimationPackageFromDisk(root, relPathOrJson)
}
export function registerBuiltInAssetsIpc(): void {
  ipcMain.handle('builtinAssets:getCatalog', async (_e, forceRefresh?: boolean) =>
    scanBuiltInCatalog(Boolean(forceRefresh))
  )
  ipcMain.handle('builtinAssets:getAssemblyAssets', async () => scanAssembly3DAssets())
  ipcMain.handle('builtinAssets:saveManifest', async (_e, rawJson: string) => saveManifestJson(rawJson))
  ipcMain.handle(
    'builtinAssets:saveModuleManifest',
    async (_e, moduleId: ManifestModuleId | 'coordinator', rawJson: string) =>
      saveModuleManifest(moduleId, rawJson)
  )
  ipcMain.handle('builtinAssets:loadAssetBytes', async (_e, relPath: string) => loadAssetBytes(relPath))
  ipcMain.handle(
    'builtinAssets:deleteAsset',
    async (_e, relPath: string, opts?: SoftDeleteAssetOptions) => deleteBuiltInAsset(relPath, opts)
  )
  ipcMain.handle('builtinAssets:restoreAsset', async (_e, relPath: string) => restoreBuiltInAsset(relPath))
  ipcMain.handle(
    'builtinAssets:pruneManifest',
    async (_e, opts?: { keepEmpty?: boolean; addNew?: boolean }) => pruneBuiltInManifest(opts)
  )

  ipcMain.handle(
    'builtinAssets:importAssetFile',
    async (
      _e,
      opts: {
        name: string
        buffer: Uint8Array
        folder?: string
        title?: string
      }
    ) => importBuiltInAssetFile(opts)
  )

  
  ipcMain.handle(
    'builtinAssets:saveLoopAnimationPackage',
    async (_e, payload: SaveLoopPackagePayload) => saveLoopAnimationPackage(payload)
  )

  ipcMain.handle(
    'builtinAssets:loadLoopAnimationPackage',
    async (_e, relPath: string) => loadLoopAnimationPackage(relPath)
  )
ipcMain.handle('builtinAssets:openFolder', async (_e, subFolder?: string) => {
    const root = getAssetsRoot()
    const target = subFolder ? join(root, subFolder) : root
    if (existsSync(target)) {
      await shell.openPath(target)
    } else {
      await shell.openPath(root)
    }
  })

  // Theo dõi thay đổi file JSON hoặc icon trực tiếp trên đĩa để tự động cập nhật realtime
  const root = getAssetsRoot()
  startManifestDirectoryWatcher(root, () => {
    scanBuiltInCatalog(true)
      .then((catalog) => broadcastCatalogUpdated(catalog))
      .catch(() => {})
  })

  // Pre-warm catalog cache immediately in the background upon registration
  scanBuiltInCatalog(false).catch((err) => {
    console.warn('[BuiltInAssets] Background catalog prewarm error:', err)
  })
}
