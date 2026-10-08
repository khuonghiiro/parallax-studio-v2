import { app, ipcMain, shell } from 'electron'
import { existsSync } from 'fs'
import { readdir, readFile, stat, writeFile, mkdir } from 'fs/promises'
import { basename, extname, join, relative } from 'path'

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  json: 'application/json'
}

export interface Asset3DsCategory {
  id: string
  title: string
  icon: string
  description?: string
  order?: number
}

export const DEFAULT_3D_CATEGORIES: Asset3DsCategory[] = [
  { id: 'all', title: 'Tất cả mô hình', icon: 'all', order: 0 },
  { id: 'architecture', title: 'Kiến trúc & Nhà cửa', icon: 'home', order: 1 },
  { id: 'props', title: 'Đạo cụ & Khối hộp', icon: 'cube', order: 2 },
  { id: 'street', title: 'Đường phố & Góc cảnh', icon: 'city', order: 3 },
  { id: 'room', title: 'Nội thất & Căn phòng', icon: 'image', order: 4 },
  { id: 'custom', title: 'Tùy biến & Tự tạo', icon: 'sparkles', order: 5 }
]

export function getAsset3DsRoot(): string {
  const devPath = join(process.cwd(), 'asset-3ds')
  if (existsSync(devPath)) return devPath
  const appPath = join(app.getAppPath(), 'asset-3ds')
  if (existsSync(appPath)) return appPath
  const resPath = join(process.resourcesPath, 'asset-3ds')
  if (existsSync(resPath)) return resPath
  return devPath
}

export async function readAsset3DsManifest(): Promise<Asset3DsCategory[]> {
  const root = getAsset3DsRoot()
  const manifestPath = join(root, 'manifest.json')
  if (!existsSync(manifestPath)) {
    return DEFAULT_3D_CATEGORIES
  }
  try {
    const raw = await readFile(manifestPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.categories)) {
      return parsed.categories
    }
  } catch (err) {
    console.warn('[Asset3Ds] Error reading manifest.json:', err)
  }
  return DEFAULT_3D_CATEGORIES
}

async function findModelJsonFiles(dir: string): Promise<string[]> {
  const results: string[] = []
  if (!existsSync(dir)) return results

  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await findModelJsonFiles(full)))
    } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'manifest.json') {
      results.push(full)
    }
  }
  return results
}

export async function scanAsset3DsModels(): Promise<any[]> {
  const root = getAsset3DsRoot()
  if (!existsSync(root)) return []

  const jsonFiles = await findModelJsonFiles(root)
  const models: any[] = []

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(file, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.id && Array.isArray(parsed.faces)) {
        // Resolve thumbnail as data URL if available
        let thumb = parsed.thumbnail
        if (thumb) {
          const cleanRel = thumb.replace(/^asset-3ds[\\/]/, '')
          let thumbPath = join(root, cleanRel)
          if (!existsSync(thumbPath)) {
            for (const cat of ['architecture', 'props', 'street', 'room', 'custom']) {
              const cand = join(root, cat, cleanRel)
              if (existsSync(cand)) {
                thumbPath = cand
                break
              }
            }
          }
          if (!existsSync(thumbPath)) {
            const assetsDir = join(process.cwd(), 'assets')
            const cleanAssetsRel = thumb.replace(/^assets[\\/]/, '')
            const cand = join(assetsDir, cleanAssetsRel)
            if (existsSync(cand)) {
              thumbPath = cand
            }
          }
          if (existsSync(thumbPath)) {
            const buf = await readFile(thumbPath)
            const ext = extname(thumbPath).slice(1).toLowerCase()
            const mime = MIME_MAP[ext] || 'image/png'
            parsed.thumbnailDataUrl = `data:${mime};base64,${buf.toString('base64')}`
          }
        }
        
        // If still no thumbnail, fallback to first face asset
        if (!parsed.thumbnailDataUrl && Array.isArray(parsed.faces) && parsed.faces.length > 0) {
          const firstFacePath = parsed.faces[0]?.assetPath
          if (firstFacePath) {
            const cleanFace = firstFacePath.replace(/^assets[\\/]/, '')
            const cand = join(process.cwd(), 'assets', cleanFace)
            if (existsSync(cand)) {
              const buf = await readFile(cand)
              const ext = extname(cand).slice(1).toLowerCase()
              const mime = MIME_MAP[ext] || 'image/png'
              parsed.thumbnailDataUrl = `data:${mime};base64,${buf.toString('base64')}`
            }
          }
        } else if (!thumb) {
          // Check if there is review_cottage.png, thumb.webp or thumbnail.png in same folder
          const dir = join(file, '..')
          for (const cand of ['thumb.webp', 'review_cottage.png', 'thumbnail.png', 'preview.png']) {
            const p = join(dir, cand)
            if (existsSync(p)) {
              const buf = await readFile(p)
              const ext = extname(p).slice(1).toLowerCase()
              const mime = MIME_MAP[ext] || 'image/png'
              parsed.thumbnailDataUrl = `data:${mime};base64,${buf.toString('base64')}`
              break
            }
          }
        }
        parsed._filePath = file
        models.push(parsed)
      }
    } catch (err) {
      console.warn('[Asset3Ds] Error reading model JSON:', file, err)
    }
  }

  // Sort by updatedAt descending
  models.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return models
}

export async function scanAsset3DsCatalog(): Promise<{ categories: Asset3DsCategory[]; models: any[] }> {
  const categories = await readAsset3DsManifest()
  const models = await scanAsset3DsModels()
  return { categories, models }
}

export async function saveAsset3DModel(model: any): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const root = getAsset3DsRoot()
    const folderName = (model.id || 'model-custom').replace(/^model-/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
    const category = model.category || 'custom'
    const dir = join(root, category, folderName)
    await mkdir(dir, { recursive: true })

    const outPath = join(dir, 'model.json')
    const toSave = {
      ...model,
      updatedAt: Date.now()
    }

    if (typeof model.thumbnailDataUrl === 'string' && model.thumbnailDataUrl.startsWith('data:image/')) {
      const match = model.thumbnailDataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/)
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
        const thumbName = `thumbnail.${ext}`
        const thumbFile = join(dir, thumbName)
        await writeFile(thumbFile, Buffer.from(match[2], 'base64'))
        toSave.thumbnail = thumbName
      }
    }

    delete toSave.thumbnailDataUrl
    delete toSave._filePath

    await writeFile(outPath, JSON.stringify(toSave, null, 2), 'utf-8')
    return { ok: true, path: outPath }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function loadAsset3DBytes(relPath: string): Promise<{ name: string; mime: string; data: Uint8Array } | null> {
  const root = getAsset3DsRoot()
  const cleanRel = relPath.replace(/^asset-3ds[\\/]/, '').replace(/^[\\/]/, '')
  let fullPath = join(root, cleanRel)
  if (!existsSync(fullPath)) {
    // Check in category subfolders
    for (const cat of ['architecture', 'props', 'street', 'room', 'custom']) {
      const cand = join(root, cat, cleanRel)
      if (existsSync(cand)) {
        fullPath = cand
        break
      }
    }
  }
  if (!existsSync(fullPath)) {
    const assetsDir = join(process.cwd(), 'assets')
    const cand = join(assetsDir, relPath.replace(/^assets[\\/]/, ''))
    if (existsSync(cand)) {
      fullPath = cand
    }
  }
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

export function registerAsset3DsIpc(): void {
  ipcMain.handle('asset3ds:getCatalog', async () => scanAsset3DsCatalog())
  ipcMain.handle('asset3ds:list', async () => scanAsset3DsModels())
  ipcMain.handle('asset3ds:save', async (_e, model: any) => saveAsset3DModel(model))
  ipcMain.handle('asset3ds:delete', async (_e, id: string) => {
    try {
      const models = await scanAsset3DsModels()
      const target = models.find((m) => m.id === id)
      if (target?._filePath) {
        const folder = dirname(target._filePath)
        if (existsSync(folder)) {
          await rm(folder, { recursive: true, force: true })
        }
      }
      return { ok: true }
    } catch (err) {
      console.error('[asset3ds:delete] Failed to delete:', err)
      return { ok: false }
    }
  })
  ipcMain.handle('asset3ds:loadBytes', async (_e, relPath: string) => loadAsset3DBytes(relPath))
  ipcMain.handle('asset3ds:openFolder', async () => {
    const root = getAsset3DsRoot()
    if (existsSync(root)) {
      await shell.openPath(root)
    }
  })
  ipcMain.handle('asset3ds:saveManifest', async (_e, jsonContent: string) => {
    try {
      const root = getAsset3DsRoot()
      const manifestPath = join(root, 'manifest.json')
      const parsed = JSON.parse(jsonContent)
      await writeFile(manifestPath, JSON.stringify(parsed, null, 2), 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })
}
