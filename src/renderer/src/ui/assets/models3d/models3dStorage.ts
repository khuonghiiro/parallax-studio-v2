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
      // Gable Cottage: Front, Left wall, Right wall, Left roof, Right roof
      // Roof rise
      const roofRise = 440
      const roofSlope = Math.round(Math.sqrt(hw * hw + roofRise * roofRise))
      const pitchDeg = Number((Math.atan2(roofRise, hw) * (180 / Math.PI)).toFixed(2))

      return [
        {
          id: 'face-front',
          name: 'Trước',
          assetPath: 'assembly_3d/house/origami_front.png',
          width: 980,
          height: 966,
          position: [0, 140, 0],
          rotation: [0, 0, 0]
        },
        {
          id: 'face-left',
          name: 'Trái',
          assetPath: 'assembly_3d/house/origami_side_left.png',
          width: d,
          height: h,
          position: [-hw, -32, hd],
          rotation: [0, 90, 0]
        },
        {
          id: 'face-right',
          name: 'Phải',
          assetPath: 'assembly_3d/house/origami_side_right.png',
          width: d,
          height: h,
          position: [hw, -32, hd],
          rotation: [0, -90, 0]
        },
        {
          id: 'face-roof-left',
          name: 'Mái trái',
          assetPath: 'assembly_3d/house/origami_roof_left.png',
          width: d,
          height: roofSlope,
          position: [-hw / 2, 212, hd],
          rotation: [pitchDeg, -90, 0]
        },
        {
          id: 'face-roof-right',
          name: 'Mái phải',
          assetPath: 'assembly_3d/house/origami_roof_right.png',
          width: d,
          height: roofSlope,
          position: [hw / 2, 212, hd],
          rotation: [-pitchDeg, -90, 0]
        },
        {
          id: 'face-chimney-left',
          name: 'Khói trái',
          assetPath: 'assembly_3d/house/origami_chimney_side.png',
          width: 113,
          height: 140,
          position: [-34, 386, 34],
          rotation: [0, 90, 0]
        },
        {
          id: 'face-chimney-right',
          name: 'Khói phải',
          assetPath: 'assembly_3d/house/origami_chimney_side.png',
          width: 113,
          height: 140,
          position: [34, 386, 34],
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
    description: 'Ngôi nhà châu Âu cổ điển lắp ráp từ 5 diện phẳng 2.5D: Mặt tiền đầu hồi, 2 tường hông và 2 cánh mái nghiêng dốc khớp khít 100%.',
    category: 'architecture',
    thumbnail: 'asset-3ds/tudor_cottage/review_cottage.png',
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
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MODELS_3D))
      return DEFAULT_MODELS_3D
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return DEFAULT_MODELS_3D
  } catch (err) {
    console.warn('[models3dStorage] Error reading localStorage:', err)
    return DEFAULT_MODELS_3D
  }
}

export async function fetchDiskModels3D(): Promise<Model3D[]> {
  try {
    if (typeof window !== 'undefined' && window.api?.asset3ds?.list) {
      const diskModels = await window.api.asset3ds.list()
      if (Array.isArray(diskModels) && diskModels.length > 0) {
        const stored = getStoredModels3D()
        const map = new Map<string, Model3D>()
        for (const item of stored) map.set(item.id, item)
        for (const item of diskModels) map.set(item.id, item)
        const merged = Array.from(map.values())
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

export function saveModel3D(model: Model3D): void {
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
    window.api.asset3ds.save(updated).catch((err) => {
      console.warn('[models3dStorage] Error saving to asset-3ds:', err)
    })
  }
}

export function deleteModel3D(id: string): void {
  const list = getStoredModels3D().filter(m => m.id !== id)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined' && window.api?.asset3ds?.delete) {
    window.api.asset3ds.delete(id).catch((err) => {
      console.warn('[models3dStorage] Error deleting from asset-3ds:', err)
    })
  }
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
        return {
          categories: res.categories,
          models: res.models
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
      { id: 'custom', title: 'Tùy biến & Tự tạo', icon: 'sparkles', order: 5 }
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
