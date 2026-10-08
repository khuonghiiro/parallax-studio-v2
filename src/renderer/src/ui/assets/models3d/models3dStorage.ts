import type { Model3D, Face3D, PresetType } from './types'
import type { Asset3DsCategory } from '@shared/ipc'

const STORAGE_KEY = 'parallax_models_3d_v2'

export function generatePresetFaces(type: PresetType, baseSize: { w: number; h: number; d: number } = { w: 840, h: 400, d: 840 }): Face3D[] {
  const { w, h, d } = baseSize
  const hw = w / 2
  const hd = d / 2
  const hh = h / 2

  switch (type) {
    case 'cottage': {
      // Tudor Cottage 3D: Front facade, Left/Right walls, Left/Right roof slopes, Left/Right chimney sides.
      // Exact gapless mathematical derivation:
      // Front: 980 x 966, ground at y = -483, eave overhang at y = -90 (side wall height 393), ridge apex at y = 349.62.
      // Side walls: 840 x 393, depth 840, normal facing outwards (+/- X).
      // Roof slopes: 840 x 608, slope rise 439.62, pitch 46.31 deg (Euler rx: -43.69 deg, normal facing up & out).
      // Chimney sides: 113 x 140, base resting on ridge at y = 343, top matching facade top at y = 483.
      const frontW = 980
      const frontH = 966
      const wallW = w
      const wallH = 393
      const wallD = d
      const hw = wallW / 2
      const hd = wallD / 2

      const groundY = -frontH / 2
      const wallCenterY = groundY + wallH / 2
      const eaveY = groundY + wallH

      const roofSlope = 608
      const roofRise = Number(Math.sqrt(Math.max(0, roofSlope * roofSlope - hw * hw)).toFixed(2))
      const roofApexY = eaveY + roofRise
      const roofCenterY = Number(((eaveY + roofApexY) / 2).toFixed(2))
      const pitchDeg = (Math.atan2(roofRise, hw) * 180) / Math.PI
      const pitchEulerX = Number(-(90 - pitchDeg).toFixed(2))

      const chimW = 113
      const chimH = 140
      const chimX = 48
      const chimCenterY = 413
      const chimCenterZ = Number((chimW / 2).toFixed(2))

      return [
        {
          id: 'face-front',
          name: '1. Mặt Tiền (Gable Front)',
          assetPath: 'assembly_3d/modular/wall_front_tudor.png',
          width: frontW,
          height: frontH,
          position: [0, 0, 0],
          rotation: [0, 0, 0]
        },
        {
          id: 'face-left',
          name: '2. Tường Hông Trái (Left Wall)',
          assetPath: 'assembly_3d/modular/wall_side_tudor.png',
          width: wallD,
          height: wallH,
          position: [-hw, wallCenterY, hd],
          rotation: [0, 90, 0]
        },
        {
          id: 'face-right',
          name: '3. Tường Hông Phải (Right Wall)',
          assetPath: 'assembly_3d/modular/wall_side_tudor.png',
          width: wallD,
          height: wallH,
          position: [hw, wallCenterY, hd],
          rotation: [0, -90, 0]
        },
        {
          id: 'face-roof-left',
          name: '4. Mái Nghiêng Trái (Left Roof)',
          assetPath: 'assembly_3d/modular/roof_terracotta.png',
          width: wallD,
          height: roofSlope,
          position: [-hw / 2, roofCenterY, hd],
          rotation: [pitchEulerX, 90, 0]
        },
        {
          id: 'face-roof-right',
          name: '5. Mái Nghiêng Phải (Right Roof)',
          assetPath: 'assembly_3d/modular/roof_terracotta.png',
          width: wallD,
          height: roofSlope,
          position: [hw / 2, roofCenterY, hd],
          rotation: [pitchEulerX, -90, 0]
        },
        {
          id: 'face-chimney-left',
          name: '6. Ống Khói Hông Trái (Chimney Left)',
          assetPath: 'assembly_3d/modular/decor_chimney.png',
          width: chimW,
          height: chimH,
          position: [-chimX, chimCenterY, chimCenterZ],
          rotation: [0, 90, 0]
        },
        {
          id: 'face-chimney-right',
          name: '7. Ống Khói Hông Phải (Chimney Right)',
          assetPath: 'assembly_3d/modular/decor_chimney.png',
          width: chimW,
          height: chimH,
          position: [chimX, chimCenterY, chimCenterZ],
          rotation: [0, -90, 0]
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
    name: 'Ngôi Nhà Tudor 3D (Origami Cottage)',
    description: 'Ngôi nhà châu Âu cổ điển lắp ráp từ 7 diện phẳng 2.5D: Mặt tiền đầu hồi, 2 tường hông, 2 cánh mái dốc và 2 mặt hông ống khói.',
    category: 'architecture',
    scale: 0.6,
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

export function getStoredModels3D(): Model3D[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MODELS_3D))
      return DEFAULT_MODELS_3D
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      // Auto-heal outdated preset geometry for model-tudor-cottage if old misaligned coordinates exist
      const cottageIdx = parsed.findIndex((m: Model3D) => m.id === 'model-tudor-cottage')
      if (cottageIdx >= 0) {
        const c = parsed[cottageIdx]
        const front = c.faces?.find((f: Face3D) => f.id === 'face-front')
        const roofLeft = c.faces?.find((f: Face3D) => f.id === 'face-roof-left')
        if (front?.position?.[1] === 140 || (roofLeft?.rotation?.[0] ?? 0) > 0) {
          parsed[cottageIdx] = {
            ...c,
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
      return parsed
    }
    return DEFAULT_MODELS_3D
  } catch (err) {
    console.warn('[models3dStorage] Error reading localStorage:', err)
    return DEFAULT_MODELS_3D
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
          const res = await window.api.asset3ds.loadBytes(p)
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
  try {
    if (typeof window !== 'undefined' && window.api?.asset3ds?.list) {
      const diskModels = await window.api.asset3ds.list()
      if (Array.isArray(diskModels) && diskModels.length > 0) {
        const stored = getStoredModels3D()
        const map = new Map<string, Model3D>()
        for (const item of stored) map.set(item.id, item)
        for (const item of diskModels) {
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
  try {
    if (typeof window !== 'undefined' && window.api?.asset3ds?.getCatalog) {
      const res = await window.api.asset3ds.getCatalog()
      if (res && Array.isArray(res.categories) && Array.isArray(res.models)) {
        const enriched = await ensureModelThumbnails(res.models)
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched))
        } catch {
          // ignore
        }
        return {
          categories: res.categories,
          models: enriched
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
