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
const SEED_VERSION = 'v16_multi_animation_clips_and_retargeting'
const SEED_KEY = 'pxs.layerComposites.seeded_version'
const DELETED_KEY = 'pxs.layerComposites.deleted'

/** Lấy tập hợp ID các mẫu composite mà người dùng đã chủ động xóa (bao gồm cả mẫu có sẵn) */
export function getDeletedCompositeIds(): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set<string>()
    const raw = localStorage.getItem(DELETED_KEY)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.filter((id) => typeof id === 'string')) : new Set<string>()
  } catch {
    return new Set<string>()
  }
}

/** Lưu danh sách ID đã xóa vào localStorage để ngăn việc tự động nạp lại khi mở lại ứng dụng */
export function saveDeletedCompositeIds(ids: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // ignore
  }
}

/** Lọc bỏ các bản sao rác auto-clone `(Bản đã lưu)` từ lỗi seed cũ và khử trùng lặp id */
export function cleanDuplicateComposites(list: LayerComposite[]): LayerComposite[] {
  const seenIds = new Set<string>()
  return list.filter((item) => {
    if (!item || !item.id) return false
    // Loại bỏ các bản sao auto-saved do lỗi seed cũ tạo ra (*-saved-<timestamp>)
    if (
      typeof item.id === 'string' &&
      item.id.match(/^comp-.*-saved-\d+$/) &&
      typeof item.name === 'string' &&
      item.name.endsWith('(Bản đã lưu)')
    ) {
      return false
    }
    // Khử trùng lặp ID
    if (seenIds.has(item.id)) return false
    seenIds.add(item.id)
    return true
  })
}

export function getStoredComposites(): LayerComposite[] {
  try {
    if (typeof localStorage === 'undefined') return BUILTIN_COMPOSITES

    const deletedIds = getDeletedCompositeIds()
    const raw = localStorage.getItem(STORAGE_KEY)

    // Khởi tạo lần đầu tiên khi chưa có dữ liệu trong storage
    if (raw === null) {
      const initial = BUILTIN_COMPOSITES.filter((b) => !deletedIds.has(b.id))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
      localStorage.setItem(SEED_KEY, SEED_VERSION)
      return initial
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      const fallback = BUILTIN_COMPOSITES.filter((b) => !deletedIds.has(b.id))
      return fallback
    }

    // 1. Luôn làm sạch các bản sao rác và loại bỏ hoàn toàn các ID đã bị người dùng xóa
    const cleaned = cleanDuplicateComposites(parsed).filter((c) => !deletedIds.has(c.id))

    // 2. Kiểm tra phiên bản mẫu dựng sẵn
    const currentSeed = localStorage.getItem(SEED_KEY)
    if (currentSeed !== SEED_VERSION) {
      localStorage.setItem(SEED_KEY, SEED_VERSION)

      const builtinMap = new Map(BUILTIN_COMPOSITES.map((b) => [b.id, b]))
      const resultMap = new Map<string, LayerComposite>()

      // Đưa các mẫu builtin cập nhật mới vào (trừ những mẫu người dùng đã xóa)
      for (const builtin of BUILTIN_COMPOSITES) {
        if (!deletedIds.has(builtin.id)) {
          // Bảo lưu thumbnail đã render cache trước đó nếu có
          const existing = cleaned.find((c) => c.id === builtin.id)
          resultMap.set(builtin.id, {
            ...builtin,
            thumbnail: existing?.thumbnail || builtin.thumbnail
          })
        }
      }

      // Giữ nguyên các mẫu tự tạo của người dùng (không nằm trong builtin và chưa bị xóa)
      for (const item of cleaned) {
        if (!builtinMap.has(item.id)) {
          resultMap.set(item.id, item)
        }
      }

      const merged = Array.from(resultMap.values())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
      return merged
    }

    // 3. Nếu danh sách đã được dọn rác có độ dài khác với parsed ban đầu, đồng bộ lại localStorage
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned))
    }

    return cleaned
  } catch {
    return BUILTIN_COMPOSITES
  }
}

export function saveComposite(composite: LayerComposite): void {
  // Nếu ID này từng nằm trong danh sách đã xóa, khôi phục lại vì người dùng chủ động tạo/lưu mới
  const deleted = getDeletedCompositeIds()
  if (deleted.has(composite.id)) {
    deleted.delete(composite.id)
    saveDeletedCompositeIds(deleted)
  }

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

/** Cập nhật ảnh thumbnail xem trước trong storage một cách an toàn mà không gán updatedAt và không phục hồi item đã xóa */
export function updateCompositeThumbnail(id: string, thumbnail: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    const deleted = getDeletedCompositeIds()
    if (deleted.has(id)) return

    const list = getStoredComposites()
    const idx = list.findIndex((c) => c.id === id)
    if (idx < 0) return
    if (list[idx].thumbnail === thumbnail) return

    const nextList = [...list]
    nextList[idx] = {
      ...list[idx],
      thumbnail
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList))
  } catch {
    // ignore
  }
}

export function deleteComposite(id: string): void {
  // Ghi nhớ vĩnh viễn ID đã bị người dùng xóa vào danh sách tombstones
  const deleted = getDeletedCompositeIds()
  deleted.add(id)
  saveDeletedCompositeIds(deleted)

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

/** Khôi phục lại toàn bộ các mẫu có sẵn (built-in) về trạng thái mặc định */
export function restoreDefaultComposites(): LayerComposite[] {
  const deleted = getDeletedCompositeIds()
  for (const b of BUILTIN_COMPOSITES) {
    deleted.delete(b.id)
  }
  saveDeletedCompositeIds(deleted)

  const current = getStoredComposites()
  const currentMap = new Map<string, LayerComposite>()
  for (const c of current) currentMap.set(c.id, c)
  for (const b of BUILTIN_COMPOSITES) {
    currentMap.set(b.id, b)
  }

  const merged = Array.from(currentMap.values())
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('layerComposites:changed'))
  }
  return merged
}

