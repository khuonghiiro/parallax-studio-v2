import type { LayerBone } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from '../types'
import { computeBoneTail } from '../mohoRigHelpers'
import { CREATURE_SPECIES } from './creatureRigCatalog'
import type {
  CreatureBindMode,
  CreatureBoneKind,
  CreatureFacing,
  CreatureRigBuild,
  CreatureSpecies,
  LayerPixelSize
} from './creatureRigTypes'

/**
 * Khớp khung xương sinh vật vào ảnh thật trong Xưởng (giống bước "Fit Skeleton" của Moho Character Wizard),
 * nhận diện loài / hướng mặt từ tên layer và tự gắn layer vào xương phù hợp nhất (Auto-Bind).
 */

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const tagOf = (l: AssembledLayerItem) => `${l.id} ${l.name} ${l.slot ?? ''}`.toLowerCase()
const visibleLayers = (layers: AssembledLayerItem[]) => {
  const pool = layers.filter((l) => !l.hidden)
  return pool.length ? pool : layers
}

/** Khung bao các layer đang hiện (dùng kích thước ảnh thật nếu có, nếu không ước lượng theo khung cụm). */
export function computeLayersRect(composite: LayerComposite, sizes: Record<string, LayerPixelSize> = {}): Rect | null {
  const list = visibleLayers(composite.layers)
  if (!list.length) return null
  const fallback = Math.min(composite.width || 480, composite.height || 480) * (list.length === 1 ? 0.6 : 0.24)
  const rect: Rect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const l of list) {
    const size = sizes[l.id]
    const s = Math.max(0.05, l.scale || 1)
    const hw = ((size?.w ?? fallback) * s * Math.abs(l.scaleX ?? 1)) / 2
    const hh = ((size?.h ?? fallback) * s * Math.abs(l.scaleY ?? 1)) / 2
    rect.minX = Math.min(rect.minX, l.x - hw)
    rect.maxX = Math.max(rect.maxX, l.x + hw)
    rect.minY = Math.min(rect.minY, l.y - hh)
    rect.maxY = Math.max(rect.maxY, l.y + hh)
  }
  return rect
}

export function skeletonRect(bones: LayerBone[]): Rect {
  const rect: Rect = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const b of bones) {
    const tail = computeBoneTail(b)
    for (const p of [{ x: b.x, y: b.y }, tail]) {
      rect.minX = Math.min(rect.minX, p.x)
      rect.maxX = Math.max(rect.maxX, p.x)
      rect.minY = Math.min(rect.minY, p.y)
      rect.maxY = Math.max(rect.maxY, p.y)
    }
  }
  return rect
}

/** Co giãn + dời khung xương (giữ nguyên tỉ lệ) để lọt khít trong khung đích với lề `fill`. */
export function fitBonesToRect(bones: LayerBone[], target: Rect, fill = 0.86): LayerBone[] {
  if (!bones.length) return bones
  const src = skeletonRect(bones)
  const sw = Math.max(1, src.maxX - src.minX)
  const sh = Math.max(1, src.maxY - src.minY)
  const tw = Math.max(20, target.maxX - target.minX)
  const th = Math.max(20, target.maxY - target.minY)
  const scale = Math.max(0.15, Math.min(8, Math.min((tw * fill) / sw, (th * fill) / sh)))
  const scx = (src.minX + src.maxX) / 2
  const scy = (src.minY + src.maxY) / 2
  const tcx = (target.minX + target.maxX) / 2
  const tcy = (target.minY + target.maxY) / 2
  return bones.map((b) => ({
    ...b,
    x: Number(((b.x - scx) * scale + tcx).toFixed(2)),
    y: Number(((b.y - scy) * scale + tcy).toFixed(2)),
    length: Number(Math.max(2, b.length * scale).toFixed(2))
  }))
}

/** Đoán loài sinh vật từ tên cụm + tên các layer (chấm điểm theo số từ khoá khớp). */
export function detectCreatureSpecies(composite: LayerComposite): CreatureSpecies | null {
  const texts = [composite.name ?? '', ...composite.layers.map(tagOf)].map((t) => t.toLowerCase())
  let best: CreatureSpecies | null = null
  let bestScore = 0
  for (const meta of CREATURE_SPECIES) {
    const score = texts.reduce((acc, t) => acc + (meta.keywords.test(t) ? 1 : 0), 0)
    if (score > bestScore) {
      best = meta.id
      bestScore = score
    }
  }
  return best
}

/** Đoán hướng mặt với sinh vật nhìn ngang: so vị trí layer đầu và layer đuôi. */
export function detectCreatureFacing(composite: LayerComposite): CreatureFacing | null {
  const find = (re: RegExp) => composite.layers.find((l) => re.test(tagOf(l)))
  const head = find(/(head|face|snout|beak|muzzle|đầu|mặt|mõm|mỏ)/i)
  const tail = find(/(tail|đuôi)/i)
  if (!head || !tail || Math.abs(head.x - tail.x) < 4) return null
  return head.x < tail.x ? 'left' : 'right'
}

const KIND_KEYWORDS: Array<[RegExp, CreatureBoneKind[]]> = [
  [/(tentacle|xúc tu|vòi)/i, ['tentacle']],
  [/(antenna|râu|cuống mắt|eye[-_ ]?stalk)/i, ['antenna']],
  [/(wing|cánh)/i, ['wing']],
  [/(fin|vây)/i, ['fin']],
  [/(tail|đuôi)/i, ['tail', 'fin']],
  [/(mane|bờm)/i, ['mane']],
  [/(jaw|beak|fang|pincer|hàm|mỏ|nanh|ngón càng)/i, ['jaw']],
  [/(claw|palp|càng|xúc biện)/i, ['arm']],
  [/(leg|foot|paw|hoof|chân|móng)/i, ['leg']],
  [/(ear|tai)/i, ['ear']],
  [/(neck|cổ)/i, ['neck']],
  [/(head|face|eye|snout|muzzle|đầu|mặt|mắt|mõm)/i, ['head']],
  [/(body|torso|chest|abdomen|thorax|belly|hip|pelvis|shell|thân|ngực|bụng|hông|mai|lưng)/i, ['core']]
]

const SOFT_KINDS: ReadonlySet<CreatureBoneKind> = new Set(['tail', 'tentacle', 'fin', 'wing', 'mane', 'antenna'])

function distanceToBone(px: number, py: number, b: LayerBone): number {
  const t = computeBoneTail(b)
  const dx = t.x - b.x
  const dy = t.y - b.y
  const len2 = dx * dx + dy * dy
  const k = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, ((px - b.x) * dx + (py - b.y) * dy) / len2))
  return Math.hypot(px - (b.x + k * dx), py - (b.y + k * dy))
}

function nearestBone(layer: AssembledLayerItem, bones: LayerBone[]): LayerBone {
  let best = bones[0]
  let bestDist = Infinity
  for (const b of bones) {
    const d = distanceToBone(layer.x, layer.y, b)
    if (d < bestDist) {
      bestDist = d
      best = b
    }
  }
  return best
}

const sideOfTag = (tag: string): 'l' | 'r' | null =>
  /(left|trái|[-_ ]l\b)/i.test(tag) ? 'l' : /(right|phải|[-_ ]r\b)/i.test(tag) ? 'r' : null

/**
 * Gắn mọi layer vào xương sinh vật: 1 ảnh đơn → uốn mềm theo xương gốc (cả khung xương biến dạng lưới);
 * nhiều mảnh → lọc theo từ khoá bộ phận + bên trái/phải, chọn đoạn xương gần tâm layer nhất.
 * Mảnh phủ trọn cả chi (ảnh lớn hơn ~1.6 lần đốt xương) gắn uốn mềm vào đốt gốc của chi đó.
 */
export function autoBindCreatureLayers(
  layers: AssembledLayerItem[],
  build: CreatureRigBuild,
  mode: CreatureBindMode = 'auto',
  sizes: Record<string, LayerPixelSize> = {}
): AssembledLayerItem[] {
  const bones = build.bones
  if (!bones.length) return layers
  const root = bones.find((b) => !b.parentId) ?? bones[0]
  const visible = layers.filter((l) => !l.hidden)
  if (visible.length <= 1) {
    return layers.map((l) => (l.locked || l.hidden ? l : { ...l, boneId: root.id, bindingMode: mode === 'rigid' ? 'rigid' : 'soft' }))
  }
  return layers.map((layer) => {
    if (layer.locked) return layer
    const tag = tagOf(layer)
    const kinds = KIND_KEYWORDS.find(([re]) => re.test(tag))?.[1]
    const side = sideOfTag(tag)
    let pool = kinds ? bones.filter((b) => kinds.includes(build.roles[b.id]?.kind)) : bones
    if (side && pool.some((b) => build.roles[b.id]?.side === side)) pool = pool.filter((b) => build.roles[b.id]?.side !== (side === 'l' ? 'r' : 'l'))
    let bone = nearestBone(layer, pool.length ? pool : bones)
    const role = build.roles[bone.id]
    const size = sizes[layer.id]
    const diag = size ? Math.hypot(size.w, size.h) * Math.max(0.05, layer.scale || 1) : 0
    const coversLimb = role && role.count > 1 && diag > bone.length * 1.6
    if (coversLimb) {
      bone = bones.find((b) => build.roles[b.id]?.group === role.group && build.roles[b.id]?.segment === 0) ?? bone
    }
    const soft = coversLimb || (role ? SOFT_KINDS.has(role.kind) : false)
    const bindingMode = mode === 'auto' ? (soft ? 'soft' : 'rigid') : mode
    return { ...layer, boneId: bone.id, bindingMode }
  })
}
