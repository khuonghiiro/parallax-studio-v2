import type { Model3D, Face3D, PresetType, AssetTable } from './types'
import type { Asset3DsCategory } from '@shared/ipc'

const STORAGE_KEY = 'parallax_models_3d_v2'

export function generatePresetFaces(type: PresetType, baseSize: { w: number; h: number; d: number } = { w: 600, h: 400, d: 600 }): Face3D[] {
  const { w, h, d } = baseSize
  const hw = w / 2
  const hd = d / 2
  const hh = h / 2

  switch (type) {
    case 'cottage': {
      // Khung Nhà Mái Chữ A Tudor (Shell 3D): 6 diện phẳng kín khít watertight không khe hở
      // 2 mặt đầu hồi trước/sau (gable walls), 2 vách tường hông (side walls), 2 mái ngói dốc (sloped roofs)
      // w = 600, h = 400, d = 600. Đỉnh đầu hồi cao h + 260 = 660, độ dốc mái 397, góc nghiêng -49.09°
      const apexRise = Math.round(w * (260 / 600))
      const gableH = h + apexRise
      const gableCenterY = -h / 2 + gableH / 2
      const roofSlope = Math.round(Math.sqrt(hw * hw + apexRise * apexRise))
      const roofApexY = -h / 2 + gableH
      const roofCenterY = (h / 2 + roofApexY) / 2
      const pitchDeg = (Math.atan2(apexRise, hw) * 180) / Math.PI
      const pitchEulerX = Number(-(90 - pitchDeg).toFixed(2))

      const eaveV = Number((h / gableH).toFixed(6))
      const gablePoly: number[][] = [[0.5, 1], [1, eaveV], [1, 0], [0, 0], [0, eaveV]]

      return [
        {
          id: 'face-front',
          name: 'Tường Đầu Hồi Trước (Gable Front)',
          assetPath: 'assembly_3d/modular/wall_front_tudor.png',
          width: w,
          height: gableH,
          position: [0, gableCenterY, 0],
          rotation: [0, 0, 0],
          gridRes: 32,
          meshMode: 'auto',
          silhouettePolygon: gablePoly
        },
        {
          id: 'face-back',
          name: 'Tường Đầu Hồi Sau (Gable Back)',
          assetPath: 'assembly_3d/modular/wall_front_tudor.png',
          width: w,
          height: gableH,
          position: [0, gableCenterY, d],
          rotation: [0, 180, 0],
          gridRes: 32,
          meshMode: 'auto',
          silhouettePolygon: gablePoly.map(([u, v]) => [u, v])
        },
        {
          id: 'face-left',
          name: 'Vách Tường Trái (Left Wall)',
          assetPath: 'assembly_3d/modular/wall_side_tudor.png',
          width: d,
          height: h,
          position: [-hw, 0, hd],
          rotation: [0, 90, 0]
        },
        {
          id: 'face-right',
          name: 'Vách Tường Phải (Right Wall)',
          assetPath: 'assembly_3d/modular/wall_side_tudor.png',
          width: d,
          height: h,
          position: [hw, 0, hd],
          rotation: [0, -90, 0]
        },
        {
          id: 'face-roof-left',
          name: 'Mái Dốc Ngói Trái (Left Roof)',
          assetPath: 'assembly_3d/modular/roof_terracotta.png',
          width: d,
          height: roofSlope,
          position: [-hw / 2, roofCenterY, hd],
          rotation: [pitchEulerX, 90, 0]
        },
        {
          id: 'face-roof-right',
          name: 'Mái Dốc Ngói Phải (Right Roof)',
          assetPath: 'assembly_3d/modular/roof_terracotta.png',
          width: d,
          height: roofSlope,
          position: [hw / 2, roofCenterY, hd],
          rotation: [pitchEulerX, -90, 0]
        }
      ]
    }

    case 'cube': {
      // 6 faces of a box
      return [
        {
          id: 'cube-front',
          name: 'Trước',
          color: '#8b7bff',
          width: w,
          height: h,
          position: [0, 0, 0],
          rotation: [0, 0, 0]
        },
        {
          id: 'cube-left',
          name: 'Trái',
          color: '#0284c7',
          width: d,
          height: h,
          position: [-hw, 0, hd],
          rotation: [0, 90, 0]
        },
        {
          id: 'cube-right',
          name: 'Phải',
          color: '#38bdf8',
          width: d,
          height: h,
          position: [hw, 0, hd],
          rotation: [0, -90, 0]
        },
        {
          id: 'cube-back',
          name: 'Sau',
          color: '#6366f1',
          width: w,
          height: h,
          position: [0, 0, d],
          rotation: [0, 180, 0]
        },
        {
          id: 'cube-top',
          name: 'Trên',
          color: '#f59e6b',
          width: w,
          height: d,
          position: [0, hh, hd],
          rotation: [-90, 0, 0]
        },
        {
          id: 'cube-bottom',
          name: 'Dưới',
          color: '#64748b',
          width: w,
          height: d,
          position: [0, -hh, hd],
          rotation: [90, 0, 0]
        }
      ]
    }

    case 'corner': {
      // L-Corner: 2 perpendicular walls and a sidewalk
      return [
        {
          id: 'corner-front',
          name: 'Trước',
          color: '#3b82f6',
          width: w,
          height: h,
          position: [0, 0, 0],
          rotation: [0, 0, 0]
        },
        {
          id: 'corner-side',
          name: 'Trái',
          color: '#0284c7',
          width: d,
          height: h,
          position: [-hw, 0, hd],
          rotation: [0, 90, 0]
        },
        {
          id: 'corner-ground',
          name: 'Dưới',
          color: '#334155',
          width: w * 1.5,
          height: d * 1.5,
          position: [0, -hh, hd],
          rotation: [-90, 0, 0]
        }
      ]
    }

    case 'room': {
      // Open Room Interior: Floor, Back wall, Left wall, Right wall
      return [
        {
          id: 'room-floor',
          name: 'Dưới',
          color: '#475569',
          width: w,
          height: d,
          position: [0, -hh, hd],
          rotation: [-90, 0, 0]
        },
        {
          id: 'room-back',
          name: 'Sau',
          color: '#1e293b',
          width: w,
          height: h,
          position: [0, 0, d],
          rotation: [0, 0, 0]
        },
        {
          id: 'room-left',
          name: 'Trái',
          color: '#334155',
          width: d,
          height: h,
          position: [-hw, 0, hd],
          rotation: [0, 90, 0]
        },
        {
          id: 'room-right',
          name: 'Phải',
          color: '#334155',
          width: d,
          height: h,
          position: [hw, 0, hd],
          rotation: [0, -90, 0]
        }
      ]
    }
  }
}

export const DEFAULT_MODELS_3D: Model3D[] = [
  {
    id: 'model-tudor-cottage',
    name: 'Khung Nhà Mái Chữ A Tudor (Shell 3D)',
    description: 'Khung nhà rỗng phong cách Tudor thuần túy: tường trát vôi trắng nẹp gỗ và mái ngói đất nung kín khít không khe hở.',
    category: 'architecture',
    scale: 1,
    faces: generatePresetFaces('cottage'),
    createdAt: Date.now() - 100000,
    updatedAt: Date.now() - 100000
  },
  {
    id: 'model-cubic-box',
    name: 'Khối Hộp Diêm 3D (Cubic Box)',
    description: 'Khối hộp chữ nhật 6 mặt đa giác vuông khép kín, thích hợp làm thùng hàng, biển quảng cáo 3D, bục trưng bày.',
    category: 'props',
    scale: 0.5,
    faces: generatePresetFaces('cube', { w: 500, h: 500, d: 500 }),
    createdAt: Date.now() - 50000,
    updatedAt: Date.now() - 50000
  },
  {
    id: 'model-l-corner',
    name: 'Góc Phố Cổ Điển 3D (L-Corner Facade)',
    description: 'Hai mặt tiền nhà phố bẻ vuông góc 90° kết hợp vỉa hè, tạo phối cảnh đường phố có chiều sâu thị sai ấn tượng.',
    category: 'architecture',
    scale: 0.6,
    faces: generatePresetFaces('corner', { w: 600, h: 600, d: 600 }),
    createdAt: Date.now() - 20000,
    updatedAt: Date.now() - 20000
  },
  {
    id: 'model-open-room',
    name: 'Phòng Trưng Bày 3D (Interior Room)',
    description: 'Không gian nội thất 3 mặt tường và sàn nhà, camera có thể bay vào bên trong phòng.',
    category: 'room',
    scale: 0.7,
    faces: generatePresetFaces('room', { w: 700, h: 500, d: 700 }),
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000
  }
]

export const HIDDEN_MODELS_3D_KEY = 'parallax_hidden_models_3d_v2'

export function getHiddenModel3DIds(): string[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(HIDDEN_MODELS_3D_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveHiddenModel3DIds(list: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(HIDDEN_MODELS_3D_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

export function hideOrDeleteModel3D(id: string): void {
  const hidden = getHiddenModel3DIds()
  if (!hidden.includes(id)) {
    saveHiddenModel3DIds([...hidden, id])
  }
}

export function unhideModel3D(id: string): void {
  const hidden = getHiddenModel3DIds()
  if (hidden.includes(id)) {
    saveHiddenModel3DIds(hidden.filter((h) => h !== id))
  }
}

export function getStoredModels3D(): Model3D[] {
  try {
    const hidden = getHiddenModel3DIds()
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      const initial = DEFAULT_MODELS_3D.filter((m) => !hidden.includes(m.id))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      // Auto-heal outdated preset geometry for model-tudor-cottage to ensure watertight 6-face Tudor Shell 3D
      const cottageIdx = parsed.findIndex((m: Model3D) => m.id === 'model-tudor-cottage')
      if (cottageIdx >= 0) {
        const c = parsed[cottageIdx]
        const back = c.faces?.find((f: Face3D) => f.id === 'face-back')
        if (c.faces?.length !== 6 || !back || c.name === 'Ngôi Nhà Tudor 3D (Origami Cottage)') {
          parsed[cottageIdx] = {
            ...c,
            name: 'Khung Nhà Mái Chữ A Tudor (Shell 3D)',
            description: 'Khung nhà rỗng phong cách Tudor thuần túy: tường trát vôi trắng nẹp gỗ và mái ngói đất nung kín khít không khe hở.',
            scale: 1,
            faces: generatePresetFaces('cottage'),
            updatedAt: Date.now()
          }
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
          } catch {
            // ignore
          }
        }
      }
      return parsed.filter((m: Model3D) => !hidden.includes(m.id))
    }
    return DEFAULT_MODELS_3D.filter((m) => !hidden.includes(m.id))
  } catch (err) {
    console.warn('[models3dStorage] Error reading localStorage:', err)
    return DEFAULT_MODELS_3D.filter((m) => !getHiddenModel3DIds().includes(m.id))
  }
}

function notifyModelsChanged(): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('models3d:changed'))
    } catch {
      // ignore
    }
  }
}

export function clearAllStoredModels3D(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
  } catch {
    // ignore
  }
  notifyModelsChanged()
}

function modelFolder(id: string): string {
  return (id || 'model-custom').replace(/^model-/, '').replace(/[^a-zA-Z0-9_-]/g, '_')
}

export async function ensureModelThumbnails(models: Model3D[]): Promise<Model3D[]> {
  if (typeof window === 'undefined' || !window.api?.asset3ds?.loadBytes) return models
  const updated = await Promise.all(
    models.map(async (m) => {
      const cat = m.category || 'custom'
      const folder = modelFolder(m.id)
      const candPaths = [
        m.thumbnail ? `${cat}/${folder}/${m.thumbnail}` : null,
        `${cat}/${folder}/thumbnail.png`,
        `${cat}/${folder}/thumb.webp`,
        `${cat}/${folder}/review_cottage.png`,
        m.thumbnail ? `${m.thumbnail}` : null
      ].filter(Boolean) as string[]

      for (const p of candPaths) {
        try {
          const res = await window.api.asset3ds?.loadBytes(p)
          if (res && res.data) {
            let binary = ''
            const bytes = res.data
            const len = bytes.byteLength
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i])
            }
            const b64 = btoa(binary)
            return {
              ...m,
              thumbnailDataUrl: `data:${res.mime || 'image/png'};base64,${b64}`
            }
          }
        } catch {
          // ignore
        }
      }
      return m
    })
  )
  return updated
}

export async function fetchDiskModels3D(): Promise<Model3D[]> {
  const hidden = getHiddenModel3DIds()
  try {
    if (typeof window !== 'undefined' && window.api?.asset3ds?.list) {
      const diskModels = await window.api.asset3ds.list()
      if (Array.isArray(diskModels) && diskModels.length > 0) {
        const stored = getStoredModels3D()
        const map = new Map<string, Model3D>()
        for (const item of stored) {
          if (!hidden.includes(item.id)) map.set(item.id, item)
        }
        for (const item of diskModels) {
          if (hidden.includes(item.id)) continue
          const existing = map.get(item.id)
          if (!existing || (item.updatedAt && item.updatedAt > (existing.updatedAt || 0))) {
            map.set(item.id, item)
          }
        }
        const merged = await ensureModelThumbnails(Array.from(map.values()))
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        } catch {
          // ignore
        }
        return merged
      }
    }
  } catch (err) {
    console.warn('[models3dStorage] Error syncing disk models:', err)
  }
  return getStoredModels3D()
}

export async function saveModel3D(model: Model3D): Promise<void> {
  unhideModel3D(model.id)
  const list = getStoredModels3D()
  const idx = list.findIndex(m => m.id === model.id)
  const updated: Model3D = { ...model, updatedAt: Date.now() }
  if (idx >= 0) {
    list[idx] = updated
  } else {
    list.unshift(updated)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.api?.asset3ds?.save) {
    try {
      await window.api.asset3ds.save(updated)
    } catch (err) {
      console.warn('[models3dStorage] Error saving to asset-3ds:', err)
    }
  }
  notifyModelsChanged()
}

export async function deleteModel3D(id: string): Promise<void> {
  hideOrDeleteModel3D(id)
  const list = getStoredModels3D().filter(m => m.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.api?.asset3ds?.delete) {
    try {
      await window.api.asset3ds.delete(id)
    } catch (err) {
      console.warn('[models3dStorage] Error deleting from asset-3ds:', err)
    }
  }
  notifyModelsChanged()
}

export function duplicateModel3D(id: string): Model3D | null {
  const list = getStoredModels3D()
  const found = list.find(m => m.id === id)
  if (!found) return null
  const clone: Model3D = {
    ...found,
    id: 'model-' + Math.random().toString(36).slice(2, 9),
    name: `${found.name} (Bản sao)`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  saveModel3D(clone)
  return clone
}

export async function fetchAsset3DsCatalog(): Promise<{ categories: Asset3DsCategory[]; models: Model3D[] }> {
  const hidden = getHiddenModel3DIds()
  try {
    if (typeof window !== 'undefined' && window.api?.asset3ds?.getCatalog) {
      const res = await window.api.asset3ds.getCatalog()
      if (res && Array.isArray(res.categories) && Array.isArray(res.models)) {
        const enriched = await ensureModelThumbnails(res.models)
        const filtered = enriched.filter((m: Model3D) => !hidden.includes(m.id))
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
        } catch {
          // ignore
        }
        return {
          categories: res.categories,
          models: filtered
        }
      }
    }
  } catch (err) {
    console.warn('[models3dStorage] Error fetching catalog from disk:', err)
  }
  return {
    categories: [
      { id: 'all', title: 'Tất cả mô hình', icon: 'all', order: 0 },
      { id: 'architecture', title: 'Kiến trúc & Nhà cửa', icon: 'home', order: 1 },
      { id: 'props', title: 'Đạo cụ & Khối hộp', icon: 'cube', order: 2 },
      { id: 'street', title: 'Đường phố & Góc cảnh', icon: 'city', order: 3 },
      { id: 'room', title: 'Nội thất & Căn phòng', icon: 'image', order: 4 },
      { id: 'custom', title: 'Tùy biến & Tự tạo', icon: 'sparkles', order: 5 },
      { id: 'decor', title: 'Bộ phận trang trí', icon: 'sparkles', order: 6 }
    ],
    models: getStoredModels3D()
  }
}

export async function saveAsset3DsManifest(jsonContent: string): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.api?.asset3ds?.saveManifest) {
      const res = await window.api.asset3ds.saveManifest(jsonContent)
      return !!res?.ok
    }
  } catch (err) {
    console.warn('[models3dStorage] Error saving manifest:', err)
  }
  return false
}

/**
 * Xuất Model3D thành chuỗi JSON tiêu chuẩn kèm bảng ánh xạ tài nguyên `assets`.
 * Giúp người dùng & AI đọc và sửa đường dẫn texture cực kỳ nhanh chóng.
 */
export function exportModel3DToJson(model: Model3D, pretty = true): string {
  const assets = model.assets || {}
  const faceAssets: AssetTable = { ...assets }

  // Tự động trích xuất các assetPath từ các mặt nếu chưa có trong bảng assets
  for (const f of model.faces) {
    const p = f.assetPath || f.asset
    if (!p || p.startsWith('@') || p.startsWith('data:') || p.startsWith('blob:')) continue
    const key = (f.name || f.id)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')

    if (key && !(key in faceAssets)) {
      faceAssets[key] = p
    }
  }

  const exportable: Model3D = {
    ...model,
    assets: Object.keys(faceAssets).length > 0 ? faceAssets : undefined
  }

  return JSON.stringify(exportable, null, pretty ? 2 : undefined)
}

/**
 * Nạp Model3D từ chuỗi JSON cấu hình
 */
export function importModel3DFromJson(jsonString: string): Model3D {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (err) {
    throw new Error(`Invalid JSON format: ${String(err)}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON root must be an object representing a Model3D')
  }

  const raw = parsed as Partial<Model3D>
  if (!Array.isArray(raw.faces)) {
    throw new Error('Model3D JSON must contain a "faces" array')
  }

  const model: Model3D = {
    id: raw.id || `model-${Math.random().toString(36).slice(2, 9)}`,
    name: raw.name || 'Mô hình 3D tùy chỉnh',
    description: raw.description,
    category: raw.category || 'custom',
    thumbnail: raw.thumbnail,
    scale: typeof raw.scale === 'number' ? raw.scale : 1.0,
    assets: raw.assets,
    faces: raw.faces,
    lighting: raw.lighting,
    lockedStructure: raw.lockedStructure,
    createdAt: raw.createdAt || Date.now(),
    updatedAt: Date.now()
  }

  return model
}

/**
 * Gán hoặc cập nhật nhãn tài nguyên cho Model3D (tự động cập nhật tức thì)
 */
export function setAssetAliasInModel(
  model: Model3D,
  alias: string,
  newPath: string
): Model3D {
  const cleanAlias = alias.replace(/^@/, '').trim()
  const nextAssets = { ...(model.assets || {}), [cleanAlias]: newPath }
  return {
    ...model,
    assets: nextAssets,
    updatedAt: Date.now()
  }
}

/**
 * Thay thế đường dẫn tài nguyên cũ bằng đường dẫn mới trên toàn bộ Model3D
 */
export function replaceAssetPathInModel(
  model: Model3D,
  oldPath: string,
  newPath: string
): { model: Model3D; replacedCount: number } {
  let replacedCount = 0
  const normOld = oldPath.trim().replace(/\\/g, '/').replace(/^assets\//, '')
  const normNew = newPath.trim().replace(/\\/g, '/')

  const nextAssets = { ...(model.assets || {}) }
  for (const [key, val] of Object.entries(nextAssets)) {
    const strVal = typeof val === 'string' ? val : (val as any)?.path
    if (strVal && (strVal.replace(/\\/g, '/').replace(/^assets\//, '') === normOld || strVal === oldPath)) {
      if (typeof val === 'string') {
        nextAssets[key] = normNew
      } else {
        nextAssets[key] = { ...(val as any), path: normNew }
      }
      replacedCount++
    }
  }

  const nextFaces = model.faces.map((f) => {
    if (f.assetPath && (f.assetPath.replace(/\\/g, '/').replace(/^assets\//, '') === normOld || f.assetPath === oldPath)) {
      replacedCount++
      return { ...f, assetPath: normNew }
    }
    return f
  })

  return {
    model: {
      ...model,
      assets: nextAssets,
      faces: nextFaces,
      updatedAt: Date.now()
    },
    replacedCount
  }
}

