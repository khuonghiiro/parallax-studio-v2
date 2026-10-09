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
    id: 'comp-bonsai-zen',
    name: 'Cây Bonsai Cổ Thụ Đung Đưa 5 Lớp',
    category: 'nature',
    description: 'Nghệ thuật Bonsai phân tách 5 tầng chiều sâu: Chậu gốm cổ, Thân gỗ uốn khúc, Tán sau mờ xa, Tán chính ngọc bích và Tán trước đón nắng.',
    width: 550,
    height: 600,
    layers: [
      {
        id: 'bonsai-pot',
        name: 'Chậu gốm Bonsai dáng dẹt (Gốc neo)',
        assetPath: 'assembly_3d/modular/bonsai_pot.png',
        x: 0,
        y: 160,
        z: 10,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'bonsai-trunk',
        name: 'Thân cổ thụ uốn lượn phong trần',
        assetPath: 'assembly_3d/modular/bonsai_trunk.png',
        x: 0,
        y: 30,
        z: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.7, amplitude: 6, anchor: 'bottom', phaseOffset: 0.1 }
      },
      {
        id: 'bonsai-foliage-back',
        name: 'Tán lá tùng sau (Hậu cảnh Z=+35)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_back.png',
        x: 5,
        y: -10,
        z: 35,
        scale: 0.95,
        rotation: 0,
        opacity: 0.9,
        motion: { type: 'sway', speed: 0.9, amplitude: 10, anchor: 'bottom', phaseOffset: 0.25 }
      },
      {
        id: 'bonsai-foliage-mid',
        name: 'Tán lá tùng chính (Trung cảnh Z=0)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_mid.png',
        x: 0,
        y: -5,
        z: 0,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 1.1, amplitude: 14, anchor: 'bottom', phaseOffset: 0.45 }
      },
      {
        id: 'bonsai-foliage-front',
        name: 'Tán lá tùng trước (Tiền cảnh Z=-30)',
        assetPath: 'assembly_3d/modular/bonsai_foliage_front.png',
        x: -5,
        y: 5,
        z: -30,
        scale: 1.05,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 1.3, amplitude: 18, anchor: 'bottom', phaseOffset: 0.7 }
      }
    ]
  },
  {
    id: 'comp-flower-bush',
    name: 'Bụi Hoa Tự Nhiên Đung Đưa 3 Lớp',
    category: 'nature',
    description: 'Bụi hoa tự nhiên xếp từ bụi cỏ nền, thân cành hoa và các cánh hoa lay động so le theo gió.',
    width: 480,
    height: 520,
    layers: [
      {
        id: 'layer-grass-base',
        name: 'Bụi cỏ nền xanh',
        assetPath: 'assembly_3d/modular/nature_grass.png',
        x: 0,
        y: 80,
        z: 20, // Hậu cảnh
        scale: 1.1,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.8, amplitude: 8, anchor: 'bottom', phaseOffset: 0 }
      },
      {
        id: 'layer-flower-stem',
        name: 'Thân cành hoa chính',
        assetPath: 'assembly_3d/modular/nature_flower_stem.png',
        x: 0,
        y: 20,
        z: 0, // Trung cảnh
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 1.1, amplitude: 14, anchor: 'bottom', phaseOffset: 0.25 }
      },
      {
        id: 'layer-flower-petal',
        name: 'Cánh hoa lay động',
        assetPath: 'assembly_3d/modular/nature_flower_petal.png',
        x: -5,
        y: -110,
        z: -18, // Tiền cảnh
        scale: 0.95,
        rotation: 2,
        opacity: 1,
        motion: { type: 'rocking', speed: 1.4, amplitude: 20, anchor: 'center', phaseOffset: 0.6 }
      },
      {
        id: 'layer-flower-center',
        name: 'Nhụy hoa rực rỡ',
        assetPath: 'assembly_3d/modular/nature_flower_center.png',
        x: -5,
        y: -110,
        z: -25, // Gần camera nhất
        scale: 0.85,
        rotation: 0,
        opacity: 1,
        motion: { type: 'breathe', speed: 1.2, amplitude: 8, anchor: 'center', phaseOffset: 0.4 }
      }
    ]
  },
  {
    id: 'comp-vines-ruins',
    name: 'Cây Dây Leo & Đom Đóm Đung Đưa',
    category: 'nature',
    description: 'Chi tiết tự nhiên gồm vách cổng rêu phong, dây leo rủ đung đưa phía trước và đàn đom đóm lập lòe.',
    width: 600,
    height: 650,
    layers: [
      {
        id: 'layer-ruins',
        name: 'Cổng tàn tích cổ',
        assetPath: 'demo_transparent/layer4_ancient_ruins.png',
        x: 0,
        y: 40,
        z: 15, // Nền sau
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'bottom' }
      },
      {
        id: 'layer-vines',
        name: 'Dây leo rủ tiền cảnh',
        assetPath: 'demo_transparent/layer5_foreground_vines.png',
        x: 0,
        y: -60,
        z: -20, // Rủ phía trước
        scale: 1.05,
        rotation: 0,
        opacity: 1,
        motion: { type: 'sway', speed: 0.9, amplitude: 18, anchor: 'top', phaseOffset: 0.1 }
      },
      {
        id: 'layer-fireflies',
        name: 'Đom đóm lấp lánh (GIF)',
        assetPath: 'demos/sparkle_fireflies.gif',
        x: -30,
        y: -30,
        z: -35, // Lơ lửng sát camera
        scale: 1.2,
        rotation: 0,
        opacity: 0.9,
        motion: { type: 'float', speed: 1.2, amplitude: 14, anchor: 'center', phaseOffset: 0.5 }
      }
    ]
  },
  {
    id: 'comp-balcony-window',
    name: 'Cửa Sổ Ban Công & Giàn Hoa Rung Rinh',
    category: 'architecture',
    description: 'Khung cửa gỗ cổ điển kết hợp bồn hoa rực rỡ và nhánh lá cây đung đưa trước gió.',
    width: 520,
    height: 580,
    layers: [
      {
        id: 'layer-window',
        name: 'Khung cửa sổ Tudor',
        assetPath: 'assembly_3d/modular/decor_window.png',
        x: 0,
        y: -40,
        z: 15,
        scale: 1.0,
        rotation: 0,
        opacity: 1,
        motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' }
      },
      {
        id: 'layer-flower-box',
        name: 'Hộp hoa ban công',
        assetPath: 'assembly_3d/modular/decor_flower_box.png',
        x: 0,
        y: 80,
        z: -5,
        scale: 1.05,
        rotation: 0,
        opacity: 1,
        motion: { type: 'breathe', speed: 1.0, amplitude: 5, anchor: 'bottom', phaseOffset: 0.2 }
      },
      {
        id: 'layer-green-leaf',
        name: 'Nhánh lá cây rung rinh',
        assetPath: 'assembly_3d/modular/nature_leaf.png',
        x: 90,
        y: 40,
        z: -18,
        scale: 0.8,
        rotation: 25,
        opacity: 1,
        motion: { type: 'sway', speed: 1.3, amplitude: 16, anchor: 'bottom', phaseOffset: 0.5 }
      }
    ]
  }
]

const SEED_VERSION = 'v2_bonsai'
const SEED_KEY = 'pxs.layerComposites.seeded_version'

export function getStoredComposites(): LayerComposite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(BUILTIN_COMPOSITES))
      localStorage.setItem(SEED_KEY, SEED_VERSION)
      return BUILTIN_COMPOSITES
    }
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      // Khi có cập nhật bộ mẫu builtin mới (SEED_VERSION chưa khớp), nạp các mẫu mới nếu chưa có
      const currentSeed = localStorage.getItem(SEED_KEY)
      if (currentSeed !== SEED_VERSION) {
        localStorage.setItem(SEED_KEY, SEED_VERSION)
        const existingIds = new Set(parsed.map((c) => c.id))
        const missingBuiltins = BUILTIN_COMPOSITES.filter((b) => !existingIds.has(b.id))
        if (missingBuiltins.length > 0) {
          const merged = [...missingBuiltins, ...parsed]
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          return merged
        }
      }
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
