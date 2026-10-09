import type { LayerComposite, LayerCompositeCategory } from './types'

export const COMPOSITE_CATEGORIES: LayerCompositeCategory[] = [
  { id: 'all', title: 'Tất cả chi tiết', icon: 'all', order: 0 },
  { id: 'nature', title: 'Cây cối & Thiên nhiên', icon: 'tree', order: 1 },
  { id: 'prop', title: 'Đạo cụ & Trang trí', icon: 'sparkles', order: 2 },
  { id: 'character', title: 'Nhân vật & Sinh vật', icon: 'user', order: 3 },
  { id: 'architecture', title: 'Kiến trúc & Cửa nẻo', icon: 'home', order: 4 },
  { id: 'custom', title: 'Tự tạo & Đã lưu', icon: 'folder', order: 5 }
]

const STORAGE_KEY = 'pxs.layerComposites'

/**
 * Các mẫu cụm layer dựng sẵn (Presets) minh họa việc ghép cây từ các layer xếp chồng và hoạt ảnh đung đưa.
 */
export const BUILTIN_COMPOSITES: LayerComposite[] = [
  {
    id: 'comp-oak-tree',
    name: 'Cây Sồi Đung Đưa 3 Lớp',
    category: 'nature',
    description: 'Cây cổ thụ ghép từ thân gỗ, cành lá trung cảnh và tán lá tiền cảnh đung đưa so le trong gió.',
    width: 600,
    height: 700,
    layers: [
      {
        id: 'layer-trunk',
        name: 'Thân cây & Cành chính',
        assetPath: 'nature/tree-trunk.png',
        x: 0,
        y: 120,
        z: 20, // Ở sau
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.6, amplitude: 3, anchor: 'bottom', phaseOffset: 0 }
      },
      {
        id: 'layer-canopy-back',
        name: 'Tán lá hậu cảnh (Sâu)',
        assetPath: 'nature/tree-canopy-back.png',
        x: -15,
        y: -140,
        z: 35, // Lớp sâu nhất
        scale: 1.15,
        rotation: -2,
        opacity: 0.85,
        motion: { type: 'breathe', speed: 0.8, amplitude: 6, anchor: 'center', phaseOffset: 0.2 }
      },
      {
        id: 'layer-canopy-mid',
        name: 'Tán lá trung cảnh (Giữa)',
        assetPath: 'nature/tree-canopy-mid.png',
        x: 10,
        y: -90,
        z: 0, // Lớp giữa
        scale: 1.0,
        rotation: 1,
        opacity: 1,
        motion: { type: 'sway', speed: 1.0, amplitude: 14, anchor: 'bottom', phaseOffset: 0.4 }
      },
      {
        id: 'layer-canopy-front',
        name: 'Nhánh lá tiền cảnh (Trước)',
        assetPath: 'nature/tree-leaves-front.png',
        x: -25,
        y: -40,
        z: -25, // Gần camera nhất
        scale: 0.95,
        rotation: 4,
        opacity: 1,
        motion: { type: 'sway', speed: 1.25, amplitude: 22, anchor: 'bottom', phaseOffset: 0.75 }
      }
    ]
  },
  {
    id: 'comp-flower-bush',
    name: 'Bụi Hoa Hồng Đung Đưa',
    category: 'nature',
    description: 'Bụi cây hoa tự nhiên gồm lớp cỏ nền phía sau, cành hoa giữa và các cánh hoa lay động phía trước.',
    width: 480,
    height: 520,
    layers: [
      {
        id: 'layer-bush-base',
        name: 'Bụi cỏ nền xanh',
        assetPath: 'nature/bush-base.png',
        x: 0,
        y: 60,
        z: 15,
        scale: 1.05,
        rotation: 0,
        opacity: 0.95,
        motion: { type: 'sway', speed: 0.8, amplitude: 6, anchor: 'bottom', phaseOffset: 0 }
      },
      {
        id: 'layer-stems',
        name: 'Thân cành hoa',
        assetPath: 'nature/flower-stem.png',
        x: 0,
        y: 0,
        z: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 1.1, amplitude: 12, anchor: 'bottom', phaseOffset: 0.3 }
      },
      {
        id: 'layer-blossom',
        name: 'Bông hoa đỏ tiền cảnh',
        assetPath: 'nature/flower-blossom.png',
        x: 10,
        y: -110,
        z: -18,
        scale: 0.9,
        rotation: 3,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.4, amplitude: 18, anchor: 'center', phaseOffset: 0.6 }
      }
    ]
  },
  {
    id: 'comp-hanging-lantern',
    name: 'Đèn Lồng Treo Lay Động',
    category: 'prop',
    description: 'Đèn lồng cổ trang gồm dây treo neo trên đỉnh, lồng đèn lắc lư con lắc và ánh sáng quầng vàng nhấp nhô.',
    width: 360,
    height: 600,
    layers: [
      {
        id: 'layer-rope',
        name: 'Dây xích treo',
        assetPath: 'props/lantern-rope.png',
        x: 0,
        y: -180,
        z: 5,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'top' }
      },
      {
        id: 'layer-lantern-body',
        name: 'Khung đèn lồng',
        assetPath: 'props/lantern-body.png',
        x: 0,
        y: 10,
        z: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'rocking', speed: 0.9, amplitude: 15, anchor: 'top', phaseOffset: 0 }
      },
      {
        id: 'layer-glow',
        name: 'Quầng sáng ấm áp',
        assetPath: 'props/lantern-glow.png',
        x: 0,
        y: 35,
        z: -10,
        scale: 1.2,
        rotation: 0,
        opacity: 0.8,
        motion: { type: 'breathe', speed: 1.5, amplitude: 12, anchor: 'center', phaseOffset: 0.5 }
      }
    ]
  }
]

export function getStoredComposites(): LayerComposite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(BUILTIN_COMPOSITES))
      return BUILTIN_COMPOSITES
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return BUILTIN_COMPOSITES
  } catch {
    return BUILTIN_COMPOSITES
  }
}

export function saveComposite(composite: LayerComposite): void {
  const list = getStoredComposites()
  const idx = list.findIndex((c) => c.id === composite.id)
  const updated: LayerComposite = {
    ...composite,
    updatedAt: Date.now()
  }

  let nextList: LayerComposite[]
  if (idx >= 0) {
    nextList = [...list]
    nextList[idx] = updated
  } else {
    updated.createdAt = Date.now()
    nextList = [updated, ...list]
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('layerComposites:changed'))
  }
}

export function deleteComposite(id: string): void {
  const list = getStoredComposites()
  const nextList = list.filter((c) => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('layerComposites:changed'))
  }
}

export function duplicateComposite(id: string): LayerComposite | null {
  const list = getStoredComposites()
  const item = list.find((c) => c.id === id)
  if (!item) return null

  const dup: LayerComposite = {
    ...item,
    id: `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${item.name} (Bản sao)`,
    category: 'custom',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    layers: item.layers.map((l) => ({
      ...l,
      id: `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    }))
  }

  saveComposite(dup)
  return dup
}
