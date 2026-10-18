import type { AssembledLayerItem, LayerComposite, LayerPartGroup, LayerPartKind } from './types'

/**
 * Tự nhận diện bộ phận từ tên layer — áp dụng được cho NGƯỜI, ĐỘNG VẬT và sinh vật tuỳ ý:
 *  1. Từ khoá chi người (đầu / thân / tay / chân) + chi động vật (mõm, sừng, đuôi, cánh, vây, móng…).
 *  2. Không khớp từ khoá → gom các layer có CÙNG TIỀN TỐ tên (tail-1, tail-2 → nhóm "tail").
 *  3. Khe biến thể: hậu tố trạng thái (face-happy, eyes-cry…). Nhiều bộ phận rời cùng bộ biểu cảm trong một nhóm
 *     (eyes-cry + mouth-cry + brow-cry) được gộp thành MỘT bộ biến thể nhiều lớp thay vì giả định "face" là 1 ảnh.
 * Mọi nhóm/khe người dùng đã đặt đều được giữ nguyên; tên nhóm/bộ chỉ là gợi ý và đổi được trong bảng Bộ phận.
 */

const HEAD_RE = /(head|face|eye|mouth|nose|brow|hair|glass|(?<![a-z])ear|lip|cheek|bang|snout|muzzle|beak|whisker|horn|antler|mane|đầu|mặt|mắt|miệng|mũi|mày|tóc|kính|tai|môi|má|mõm|mỏ|râu|sừng|bờm)/i
const TORSO_RE = /(torso|body|chest|neck|belly|pelvis|hip|thân|ngực|bụng|hông|lưng|cổ(?!\s*(tay|chân)))/i
const ARM_RE = /(arm|hand|forearm|elbow|wrist|finger|tay|bàn tay|khuỷu)/i
const LEG_RE = /(thigh|shin|leg|foot|feet|knee|ankle|calf|shoe|paw|hoof|claw|đùi|ống chân|bàn chân|chân|gối|móng|vuốt)/i
const LEFT_RE = /(^|[\s_\-.])(left|l|trái)($|[\s_\-.])/i
const RIGHT_RE = /(^|[\s_\-.])(right|r|phải)($|[\s_\-.])/i

/** Chi đặc thù của động vật / sinh vật: [biểu thức, khoá nhóm, nhãn gợi ý, có phân trái/phải]. */
const CREATURE_PARTS: Array<[RegExp, string, string, boolean]> = [
  [/(tail|đuôi)/i, 'tail', 'Đuôi', false],
  [/(wing|cánh(?!\s*tay))/i, 'wing', 'Cánh', true],
  [/((?<![a-z])fin(?![a-z])|flipper|vây)/i, 'fin', 'Vây', true],
  [/(tentacle|xúc tu)/i, 'tentacle', 'Xúc tu', false]
]

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
  if (CREATURE_PARTS.some(([re]) => re.test(name))) return 'custom'
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

interface PartGuess { key: string; label: string; kind: LayerPartKind }

const sideLabel = (side: 'left' | 'right' | null) => (side === 'left' ? ' trái' : side === 'right' ? ' phải' : '')

/** Đoán nhóm theo từ khoá (người + động vật). */
function guessByKeyword(name: string): PartGuess | null {
  const side = inferSide(name)
  if (ARM_RE.test(name)) return { key: side ? `arm-${side}` : 'arm', label: `Tay${sideLabel(side)}`, kind: 'arm' }
  if (LEG_RE.test(name)) return { key: side ? `leg-${side}` : 'leg', label: `Chân${sideLabel(side)}`, kind: 'leg' }
  for (const [re, key, label, sided] of CREATURE_PARTS) {
    if (re.test(name)) return { key: sided && side ? `${key}-${side}` : key, label: `${label}${sided ? sideLabel(side) : ''}`, kind: 'custom' }
  }
  if (HEAD_RE.test(name)) return { key: 'head', label: 'Đầu', kind: 'head' }
  if (TORSO_RE.test(name)) return { key: 'torso', label: 'Thân', kind: 'torso' }
  return null
}

/** Tiền tố tên layer (bỏ đuôi file, số thứ tự, hậu tố biến thể/trái phải): 'tail_02' → 'tail'. */
export function namePrefix(name: string): string {
  const base = name.trim().toLowerCase().replace(/\.[a-z0-9]+$/, '')
  return base.split(/[\s_\-.]+/)[0].replace(/\d+$/, '')
}

function pickAnchor(members: AssembledLayerItem[], kind: LayerPartKind): string | undefined {
  const byName = (re: RegExp) => members.find((m) => re.test(m.name))?.id
  if (kind === 'head') return byName(/^(head|đầu)/i) ?? byName(/head|đầu/i) ?? members[0]?.id
  if (kind === 'torso') return byName(/torso|thân|body/i) ?? members[0]?.id
  return members.slice().sort((a, b) => a.y - b.y)[0]?.id
}

/** Gộp các khe rời (eyes / mouth / brow) cùng nhóm có ≥ 2 biến thể chung thành một bộ biến thể nhiều lớp. */
function mergeSharedSlots(layers: AssembledLayerItem[], fresh: Set<string>, groupName: (id?: string) => string): void {
  const byGroup = new Map<string, Map<string, Set<string>>>()
  for (const l of layers) {
    if (!fresh.has(l.id) || !l.slot || !l.variant) continue
    const g = l.partGroupId ?? ''
    const slots = byGroup.get(g) ?? new Map<string, Set<string>>()
    slots.set(l.slot, (slots.get(l.slot) ?? new Set()).add(l.variant))
    byGroup.set(g, slots)
  }
  for (const [g, slots] of byGroup) {
    const names = [...slots.keys()]
    const merged = names.filter((s) => names.some((o) => o !== s && [...slots.get(s)!].filter((v) => slots.get(o)!.has(v)).length >= 2))
    if (merged.length < 2) continue
    const target = `Biểu cảm ${groupName(g || undefined)}`.trim()
    for (const l of layers) if (fresh.has(l.id) && (l.partGroupId ?? '') === g && l.slot && merged.includes(l.slot)) l.slot = target
  }
}

function assignGroups(layers: AssembledLayerItem[], groups: Map<string, LayerPartGroup>): void {
  const unmatched: AssembledLayerItem[] = []
  for (const l of layers) {
    if (l.partGroupId) continue
    const guess = guessByKeyword(l.name)
    if (!guess) { unmatched.push(l); continue }
    const id = `part-${guess.key}`
    if (!groups.has(id)) groups.set(id, { id, name: guess.label, kind: guess.kind, locked: true })
    l.partGroupId = id
  }
  const byPrefix = new Map<string, AssembledLayerItem[]>()
  for (const l of unmatched) {
    const p = namePrefix(l.name)
    if (p.length >= 2) byPrefix.set(p, [...(byPrefix.get(p) ?? []), l])
  }
  for (const [prefix, members] of byPrefix) {
    if (members.length < 2) continue
    const id = `part-p-${prefix.replace(/[^\p{L}\d]+/gu, '-')}`
    if (!groups.has(id)) groups.set(id, { id, name: prefix.charAt(0).toUpperCase() + prefix.slice(1), kind: 'custom', locked: true })
    for (const m of members) m.partGroupId = id
  }
}

/**
 * Tự nhận diện nhóm bộ phận và khe biến thể từ tên layer. Giữ nguyên các gán nhóm/khe người dùng đã đặt.
 */
export function autoDetectParts(composite: LayerComposite): LayerComposite {
  const groups = new Map((composite.partGroups ?? []).map((g) => [g.id, { ...g }]))
  const fresh = new Set<string>()
  const layers = composite.layers.map((layer) => {
    const next = { ...layer }
    if (!next.slot) {
      const s = inferSlot(next.name)
      if (s) { Object.assign(next, { slot: s.slot, variant: s.variant }); fresh.add(next.id) }
    }
    return next
  })
  assignGroups(layers, groups)
  mergeSharedSlots(layers, fresh, (id) => (id ? groups.get(id)?.name ?? '' : ''))
  for (const g of groups.values()) {
    if (!g.anchorLayerId || !layers.some((l) => l.id === g.anchorLayerId)) {
      g.anchorLayerId = pickAnchor(layers.filter((l) => l.partGroupId === g.id), g.kind)
    }
  }
  return { ...composite, layers, partGroups: [...groups.values()].filter((g) => layers.some((l) => l.partGroupId === g.id)) }
}
