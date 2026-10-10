import type { LayerComposite, LayerCompositeCategory } from './types'
import { BUILTIN_COMPOSITES } from './layerAssemblyDefaultComposites'

export { BUILTIN_COMPOSITES }

export const COMPOSITE_CATEGORIES: LayerCompositeCategory[] = [
  { id: 'all', title: 'Tất cả chi tiết', icon: 'layers', order: 0 },
  { id: 'nature', title: 'Cây cối & Thiên nhiên', icon: 'tree', order: 1 },
  { id: 'prop', title: 'Đạo cụ & Trang trí', icon: 'prop', order: 2 },
  { id: 'character', title: 'Nhân vật & Sinh vật', icon: 'user', order: 3 },
  { id: 'architecture', title: 'Kiến trúc & Cửa nẻo', icon: 'home', order: 4 },
  { id: 'custom', title: 'Tự tạo & Đã lưu', icon: 'folder', order: 5 }
]

const STORAGE_KEY = 'pxs.layerComposites'
const SEED_VERSION = 'v12_natural_frontal_walk_and_depth'
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
      // Khi có cập nhật bộ mẫu builtin mới (SEED_VERSION chưa khớp), làm mới các preset builtin
      const currentSeed = localStorage.getItem(SEED_KEY)
      if (currentSeed !== SEED_VERSION) {
        localStorage.setItem(SEED_KEY, SEED_VERSION)
        const builtinIds = new Set(BUILTIN_COMPOSITES.map((b) => b.id))
        const userCustoms = parsed.filter((c) => !builtinIds.has(c.id))
        // Preserve user-authored versions before installing refreshed built-in artwork.
        const savedBuiltins = parsed.filter((c) => builtinIds.has(c.id) && c.updatedAt).map((c) => ({
          ...c, id: `${c.id}-saved-${c.updatedAt}`, category: 'custom', name: `${c.name} (Bản đã lưu)`
        }))
        const merged = [...BUILTIN_COMPOSITES, ...userCustoms,
          ...savedBuiltins.filter((c) => !userCustoms.some((saved) => saved.id === c.id))]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        return merged
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
