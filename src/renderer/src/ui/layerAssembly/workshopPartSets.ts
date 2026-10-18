import type { AssembledLayerItem, LayerComposite } from './types'
import { activateVariant, findGroup, inferSlot, replacePartAsset, type PartAssetCandidate } from './workshopParts'

/**
 * Bộ biến thể nhiều lớp (multi-layer swap set) — giống Skin của Spine / Swap Set của Character Animator:
 *  - Một "bộ biến thể" (slot) có thể gồm nhiều biến thể; MỖI biến thể có thể gồm NHIỀU layer
 *    (VD bộ "Biểu cảm" → biến thể "khóc" = mắt-khóc + miệng-khóc + nước mắt). Bật biến thể nào thì
 *    toàn bộ layer của biến thể đó hiện, các biến thể khác ẩn — không giả định khuôn mặt là 1 ảnh liền.
 *  - Tên bộ / tên biến thể do người dùng đặt (đổi tên được), không phụ thuộc tên mặc định kiểu "face".
 */

export const variantKey = (l: Pick<AssembledLayerItem, 'variant' | 'name'>) => l.variant || l.name

/** Các biến thể của một bộ, mỗi biến thể kèm danh sách layer (giữ thứ tự xuất hiện trong cụm). */
export function slotVariantGroups(composite: LayerComposite, slot: string): Array<{ variant: string; layers: AssembledLayerItem[]; active: boolean }> {
  const map = new Map<string, AssembledLayerItem[]>()
  for (const l of composite.layers) if (l.slot === slot) map.set(variantKey(l), [...(map.get(variantKey(l)) ?? []), l])
  return [...map.entries()].map(([variant, layers]) => ({ variant, layers, active: layers.some((l) => !l.hidden) }))
}

/** Danh sách tên bộ biến thể đang có (theo thứ tự xuất hiện). */
export function slotNames(composite: LayerComposite): string[] {
  return [...new Set(composite.layers.map((l) => l.slot).filter((s): s is string => !!s))]
}

function uniqueSlotName(composite: LayerComposite, base: string): string {
  const taken = new Set(slotNames(composite))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base} ${i}`)) i++
  return `${base} ${i}`
}

/** Tạo bộ biến thể mới từ các layer đang chọn: mỗi layer là một biến thể (tên lấy từ hậu tố hoặc tên layer). */
export function createVariantSet(composite: LayerComposite, layerIds: string[], name?: string): { composite: LayerComposite; slot: string } {
  const ids = layerIds.filter((id) => composite.layers.some((l) => l.id === id))
  if (!ids.length) throw new Error('Chọn ít nhất 1 layer để tạo bộ biến thể')
  const slot = uniqueSlotName(composite, name?.trim() || `Bộ biến thể ${slotNames(composite).length + 1}`)
  const layers = composite.layers.map((l) => (ids.includes(l.id) ? { ...l, slot, variant: inferSlot(l.name)?.variant || l.name } : l))
  return { composite: activateVariant({ ...composite, layers }, ids[0], false), slot }
}

/** Đổi tên bộ biến thể (áp cho mọi layer trong bộ). Trùng tên bộ khác thì gộp chung. */
export function renameSlot(composite: LayerComposite, slot: string, next: string): LayerComposite {
  const name = next.trim()
  if (!name || name === slot) return composite
  return { ...composite, layers: composite.layers.map((l) => (l.slot === slot ? { ...l, slot: name } : l)) }
}

/** Đổi tên một biến thể trong bộ (mọi layer thuộc biến thể đó). */
export function renameVariant(composite: LayerComposite, slot: string, variant: string, next: string): LayerComposite {
  const name = next.trim()
  if (!name || name === variant) return composite
  return {
    ...composite,
    layers: composite.layers.map((l) => (l.slot === slot && variantKey(l) === variant ? { ...l, variant: name } : l))
  }
}

/** Giải tán bộ biến thể: các layer giữ nguyên hiển thị hiện tại, chỉ bỏ liên kết thay thế. */
export function dissolveSlot(composite: LayerComposite, slot: string): LayerComposite {
  return { ...composite, layers: composite.layers.map((l) => (l.slot === slot ? { ...l, slot: undefined, variant: undefined } : l)) }
}

/**
 * Thêm layer vào một biến thể (tạo biến thể nhiều lớp). Layer mới hiện/ẩn theo trạng thái biến thể:
 * biến thể đang bật thì layer hiện, ngược lại ẩn. `variant` bỏ trống = tạo biến thể riêng theo tên layer.
 */
export function addLayersToVariant(composite: LayerComposite, layerIds: string[], slot: string, variant?: string): LayerComposite {
  const groups = slotVariantGroups(composite, slot)
  return {
    ...composite,
    layers: composite.layers.map((l) => {
      if (!layerIds.includes(l.id)) return l
      const v = variant || inferSlot(l.name)?.variant || l.name
      const target = groups.find((g) => g.variant === v)
      const visible = target ? target.active : groups.length === 0
      return { ...l, slot, variant: v, hidden: !visible }
    })
  }
}

/** Gỡ một layer khỏi bộ biến thể và cho hiển thị lại. */
export function removeFromSlot(composite: LayerComposite, layerId: string): LayerComposite {
  return { ...composite, layers: composite.layers.map((l) => (l.id === layerId ? { ...l, slot: undefined, variant: undefined, hidden: false } : l)) }
}

/** Ảnh mới thả vào một biến thể → thêm layer cùng vị trí với layer đầu của biến thể đó. */
export function addAssetToVariant(composite: LayerComposite, slot: string, variant: string, cand: PartAssetCandidate): { composite: LayerComposite; layerId: string } {
  const group = slotVariantGroups(composite, slot).find((g) => g.variant === variant)
  if (!group) throw new Error(`Unknown variant: ${slot}/${variant}`)
  const base = group.layers[0]
  const res = replacePartAsset(composite, base.id, cand, 'variant')
  const layers = res.composite.layers.map((l) => {
    if (l.id === res.layerId) return { ...l, slot, variant, hidden: !group.active }
    if (group.layers.some((g) => g.id === l.id)) return { ...l, slot, variant, hidden: !group.active }
    return l
  })
  return { composite: { ...res.composite, layers }, layerId: res.layerId }
}

/**
 * Ảnh mới thả vào một nhóm bộ phận → tạo layer mới đặt đúng tại vị trí neo của nhóm (cùng xương, độ sâu)
 * và gắn ngay vào nhóm — thao tác "kéo ảnh vào chỗ neo để liên kết".
 */
export function addAssetToGroup(composite: LayerComposite, groupId: string, cand: PartAssetCandidate): { composite: LayerComposite; layerId: string } {
  const group = findGroup(composite, groupId)
  if (!group) throw new Error(`Unknown part group: ${groupId}`)
  const anchor = composite.layers.find((l) => l.id === group.anchorLayerId) ?? composite.layers.find((l) => l.partGroupId === groupId)
  if (!anchor) throw new Error('Nhóm chưa có layer neo')
  const res = replacePartAsset(composite, anchor.id, cand, 'variant')
  const layers = res.composite.layers.map((l) => {
    if (l.id === res.layerId) return { ...l, slot: undefined, variant: undefined, hidden: false, partGroupId: groupId, z: anchor.z - 1 }
    if (l.id === anchor.id) return { ...anchor }
    return composite.layers.find((o) => o.id === l.id) ?? l
  })
  return { composite: { ...res.composite, layers }, layerId: res.layerId }
}
