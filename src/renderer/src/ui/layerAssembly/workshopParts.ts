import type { AssembledLayerItem, LayerComposite, LayerPartGroup, LayerPartKind } from './types'
import { newLayerId } from './workshopActions'
import { inferSlot } from './workshopPartDetect'
export { autoDetectParts, inferPartKind, inferSide, inferSlot } from './workshopPartDetect'

/**
 * Nhóm bộ phận & khe biến thể (Part groups & swap slots) — lấy cảm hứng từ Spine (slot/attachment),
 * Moho (switch layer) và Character Animator (swap set):
 *  - Nhóm bộ phận khoá liên kết: kéo một bộ phận (mắt) thì cả nhóm (đầu) dịch chuyển cùng, không lệch.
 *  - Khe biến thể: các layer cùng `slot` (face-normal / face-happy / face-cry) thay thế nhau tại CÙNG vị trí neo.
 */

export const PART_KIND_LABEL: Record<LayerPartKind, string> = {
  head: 'Đầu & khuôn mặt',
  torso: 'Thân',
  arm: 'Tay',
  leg: 'Chân',
  accessory: 'Phụ kiện',
  custom: 'Tuỳ chỉnh'
}

export function groupMembers(composite: LayerComposite, groupId: string): AssembledLayerItem[] {
  return composite.layers.filter((l) => l.partGroupId === groupId)
}

export function findGroup(composite: LayerComposite, groupId?: string): LayerPartGroup | undefined {
  return groupId ? composite.partGroups?.find((g) => g.id === groupId) : undefined
}

/** Mở rộng vùng chọn: layer thuộc nhóm đang khoá liên kết kéo theo toàn bộ thành viên (trừ layer bị khoá riêng). */
export function expandLinkedSelection(composite: LayerComposite, ids: string[]): string[] {
  const out = new Set(ids)
  for (const id of ids) {
    const layer = composite.layers.find((l) => l.id === id)
    const group = findGroup(composite, layer?.partGroupId)
    if (!group?.locked) continue
    for (const member of groupMembers(composite, group.id)) if (!member.locked) out.add(member.id)
  }
  return [...out]
}

/** Áp dụng dịch chuyển X/Y cho layer và mọi thành viên của nhóm đang khoá liên kết. */
export function moveLinked(composite: LayerComposite, id: string, x: number, y: number): LayerComposite {
  const layer = composite.layers.find((l) => l.id === id)
  if (!layer || layer.locked) return composite
  const dx = x - layer.x
  const dy = y - layer.y
  const targets = new Set(expandLinkedSelection(composite, [id]))
  return {
    ...composite,
    layers: composite.layers.map((l) => (targets.has(l.id) ? { ...l, x: l.x + dx, y: l.y + dy } : l))
  }
}

export function createPartGroup(composite: LayerComposite, name: string, layerIds: string[], kind: LayerPartKind = 'custom'): LayerComposite {
  const id = `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const group: LayerPartGroup = { id, name: name.trim() || 'Nhóm mới', kind, locked: true, anchorLayerId: layerIds[0] }
  return {
    ...composite,
    partGroups: [...(composite.partGroups ?? []), group],
    layers: composite.layers.map((l) => (layerIds.includes(l.id) ? { ...l, partGroupId: id } : l))
  }
}

/** Gán layer vào nhóm (null = gỡ khỏi nhóm). Nhóm trống tự bị gỡ; neo bị gỡ thì chuyển cho thành viên đầu tiên. */
export function assignToGroup(composite: LayerComposite, layerIds: string[], groupId: string | null): LayerComposite {
  if (groupId && !findGroup(composite, groupId)) throw new Error(`Unknown part group: ${groupId}`)
  const layers = composite.layers.map((l) => (layerIds.includes(l.id) ? { ...l, partGroupId: groupId ?? undefined } : l))
  const partGroups = (composite.partGroups ?? [])
    .filter((g) => layers.some((l) => l.partGroupId === g.id))
    .map((g) => (layers.some((l) => l.id === g.anchorLayerId && l.partGroupId === g.id) ? g : { ...g, anchorLayerId: layers.find((l) => l.partGroupId === g.id)?.id }))
  return { ...composite, layers, partGroups }
}

export function updatePartGroup(composite: LayerComposite, groupId: string, patch: Partial<Omit<LayerPartGroup, 'id'>>): LayerComposite {
  if (!findGroup(composite, groupId)) throw new Error(`Unknown part group: ${groupId}`)
  return { ...composite, partGroups: composite.partGroups!.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) }
}

export function deletePartGroup(composite: LayerComposite, groupId: string): LayerComposite {
  return {
    ...composite,
    partGroups: (composite.partGroups ?? []).filter((g) => g.id !== groupId),
    layers: composite.layers.map((l) => (l.partGroupId === groupId ? { ...l, partGroupId: undefined } : l))
  }
}

export function setLayerSlot(composite: LayerComposite, layerId: string, slot: string | null, variant?: string): LayerComposite {
  return {
    ...composite,
    layers: composite.layers.map((l) =>
      l.id === layerId ? { ...l, slot: slot?.trim() || undefined, variant: slot ? variant?.trim() || l.variant || l.name : undefined } : l
    )
  }
}

export function slotVariants(composite: LayerComposite, slot?: string): AssembledLayerItem[] {
  return slot ? composite.layers.filter((l) => l.slot === slot) : []
}

const TRANSFORM_KEYS = ['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'rotation', 'rotationX', 'rotationY', 'boneId', 'bindingMode', 'partGroupId'] as const

function copyAnchor(from: AssembledLayerItem): Partial<AssembledLayerItem> {
  const out: Partial<AssembledLayerItem> = {}
  for (const k of TRANSFORM_KEYS) (out as Record<string, unknown>)[k] = from[k]
  return out
}

/** Vai trò của layer trong biến thể (VD 'eyes-cry' → 'eyes') để căn neo đúng cặp khi đổi biến thể nhiều lớp. */
function roleOf(layer: AssembledLayerItem): string {
  return inferSlot(layer.name)?.slot || layer.name.trim().toLowerCase()
}

/**
 * Kích hoạt một biến thể trong khe: hiện TOÀN BỘ layer cùng tên biến thể (biến thể có thể gồm nhiều lớp như
 * mắt + miệng + lông mày), ẩn các biến thể còn lại. `snap` = căn trùng vị trí neo (x/y/z/scale/góc/xương) của
 * layer đang hiển thị cùng vai trò để thay biểu cảm không bị lệch.
 */
export function activateVariant(composite: LayerComposite, layerId: string, snap = true): LayerComposite {
  const target = composite.layers.find((l) => l.id === layerId)
  if (!target) throw new Error(`Unknown layer: ${layerId}`)
  if (!target.slot) return { ...composite, layers: composite.layers.map((l) => (l.id === layerId ? { ...l, hidden: false } : l)) }
  const key = target.variant || target.name
  const inSlot = composite.layers.filter((l) => l.slot === target.slot)
  const incoming = inSlot.filter((l) => (l.variant || l.name) === key)
  const current = inSlot.filter((l) => !l.hidden && (l.variant || l.name) !== key)
  const anchors = new Map<string, Partial<AssembledLayerItem>>()
  if (snap && current.length) {
    if (incoming.length === 1 && current.length === 1) anchors.set(incoming[0].id, copyAnchor(current[0]))
    else for (const inc of incoming) {
      const match = current.find((c) => roleOf(c) === roleOf(inc))
      if (match) anchors.set(inc.id, copyAnchor(match))
    }
  }
  const incomingIds = new Set(incoming.map((l) => l.id))
  return {
    ...composite,
    layers: composite.layers.map((l) => {
      if (incomingIds.has(l.id)) return { ...l, ...(anchors.get(l.id) ?? {}), hidden: false }
      if (l.slot === target.slot) return { ...l, hidden: true }
      return l
    })
  }
}

export interface PartAssetCandidate {
  path: string
  name: string
  previewUrl?: string
}

function aliasFor(composite: LayerComposite, path: string): string {
  const base = (path.split(/[\\/]/).pop() || 'part').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'part'
  const table = composite.assets ?? {}
  const existing = Object.entries(table).find(([, v]) => (typeof v === 'string' ? v : (v as { path?: string })?.path) === path)
  if (existing) return existing[0]
  let alias = base
  for (let i = 2; table[alias] !== undefined; i++) alias = `${base}_${i}`
  return alias
}

function assetFields(composite: LayerComposite, cand: PartAssetCandidate): { patch: Partial<AssembledLayerItem>; assets: LayerComposite['assets'] } {
  if (cand.path.startsWith('data:') || cand.path.startsWith('blob:')) {
    return { patch: { asset: undefined, assetPath: undefined, imageUrl: cand.path }, assets: composite.assets }
  }
  const alias = aliasFor(composite, cand.path)
  return {
    patch: { asset: `@${alias}`, assetPath: cand.path, imageUrl: undefined },
    assets: { ...(composite.assets ?? {}), [alias]: cand.path }
  }
}

/**
 * Thay ảnh một bộ phận nhưng GIỮ nguyên vị trí/xương/nhóm. `mode = 'variant'` giữ layer cũ làm biến thể ẩn
 * và thêm layer mới cùng khe (dựng nhanh bộ biểu cảm). Trả về composite mới + id layer đang hiển thị.
 */
export function replacePartAsset(
  composite: LayerComposite,
  layerId: string,
  cand: PartAssetCandidate,
  mode: 'replace' | 'variant' = 'replace'
): { composite: LayerComposite; layerId: string } {
  const layer = composite.layers.find((l) => l.id === layerId)
  if (!layer) throw new Error(`Unknown layer: ${layerId}`)
  const { patch, assets } = assetFields(composite, cand)
  const label = cand.name.replace(/\.[a-z0-9]+$/i, '')
  if (mode === 'replace') {
    const layers = composite.layers.map((l) => (l.id === layerId ? { ...l, ...patch, name: label } : l))
    return { composite: { ...composite, assets, layers }, layerId }
  }
  const slot = layer.slot || inferSlot(layer.name)?.slot || layer.name.toLowerCase().replace(/[\s_.]+/g, '-')
  const id = newLayerId()
  const variant = inferSlot(label)?.variant || label
  const added: AssembledLayerItem = { ...structuredClone(layer), ...patch, id, name: label, slot, variant, hidden: false }
  const index = composite.layers.findIndex((l) => l.id === layerId)
  const layers = composite.layers.map((l) =>
    l.id === layerId ? { ...l, slot, variant: l.variant || inferSlot(l.name)?.variant || l.name, hidden: true } : l.slot === slot ? { ...l, hidden: true } : l
  )
  layers.splice(index + 1, 0, added)
  return { composite: { ...composite, assets, layers }, layerId: id }
}

function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return i >= 0 ? path.slice(0, i).replace(/\\/g, '/') : ''
}

/** Đường dẫn ảnh thực của layer (giải alias '@x' qua bảng assets). */
export function layerAssetPath(composite: Pick<LayerComposite, 'assets'>, layer: Pick<AssembledLayerItem, 'asset' | 'assetPath'>): string {
  const ref = layer.asset || layer.assetPath || ''
  if (ref.startsWith('@')) {
    const v = composite.assets?.[ref.slice(1)]
    const p = typeof v === 'string' ? v : (v as { path?: string } | undefined)?.path
    return p || layer.assetPath || ''
  }
  return layer.assetPath || ref
}

/**
 * Ứng viên thay thế liên quan: ảnh cùng thư mục với bộ phận hiện tại (cùng dự án nhân vật), ưu tiên ảnh cùng tiền tố khe
 * (VD 'face-*' cho khuôn mặt). Bỏ qua ảnh đang dùng.
 */
export function relatedCandidates(currentPath: string, slot: string | undefined, catalog: PartAssetCandidate[]): PartAssetCandidate[] {
  const dir = dirname(currentPath)
  const norm = (p: string) => p.replace(/\\/g, '/')
  const pool = catalog.filter((c) => norm(c.path) !== norm(currentPath) && (!dir || dirname(norm(c.path)) === dir))
  const prefix = (slot || inferSlot(currentPath.split(/[\\/]/).pop() || '')?.slot || '').toLowerCase()
  const score = (c: PartAssetCandidate) => {
    const file = (norm(c.path).split('/').pop() || '').toLowerCase()
    return prefix && file.startsWith(prefix) ? 0 : 1
  }
  return pool.slice().sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name))
}

/** Thư mục chứa ảnh (dùng làm thư mục tải lên để ảnh mới luôn nằm cạnh bộ phận cùng nhân vật). */
export function folderOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i > 0 && !path.startsWith('data:') ? path.slice(0, i) : 'uploads'
}

/** Ảnh trong bảng tài nguyên của chính mẫu nhân vật + kho có sẵn (khử trùng lặp theo đường dẫn). */
export function mergeCompositeAssets(assets: LayerComposite['assets'], catalog: PartAssetCandidate[]): PartAssetCandidate[] {
  const seen = new Set<string>()
  const out: PartAssetCandidate[] = []
  const push = (c: PartAssetCandidate) => {
    const key = c.path.replace(/\\/g, '/')
    if (!c.path || seen.has(key)) return
    seen.add(key)
    out.push(c)
  }
  for (const [alias, entry] of Object.entries(assets ?? {})) {
    const path = typeof entry === 'string' ? entry : entry?.path
    if (path) push({ path, name: (path.split('/').pop() || alias).replace(/\.[^.]+$/, '') })
  }
  catalog.forEach(push)
  return out
}
