import type { AssembledLayerItem, LayerComposite, LayerPartGroup, LayerPartKind } from './types'
import { newLayerId } from './workshopActions'

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

const HEAD_RE = /(head|face|eye|mouth|nose|brow|hair|glass|(?<![a-z])ear|lip|cheek|bang|đầu|mặt|mắt|miệng|mũi|mày|tóc|kính|tai|môi|má)/i
const TORSO_RE = /(torso|body|chest|neck|belly|pelvis|hip|thân|ngực|bụng|hông|cổ(?!\s*(tay|chân)))/i
const ARM_RE = /(arm|hand|forearm|elbow|wrist|finger|tay|bàn tay|khuỷu)/i
const LEG_RE = /(thigh|shin|leg|foot|feet|knee|ankle|calf|shoe|đùi|ống chân|bàn chân|chân|gối)/i
const LEFT_RE = /(^|[\s_\-.])(left|l|trái)($|[\s_\-.])/i
const RIGHT_RE = /(^|[\s_\-.])(right|r|phải)($|[\s_\-.])/i

/** Các từ chỉ trạng thái / biểu cảm: hậu tố này cho biết layer là một biến thể của khe. */
const VARIANT_WORDS = new Set([
  'normal', 'neutral', 'default', 'idle', 'happy', 'smile', 'laugh', 'sad', 'cry', 'crying', 'tear', 'angry', 'mad',
  'surprise', 'surprised', 'shock', 'blink', 'closed', 'close', 'open', 'half', 'talk', 'wink', 'sleep', 'sleepy',
  'fear', 'scared', 'shy', 'blush', 'pout', 'grin', 'confused', 'love', 'a', 'e', 'i', 'o', 'u',
  'vui', 'buon', 'buồn', 'khoc', 'khóc', 'gian', 'giận', 'cuoi', 'cười', 'ngac', 'ngạc', 'nham', 'nhắm', 'mo', 'mở', 'thuong', 'thường'
])

export function inferPartKind(name: string): LayerPartKind | null {
  if (ARM_RE.test(name)) return 'arm'
  if (LEG_RE.test(name)) return 'leg'
  if (HEAD_RE.test(name)) return 'head'
  if (TORSO_RE.test(name)) return 'torso'
  return null
}

export function inferSide(name: string): 'left' | 'right' | null {
  if (LEFT_RE.test(name)) return 'left'
  if (RIGHT_RE.test(name)) return 'right'
  return null
}

/** 'face-happy' → { slot: 'face', variant: 'happy' }; 'arm-left' → null (không phải biến thể). */
export function inferSlot(name: string): { slot: string; variant: string } | null {
  const clean = name.trim().toLowerCase().replace(/\.[a-z0-9]+$/, '')
  const m = clean.match(/^(.+?)[\s_\-.]+([\p{L}\d]+)$/u)
  if (!m || !VARIANT_WORDS.has(m[2])) return null
  return { slot: m[1].replace(/[\s_.]+/g, '-'), variant: m[2] }
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

function groupKey(kind: LayerPartKind, side: 'left' | 'right' | null): string {
  return side && (kind === 'arm' || kind === 'leg') ? `${kind}-${side}` : kind
}

function groupLabel(kind: LayerPartKind, side: 'left' | 'right' | null): string {
  if (kind === 'arm') return side === 'left' ? 'Tay trái' : side === 'right' ? 'Tay phải' : 'Tay'
  if (kind === 'leg') return side === 'left' ? 'Chân trái' : side === 'right' ? 'Chân phải' : 'Chân'
  return kind === 'head' ? 'Đầu' : PART_KIND_LABEL[kind]
}

function pickAnchor(members: AssembledLayerItem[], kind: LayerPartKind): string | undefined {
  const byName = (re: RegExp) => members.find((m) => re.test(m.name))?.id
  if (kind === 'head') return byName(/^(head|đầu)/i) ?? byName(/head|đầu/i) ?? members[0]?.id
  if (kind === 'torso') return byName(/torso|thân|body/i) ?? members[0]?.id
  return members.slice().sort((a, b) => a.y - b.y)[0]?.id
}

/**
 * Tự nhận diện nhóm bộ phận và khe biến thể từ tên layer. Giữ nguyên các gán nhóm/khe người dùng đã đặt.
 */
export function autoDetectParts(composite: LayerComposite): LayerComposite {
  const groups = new Map((composite.partGroups ?? []).map((g) => [g.id, { ...g }]))
  const layers = composite.layers.map((layer) => {
    const next = { ...layer }
    if (!next.slot) {
      const s = inferSlot(next.name)
      if (s) Object.assign(next, { slot: s.slot, variant: s.variant })
    }
    if (!next.partGroupId) {
      const kind = inferPartKind(next.name)
      if (kind) {
        const side = inferSide(next.name)
        const id = `part-${groupKey(kind, side)}`
        if (!groups.has(id)) groups.set(id, { id, name: groupLabel(kind, side), kind, locked: true })
        next.partGroupId = id
      }
    }
    return next
  })
  for (const g of groups.values()) {
    if (!g.anchorLayerId || !layers.some((l) => l.id === g.anchorLayerId)) {
      g.anchorLayerId = pickAnchor(layers.filter((l) => l.partGroupId === g.id), g.kind)
    }
  }
  return { ...composite, layers, partGroups: [...groups.values()].filter((g) => layers.some((l) => l.partGroupId === g.id)) }
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

export function assignToGroup(composite: LayerComposite, layerIds: string[], groupId: string | null): LayerComposite {
  if (groupId && !findGroup(composite, groupId)) throw new Error(`Unknown part group: ${groupId}`)
  const layers = composite.layers.map((l) => (layerIds.includes(l.id) ? { ...l, partGroupId: groupId ?? undefined } : l))
  const partGroups = (composite.partGroups ?? []).filter((g) => layers.some((l) => l.partGroupId === g.id))
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

/**
 * Kích hoạt một biến thể trong khe: hiện layer đó, ẩn các biến thể còn lại. `snap` = căn trùng vị trí neo
 * (x/y/z/scale/góc/xương) của biến thể đang hiển thị để thay biểu cảm không bị lệch.
 */
export function activateVariant(composite: LayerComposite, layerId: string, snap = true): LayerComposite {
  const target = composite.layers.find((l) => l.id === layerId)
  if (!target) throw new Error(`Unknown layer: ${layerId}`)
  if (!target.slot) return { ...composite, layers: composite.layers.map((l) => (l.id === layerId ? { ...l, hidden: false } : l)) }
  const current = composite.layers.find((l) => l.slot === target.slot && !l.hidden && l.id !== layerId)
  const anchor = snap && current ? copyAnchor(current) : {}
  return {
    ...composite,
    layers: composite.layers.map((l) => {
      if (l.id === layerId) return { ...l, ...anchor, hidden: false }
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
