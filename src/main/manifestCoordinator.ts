import { existsSync, watch, type FSWatcher } from 'fs'
import { copyFile, cp, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import type {
  BuiltInAssetCategory,
  ManifestAssetMeta,
  ManifestItemStatus,
  ManifestModuleData,
  ManifestModuleDescriptor,
  ManifestModuleId,
  ManifestPruneReport
} from '@shared/ipc'

export const DEFAULT_MODULE_DESCRIPTORS: Record<ManifestModuleId, ManifestModuleDescriptor> = {
  builtin: {
    id: 'builtin',
    title: 'Kho Tài Nguyên Công Khai',
    file: 'manifests/builtin.json',
    rootFolder: 'assets',
    tempFolder: 'assets/_temp_deleted',
    description: 'Tài nguyên ảnh phân tầng 2.5D, vật liệu, nhân vật tải lên và tệp công khai trong thư mục assets/'
  },
  layer_25d: {
    id: 'layer_25d',
    title: 'Xưởng Layer 2.5D',
    file: 'manifests/layer-25d.json',
    rootFolder: 'assets',
    tempFolder: 'assets/_temp_deleted',
    description: 'Chủ đề phân loại cụm Layer 2.5D (Bối cảnh, Nhân vật, Cây cối, Động vật, Đạo cụ, Kiến trúc) & cột tài nguyên trong xưởng'
  },
  loop_animator: {
    id: 'loop_animator',
    title: 'Xưởng Tách Hoạt Ảnh Loop',
    file: 'manifests/loop-animator.json',
    rootFolder: 'assets/demo_transparent',
    tempFolder: 'assets/_temp_deleted/demo_transparent',
    description: 'Nhóm chủ đề hoạt ảnh lặp (Lửa & Nhiệt, Phép thuật, Thiên nhiên, Điện & Plasma, Tự tạo) và danh mục Loop mẫu'
  },
  model_3d: {
    id: 'model_3d',
    title: 'Xưởng Lắp Ráp Khối 3D',
    file: 'manifests/model-3d.json',
    rootFolder: 'asset-3ds',
    tempFolder: 'assets/_temp_deleted/asset-3ds',
    description: 'Chủ đề mô hình 3D (Tự tạo, Nhà cửa, Nội thất, Phương tiện, Thiên nhiên, Đạo cụ) đồng bộ với asset-3ds/manifest.json'
  },
  audio: {
    id: 'audio',
    title: 'Kho Âm Thanh & Nhạc Nền',
    file: 'manifests/audio.json',
    rootFolder: 'assets/audio',
    tempFolder: 'assets/_temp_deleted/audio',
    description: 'Nhóm chủ đề âm thanh (Nhạc nền, Không gian, SFX, Chuyển cảnh, Lời thoại) và danh mục tệp âm thanh có sẵn'
  }
}

const ICON_MIME_MAP: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
}

const iconDataUrlCache = new Map<string, { mtimeMs: number; size: number; dataUrl: string }>()

export function normalizeAssetKey(key: string): string {
  return String(key)
    .replace(/\\/g, '/')
    .replace(/^builtin:/, '')
    .replace(/^\.\//, '')
    .replace(/^assets\//, '')
    .trim()
}

export function normalizeManifestAssetsRecord(
  rawAssets: unknown
): Record<string, ManifestAssetMeta> {
  const out: Record<string, ManifestAssetMeta> = {}
  if (!rawAssets || typeof rawAssets !== 'object' || Array.isArray(rawAssets)) return out
  for (const [k, v] of Object.entries(rawAssets as Record<string, unknown>)) {
    if (typeof v === 'string') {
      out[k] = { name: v, status: 'active' }
    } else if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      out[k] = {
        ...obj,
        name: typeof obj.name === 'string' ? obj.name : basename(k, extname(k)).replace(/[_-]/g, ' '),
        status: (obj.status as ManifestItemStatus) || 'active'
      }
    }
  }
  return out
}

export async function scanCustomIconsMap(root: string, iconsFolder = 'icons'): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const iconsDir = join(root, iconsFolder)
  if (!existsSync(iconsDir)) return result

  try {
    const entries = await readdir(iconsDir, { withFileTypes: true })
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) return
        const ext = extname(entry.name).slice(1).toLowerCase()
        const mime = ICON_MIME_MAP[ext]
        if (!mime) return
        const fullPath = join(iconsDir, entry.name)
        try {
          const st = await stat(fullPath)
          if (st.size > 512 * 1024) return
          const cached = iconDataUrlCache.get(fullPath)
          let dataUrl: string
          if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
            dataUrl = cached.dataUrl
          } else {
            const buf = await readFile(fullPath)
            dataUrl = `data:${mime};base64,${buf.toString('base64')}`
            iconDataUrlCache.set(fullPath, { mtimeMs: st.mtimeMs, size: st.size, dataUrl })
          }
          const relKey = `${iconsFolder}/${entry.name}`.replace(/\\/g, '/')
          result[relKey] = dataUrl
          result[`assets/${relKey}`] = dataUrl
          result[entry.name] = dataUrl
        } catch {
          /* ignore broken icon file */
        }
      })
    )
  } catch {
    /* ignore missing icons folder */
  }
  return result
}

export async function readAllManifestModules(
  root: string,
  sortCategoriesFn: (cats: BuiltInAssetCategory[]) => BuiltInAssetCategory[],
  rootParsed: any
): Promise<{
  coordinator: {
    version: string
    tempTrashFolder: string
    iconsFolder: string
    modules: Record<ManifestModuleId, ManifestModuleDescriptor>
  }
  modules: Record<ManifestModuleId, ManifestModuleData>
  iconUrls: Record<string, string>
  mergedAssetsConfig: Record<string, ManifestAssetMeta>
}> {
  const version = typeof rootParsed?.version === 'string' ? rootParsed.version : '2.0'
  const tempTrashFolder = typeof rootParsed?.tempTrashFolder === 'string' ? rootParsed.tempTrashFolder : '_temp_deleted'
  const iconsFolder = typeof rootParsed?.iconsFolder === 'string' ? rootParsed.iconsFolder : 'icons'

  const descriptors: Record<ManifestModuleId, ManifestModuleDescriptor> = {
    ...DEFAULT_MODULE_DESCRIPTORS,
    ...(rootParsed?.modules && typeof rootParsed.modules === 'object' ? rootParsed.modules : {})
  }

  const moduleIds: ManifestModuleId[] = ['builtin', 'layer_25d', 'loop_animator', 'model_3d', 'audio']
  const modulesRecord = {} as Record<ManifestModuleId, ManifestModuleData>
  const mergedAssetsConfig: Record<string, ManifestAssetMeta> = normalizeManifestAssetsRecord(rootParsed?.assets)

  await Promise.all(
    moduleIds.map(async (modId) => {
      const desc = descriptors[modId] || DEFAULT_MODULE_DESCRIPTORS[modId]
      const modPath = join(root, desc.file)
      let rawJson = ''
      let parsed: any = null
      if (existsSync(modPath)) {
        try {
          rawJson = await readFile(modPath, 'utf-8')
          parsed = JSON.parse(rawJson)
        } catch (err) {
          console.warn(`[ManifestCoordinator] Failed to read module ${modId} at ${modPath}:`, err)
        }
      }
      if (!parsed) {
        parsed = {
          moduleId: modId,
          title: desc.title,
          description: desc.description,
          categories: modId === 'builtin' && Array.isArray(rootParsed?.categories) ? rootParsed.categories : [],
          assets: modId === 'builtin' && rootParsed?.assets ? rootParsed.assets : {}
        }
        rawJson = JSON.stringify(parsed, null, 2)
      }

      const rawCats: BuiltInAssetCategory[] = Array.isArray(parsed.categories) ? parsed.categories : []
      const categories = sortCategoriesFn(
        rawCats.map((c) => ({
          ...c,
          status: c.status || 'active'
        }))
      )
      const assets = normalizeManifestAssetsRecord(parsed.assets)
      for (const [k, v] of Object.entries(assets)) {
        mergedAssetsConfig[k] = { ...(mergedAssetsConfig[k] || {}), ...v }
      }

      modulesRecord[modId] = {
        moduleId: modId,
        title: parsed.title || desc.title,
        description: parsed.description || desc.description,
        file: desc.file,
        manifestPath: modPath,
        rawJson,
        categories,
        templateCategories: Array.isArray(parsed.templateCategories)
          ? sortCategoriesFn(parsed.templateCategories)
          : undefined,
        sidebarAssetTopics: Array.isArray(parsed.sidebarAssetTopics) ? parsed.sidebarAssetTopics : undefined,
        assets
      }
    })
  )

  const iconUrls = await scanCustomIconsMap(root, iconsFolder)

  return {
    coordinator: {
      version,
      tempTrashFolder,
      iconsFolder,
      modules: descriptors
    },
    modules: modulesRecord,
    iconUrls,
    mergedAssetsConfig
  }
}

export async function saveModuleManifestFile(
  root: string,
  moduleId: ManifestModuleId | 'coordinator',
  rawJson: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    markInternalManifestWrite()
    const parsed = JSON.parse(rawJson)
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Nội dung JSON không hợp lệ' }
    }
    if (moduleId !== 'coordinator' && !Array.isArray(parsed.categories)) {
      return { ok: false, error: 'JSON phân hệ phải chứa thuộc tính "categories" là mảng []' }
    }
    if (moduleId === 'coordinator' && !Array.isArray(parsed.categories)) {
      return { ok: false, error: 'JSON điều phối phải chứa thuộc tính "categories" là mảng []' }
    }

    const rootManifestPath = join(root, 'manifest.json')
    let rootData: any = {}
    if (existsSync(rootManifestPath)) {
      try {
        rootData = JSON.parse(await readFile(rootManifestPath, 'utf-8'))
      } catch {
        rootData = {}
      }
    }

    if (moduleId === 'coordinator') {
      await writeFile(rootManifestPath, JSON.stringify(parsed, null, 2), 'utf-8')
      // Đồng bộ sang manifests/builtin.json nếu có
      const builtinFile = parsed?.modules?.builtin?.file || DEFAULT_MODULE_DESCRIPTORS.builtin.file
      const builtinPath = join(root, builtinFile)
      if (existsSync(builtinPath)) {
        try {
          const builtinData = JSON.parse(await readFile(builtinPath, 'utf-8'))
          builtinData.categories = parsed.categories
          if (parsed.assets) builtinData.assets = parsed.assets
          await writeFile(builtinPath, JSON.stringify(builtinData, null, 2), 'utf-8')
        } catch {
          /* ignore */
        }
      }
      return { ok: true }
    }

    const desc =
      (rootData?.modules && rootData.modules[moduleId]) || DEFAULT_MODULE_DESCRIPTORS[moduleId]
    const targetPath = join(root, desc.file)
    await mkdir(dirname(targetPath), { recursive: true })
    await writeFile(targetPath, JSON.stringify(parsed, null, 2), 'utf-8')

    // Nếu sửa module builtin -> đồng bộ ngược lên manifest.json gốc
    if (moduleId === 'builtin') {
      rootData.categories = parsed.categories
      if (parsed.assets) rootData.assets = parsed.assets
      await writeFile(rootManifestPath, JSON.stringify(rootData, null, 2), 'utf-8')
    } else if (parsed.assets && typeof parsed.assets === 'object') {
      // Đồng bộ trạng thái/tên các asset chung vào manifest.json gốc
      rootData.assets = rootData.assets && typeof rootData.assets === 'object' ? rootData.assets : {}
      let rootChanged = false
      for (const [k, v] of Object.entries(parsed.assets)) {
        if (rootData.assets[k]) {
          rootData.assets[k] = v
          rootChanged = true
        }
      }
      if (rootChanged) {
        await writeFile(rootManifestPath, JSON.stringify(rootData, null, 2), 'utf-8')
      }
    }

    // Nếu sửa module model_3d -> đồng bộ sang asset-3ds/manifest.json
    if (moduleId === 'model_3d') {
      const asset3dsManifestPath = join(dirname(root), 'asset-3ds', 'manifest.json')
      if (existsSync(dirname(asset3dsManifestPath))) {
        try {
          await writeFile(
            asset3dsManifestPath,
            JSON.stringify({ categories: parsed.categories }, null, 2),
            'utf-8'
          )
        } catch {
          /* ignore */
        }
      }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: `Lỗi cú pháp JSON: ${String(err)}` }
  }
}

let lastInternalWriteMs = 0

export function markInternalManifestWrite(): void {
  lastInternalWriteMs = Date.now()
}

async function movePathSafe(src: string, dest: string): Promise<void> {
  const st = await stat(src)
  if (st.isDirectory()) {
    await mkdir(dirname(dest), { recursive: true })
    if (existsSync(dest)) {
      await rm(dest, { recursive: true, force: true })
    }
    try {
      await rename(src, dest)
    } catch {
      await cp(src, dest, { recursive: true, force: true })
      await rm(src, { recursive: true, force: true })
    }
    return
  }
  await mkdir(dirname(dest), { recursive: true })
  try {
    await rename(src, dest)
  } catch {
    await copyFile(src, dest)
    await unlink(src)
  }
}

function decodeDataUrlBuffer(dataUrl?: string): Buffer | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx < 0) return null
  try {
    return Buffer.from(dataUrl.slice(commaIdx + 1), 'base64')
  } catch {
    return null
  }
}

async function updateAssetEntryAcrossManifests(
  root: string,
  cleanTarget: string,
  updater: (existing: any) => any | undefined
): Promise<void> {
  markInternalManifestWrite()
  const filesToUpdate = [
    join(root, 'manifest.json'),
    join(root, 'manifests', 'builtin.json'),
    join(root, 'manifests', 'audio.json'),
    join(root, 'manifests', 'loop-animator.json'),
    join(root, 'manifests', 'layer-25d.json'),
    join(root, 'manifests', 'model-3d.json')
  ]

  const isLoopTarget = cleanTarget.startsWith('loop_animations/') || cleanTarget.startsWith('demo_transparent/campfire_loop')
  const isAudioTarget = cleanTarget.startsWith('audio/')
  const isLayer25dTarget = cleanTarget.startsWith('layer_assemblies/')
  const isModel3dTarget = cleanTarget.startsWith('asset-3ds/')

  await Promise.all(
    filesToUpdate.map(async (filePath) => {
      if (!existsSync(filePath)) return
      try {
        const raw = await readFile(filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        let changed = false

        if (!parsed.assets || typeof parsed.assets !== 'object') {
          parsed.assets = {}
        }

        let matchedKey: string | null = null
        for (const key of Object.keys(parsed.assets)) {
          const normKey = normalizeAssetKey(key)
          if (
            normKey === cleanTarget ||
            normKey.endsWith(`/${cleanTarget}`) ||
            cleanTarget.endsWith(`/${normKey}`)
          ) {
            matchedKey = key
            break
          }
        }

        const shouldInsertInThisFile =
          filePath.endsWith('manifest.json') ||
          (filePath.endsWith('loop-animator.json') && isLoopTarget) ||
          (filePath.endsWith('audio.json') && isAudioTarget) ||
          (filePath.endsWith('layer-25d.json') && isLayer25dTarget) ||
          (filePath.endsWith('model-3d.json') && isModel3dTarget) ||
          (filePath.endsWith('builtin.json') && !isLoopTarget && !isLayer25dTarget && !isModel3dTarget)

        const targetKey = matchedKey || (shouldInsertInThisFile ? cleanTarget : null)
        if (targetKey) {
          const nextVal = updater(parsed.assets[targetKey])
          if (nextVal === undefined) {
            if (targetKey in parsed.assets) {
              delete parsed.assets[targetKey]
              changed = true
            }
          } else {
            parsed.assets[targetKey] = nextVal
            changed = true
          }
        }

        if (Array.isArray(parsed.items)) {
          const initialLen = parsed.items.length
          const probe = updater({})
          if (probe === undefined) {
            parsed.items = parsed.items.filter((it: any) => {
              const k = normalizeAssetKey(it?.path || it?.relativePath || it?.fileName || '')
              return k !== cleanTarget && !k.endsWith(`/${cleanTarget}`) && !cleanTarget.endsWith(`/${k}`)
            })
            if (parsed.items.length !== initialLen) changed = true
          }
        }

        if (changed) {
          await writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8')
        }
      } catch (err) {
        console.warn(`[ManifestCoordinator] Failed to update ${filePath}:`, err)
      }
    })
  )
}

export interface SoftDeleteAssetOptions {
  permanent?: boolean
  snapshotJson?: string
  snapshotName?: string
  snapshotCategory?: string
  snapshotPreviewDataUrl?: string
}

export async function softDeleteOrRemoveBuiltInAsset(
  root: string,
  relPath: string,
  opts?: SoftDeleteAssetOptions
): Promise<{ ok: boolean; status?: ManifestItemStatus; tempPath?: string; error?: string }> {
  const rawClean = normalizeAssetKey(relPath).replace(/^_temp_deleted\//, '')
  if (!rawClean) return { ok: false, error: 'Thiếu đường dẫn tệp' }

  const tempTrashFolder = '_temp_deleted'
  const permanent = Boolean(opts?.permanent)

  // Nhận diện gói hoạt ảnh lặp loop_animations/<slug> để di chuyển nguyên cả thư mục gói
  const loopPkgMatch = rawClean.match(/^(loop_animations\/[^/]+)(?:\/.*)?$/)
  const pkgDirRel = loopPkgMatch ? loopPkgMatch[1] : null
  const cleanTarget = pkgDirRel ? `${pkgDirRel}/animation.json` : rawClean

  const fullPath = join(root, pkgDirRel || cleanTarget)
  const tempFullPath = join(root, tempTrashFolder, pkgDirRel || cleanTarget)

  try {
    markInternalManifestWrite()
    if (permanent) {
      if (existsSync(fullPath)) await rm(fullPath, { recursive: true, force: true })
      if (existsSync(tempFullPath)) await rm(tempFullPath, { recursive: true, force: true })
      await updateAssetEntryAcrossManifests(root, cleanTarget, () => undefined)
      return { ok: true, status: 'deleted' }
    }

    // Soft-delete: di chuyển tệp hoặc cả thư mục gói vào assets/_temp_deleted/
    if (existsSync(fullPath)) {
      await movePathSafe(fullPath, tempFullPath)
    } else if (opts?.snapshotJson || opts?.snapshotPreviewDataUrl) {
      // Tài nguyên procedural / localStorage chưa có file trên đĩa -> ghi bản sao vào _temp_deleted để bảo toàn khôi phục
      if (pkgDirRel) {
        await mkdir(tempFullPath, { recursive: true })
        if (opts.snapshotJson) {
          await writeFile(join(tempFullPath, 'animation.json'), opts.snapshotJson, 'utf-8')
        }
        const imgBuf = decodeDataUrlBuffer(opts.snapshotPreviewDataUrl)
        if (imgBuf) {
          await writeFile(join(tempFullPath, 'thumbnail.png'), imgBuf)
          if (!existsSync(join(tempFullPath, 'frame_000.png'))) {
            await writeFile(join(tempFullPath, 'frame_000.png'), imgBuf)
          }
        }
      } else {
        await mkdir(dirname(tempFullPath), { recursive: true })
        const imgBuf = decodeDataUrlBuffer(opts.snapshotPreviewDataUrl)
        if (imgBuf) {
          await writeFile(tempFullPath, imgBuf)
        } else if (opts.snapshotJson) {
          await writeFile(tempFullPath, opts.snapshotJson, 'utf-8')
        }
      }
    }

    const tempRelPath = `${tempTrashFolder}/${cleanTarget}`
    const deletedAt = new Date().toISOString()
    const fallbackName =
      opts?.snapshotName?.trim() ||
      (pkgDirRel ? pkgDirRel.split('/')[1].replace(/[_-]/g, ' ') : basename(cleanTarget, extname(cleanTarget)).replace(/[_-]/g, ' '))
    const folder = cleanTarget.includes('/') ? cleanTarget.split('/')[0] : ''

    await updateAssetEntryAcrossManifests(root, cleanTarget, (existing) => {
      const baseObj =
        typeof existing === 'string'
          ? { name: existing }
          : existing && typeof existing === 'object'
            ? { ...existing }
            : { name: fallbackName, category: opts?.snapshotCategory || folder || 'uploads' }
      return {
        ...baseObj,
        name: baseObj.name || fallbackName,
        ...(pkgDirRel ? { folder: pkgDirRel, thumbnail: `${pkgDirRel}/thumbnail.png` } : {}),
        status: 'deleted',
        tempPath: tempRelPath,
        deletedAt
      }
    })

    return { ok: true, status: 'deleted', tempPath: tempRelPath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function restoreDeletedBuiltInAsset(
  root: string,
  relPath: string
): Promise<{ ok: boolean; relPath?: string; error?: string }> {
  const rawClean = normalizeAssetKey(relPath).replace(/^_temp_deleted\//, '')
  if (!rawClean) return { ok: false, error: 'Thiếu đường dẫn tệp cần khôi phục' }

  const tempTrashFolder = '_temp_deleted'
  const loopPkgMatch = rawClean.match(/^(loop_animations\/[^/]+)(?:\/.*)?$/)
  const pkgDirRel = loopPkgMatch ? loopPkgMatch[1] : null
  const cleanTarget = pkgDirRel ? `${pkgDirRel}/animation.json` : rawClean

  const tempFullPath = join(root, tempTrashFolder, pkgDirRel || cleanTarget)
  const activeFullPath = join(root, pkgDirRel || cleanTarget)

  try {
    markInternalManifestWrite()
    if (!existsSync(tempFullPath) && !existsSync(activeFullPath)) {
      return { ok: false, error: `Không tìm thấy tệp trong kho tạm (${tempTrashFolder}/${pkgDirRel || cleanTarget})` }
    }

    if (existsSync(tempFullPath)) {
      await movePathSafe(tempFullPath, activeFullPath)
    }

    const fallbackName = pkgDirRel
      ? pkgDirRel.split('/')[1].replace(/[_-]/g, ' ')
      : basename(cleanTarget, extname(cleanTarget)).replace(/[_-]/g, ' ')
    await updateAssetEntryAcrossManifests(root, cleanTarget, (existing) => {
      if (!existing) return { name: fallbackName, status: 'active' }
      const baseObj = typeof existing === 'string' ? { name: existing } : { ...existing }
      delete baseObj.tempPath
      delete baseObj.deletedAt
      return {
        ...baseObj,
        status: 'active'
      }
    })

    return { ok: true, relPath: cleanTarget }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function pruneAllManifestsOnDisk(
  root: string,
  activeRelFiles: string[],
  tempRelFiles: string[],
  opts?: { keepEmpty?: boolean; addNew?: boolean }
): Promise<ManifestPruneReport> {
  markInternalManifestWrite()
  const activeSet = new Set(activeRelFiles)
  const tempSet = new Set(tempRelFiles)
  const report: ManifestPruneReport = {
    removedAssets: [],
    removedItems: [],
    removedCategories: [],
    softDeletedAssets: [],
    restoredAssets: [],
    unlisted: [],
    added: []
  }

  const filesToPrune = [
    { path: join(root, 'manifest.json'), isRoot: true },
    { path: join(root, 'manifests', 'builtin.json'), isRoot: false },
    { path: join(root, 'manifests', 'audio.json'), isRoot: false },
    { path: join(root, 'manifests', 'loop-animator.json'), isRoot: false }
  ]

  for (const entry of filesToPrune) {
    if (!existsSync(entry.path)) continue
    try {
      const raw = await readFile(entry.path, 'utf-8')
      const parsed = JSON.parse(raw)
      let changed = false

      if (parsed.assets && typeof parsed.assets === 'object') {
        const nextAssets: Record<string, any> = {}
        for (const [k, v] of Object.entries(parsed.assets)) {
          const norm = normalizeAssetKey(k)
          const inActive = activeSet.has(norm)
          const inTemp = !inActive && tempSet.has(norm)
          if (inActive) {
            if (v && typeof v === 'object' && (v as any).status === 'deleted') {
              const copy = { ...(v as any), status: 'active' }
              delete copy.tempPath
              delete copy.deletedAt
              nextAssets[k] = copy
              if (entry.isRoot) report.restoredAssets.push(k)
              changed = true
            } else {
              nextAssets[k] = v
            }
          } else if (inTemp) {
            const copy = typeof v === 'string' ? { name: v } : { ...((v as any) || {}) }
            if (copy.status !== 'deleted') {
              if (entry.isRoot) report.softDeletedAssets.push(k)
              changed = true
            }
            nextAssets[k] = {
              ...copy,
              status: 'deleted',
              tempPath: `_temp_deleted/${norm}`
            }
          } else {
            if (entry.isRoot) report.removedAssets.push(k)
            changed = true
          }
        }
        parsed.assets = nextAssets
      }

      if (entry.isRoot) {
        const declared = new Set(Object.keys(parsed.assets || {}).map(normalizeAssetKey))
        for (const rel of activeRelFiles) {
          if (!declared.has(rel)) {
            report.unlisted.push(rel)
            if (opts?.addNew) {
              parsed.assets = parsed.assets || {}
              parsed.assets[rel] = {
                name: basename(rel, extname(rel)).replace(/[_-]/g, ' '),
                category: rel.includes('/') ? rel.split('/')[0] : 'uploads',
                status: 'active'
              }
              report.added.push(rel)
              changed = true
            }
          }
        }
      }

      if (changed) {
        await writeFile(entry.path, JSON.stringify(parsed, null, 2), 'utf-8')
      }
    } catch (err) {
      console.warn(`[ManifestCoordinator] Prune failed on ${entry.path}:`, err)
    }
  }

  return report
}

let activeWatchers: FSWatcher[] = []
let watchDebounceTimer: ReturnType<typeof setTimeout> | null = null

export function startManifestDirectoryWatcher(root: string, onChanged: () => void): void {
  for (const w of activeWatchers) {
    try {
      w.close()
    } catch {
      /* ignore */
    }
  }
  activeWatchers = []

  const trigger = (): void => {
    if (Date.now() - lastInternalWriteMs < 800) return
    if (watchDebounceTimer) clearTimeout(watchDebounceTimer)
    watchDebounceTimer = setTimeout(() => {
      watchDebounceTimer = null
      if (Date.now() - lastInternalWriteMs < 800) return
      onChanged()
    }, 120)
  }

  const dirsToWatch = [root, join(root, 'manifests'), join(root, 'icons')]
  for (const dir of dirsToWatch) {
    if (!existsSync(dir)) continue
    try {
      const watcher = watch(dir, (_eventType, filename) => {
        if (!filename) return
        const lower = filename.toLowerCase()
        if (lower.endsWith('.json') || lower.endsWith('.svg') || lower.endsWith('.png')) {
          trigger()
        }
      })
      activeWatchers.push(watcher)
    } catch {
      /* ignore platform watch limits */
    }
  }
}
