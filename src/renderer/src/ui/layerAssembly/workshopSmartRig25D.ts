import type { AnimationClip, LayerBone } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import {
  autoDetectLandmarksFromComposite,
  buildHumanoidBonesFromLandmarks,
  buildStarterPresetClipsForBones
} from './workshopMixamoAutoRig'
import {
  createBirdBones,
  createFishBones,
  createQuadrupedBones,
  generateBirdPeckWalk,
  generateBirdWingFlap,
  generateFishFloat,
  generateFishSwim,
  generateQuadrupedGraze,
  generateQuadrupedWagTail,
  generateQuadrupedWalk
} from './templates/creatureRigPresets'
import { createSimpleChainBones, generateSway } from './workshopRigPresets'

/**
 * Hệ thống Gắn Xương & Liên Kết Giải Phẫu Thông Minh 2.5D (Smart Auto-Rig & Auto-Bind 2.5D).
 * Lấy cảm hứng từ kiến trúc mã nguồn mở Spine-TS, DragonBones và Duik Angela Auto-Rigger:
 * - Tự động nhận diện kiểu cơ thể (Người 2.5D, Thú 4 chân, Chim/Cánh, Thủy sinh, Chuỗi thực vật/Đạo cụ).
 * - Nội suy vị trí khớp xoay (Pivot) từ tọa độ thực tế của các mảnh Layer trong cụm 2.5D + tự sinh xương phụ (tóc, áo choàng, đuôi, vũ khí).
 * - Gắn kết (Bind) tự động mọi Layer vào xương tương ứng bằng đối sánh ngữ nghĩa + khoảng cách hình học Điểm-Đoạn thẳng (Point-to-Segment).
 * - Chuẩn hóa thứ tự độ sâu Z (2.5D Z-Depth Planes) để khi xoay/di chuyển tạo hiệu ứng Parallax chuẩn xác.
 */

export type SmartRigArchetype = 'auto' | 'humanoid' | 'quadruped' | 'bird' | 'fish' | 'plant-chain'

export interface SmartRigArchetypeMeta {
  id: SmartRigArchetype
  label: string
  icon: string
  hint: string
}

export const SMART_RIG_ARCHETYPES: SmartRigArchetypeMeta[] = [
  { id: 'auto', label: 'Tự nhận diện', icon: '✨', hint: 'Tự phân tích tên và bố cục layer để chọn bộ khung xương phù hợp nhất' },
  { id: 'humanoid', label: 'Nhân vật 2.5D', icon: '🧍', hint: 'Khung xương người 15+ khớp kèm xương phụ cho tóc, áo choàng, vũ khí' },
  { id: 'quadruped', label: 'Thú 4 chân', icon: '🐕', hint: 'Khung xương động vật 4 chân (chó, mèo, hươu, trâu, ngựa) kèm cổ và đuôi' },
  { id: 'bird', label: 'Chim / Cánh', icon: '🦅', hint: 'Khung xương gia cầm / chim bay gồm thân, cổ, đầu, 2 cánh, đuôi và 2 chân' },
  { id: 'fish', label: 'Thủy sinh', icon: '🐟', hint: 'Khung xương cá / sinh vật bơi uốn lượn dọc thân và vây' },
  { id: 'plant-chain', label: 'Chuỗi uốn', icon: '🌿', hint: 'Chuỗi xương nối tiếp từ gốc lên ngọn cho cây cối, đuôi dài, dây leo, đạo cụ' }
]

/** Tự động nhận diện kiểu khung xương từ danh sách layer của cụm 2.5D */
export function detectCompositeRigArchetype(composite: LayerComposite): Exclude<SmartRigArchetype, 'auto'> {
  const joined = composite.layers.map((l) => `${l.id} ${l.name} ${l.slot ?? ''}`).join(' ').toLowerCase()
  if (/(fin|pectoral|dorsal|vây|mang cá|cá\b|fish|koi)/i.test(joined)) return 'fish'
  if (/(wing|beak|cánh|mỏ|mào|bird|chim|gà|hạc)/i.test(joined) && !/(arm|forearm|bắp tay|cẳng tay)/i.test(joined)) {
    return 'bird'
  }
  if (/(leg-fl|leg-fr|leg-bl|leg-br|snout|muzzle|hoof|paw|mõm|chân trước|chân sau|quadruped)/i.test(joined)) {
    return 'quadruped'
  }
  if (composite.category === 'nature' || /(foliage|trunk|branch|leaf|flower|tán lá|thân cây|cành|hoa)/i.test(joined)) {
    return 'plant-chain'
  }
  return 'humanoid'
}

function computeLayersBounds(layers: AssembledLayerItem[], width = 480, height = 480) {
  const pool = layers.filter((l) => !l.hidden)
  const list = pool.length > 0 ? pool : layers
  if (!list.length) return { cx: 0, cy: 0, spanW: width * 0.5, spanH: height * 0.65, scale: 1 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const l of list) {
    const s = l.scale || 1
    const hw = Math.max(35, width * 0.12 * s)
    const hh = Math.max(55, height * 0.22 * s)
    minX = Math.min(minX, l.x - hw)
    maxX = Math.max(maxX, l.x + hw)
    minY = Math.min(minY, l.y - hh)
    maxY = Math.max(maxY, l.y + hh)
  }
  const spanW = Math.max(80, maxX - minX)
  const spanH = Math.max(120, maxY - minY)
  return {
    cx: Math.round((minX + maxX) * 0.5),
    cy: Math.round((minY + maxY) * 0.5),
    spanW,
    spanH,
    scale: Math.max(0.45, Math.min(2.6, spanH / 320))
  }
}

function scaleBoneList(bones: LayerBone[], scale: number, cx: number, cy: number): LayerBone[] {
  return bones.map((b) => ({
    ...b,
    x: Math.round(b.x * scale + (b.parentId ? 0 : cx)),
    y: Math.round(b.y * scale + (b.parentId ? 0 : cy)),
    length: Math.max(10, Math.round(b.length * scale))
  }))
}

/** Bổ sung xương phụ (tóc sau, áo choàng, đuôi, vũ khí) nếu phát hiện layer tương ứng trong cụm Nhân vật 2.5D */
function appendHumanoidAccessoryBones(bones: LayerBone[], layers: AssembledLayerItem[]): LayerBone[] {
  const out = [...bones]
  const headBone = out.find((b) => b.id === 'bone-head')
  const torsoBone = out.find((b) => b.id === 'bone-torso')
  const pelvisBone = out.find((b) => b.id === 'bone-pelvis')
  const handRBone = out.find((b) => b.id === 'bone-hand-r') ?? out.find((b) => b.id === 'bone-forearm-r')

  const hairBack = layers.find((l) => /(hair[-_ ]?back|ponytail|braid|tóc sau|đuôi tóc|bím tóc)/i.test(`${l.id} ${l.name}`))
  if (hairBack && headBone && !out.some((b) => b.id === 'bone-hair-back')) {
    out.push({
      id: 'bone-hair-back',
      name: 'Tóc sau / Đuôi tóc',
      parentId: headBone.id,
      x: Math.round(hairBack.x),
      y: Math.round(headBone.y - headBone.length * 0.35),
      length: Math.max(45, Math.round(headBone.length * 0.95)),
      angle: 90
    })
  }

  const cape = layers.find((l) => /(cape|cloak|mantle|scarf|áo choàng|khăn choàng|tà áo)/i.test(`${l.id} ${l.name}`))
  if (cape && torsoBone && !out.some((b) => b.id === 'bone-cape')) {
    out.push({
      id: 'bone-cape',
      name: 'Áo choàng / Tà áo',
      parentId: torsoBone.id,
      x: Math.round(cape.x),
      y: Math.round(torsoBone.y - torsoBone.length * 0.6),
      length: Math.max(65, Math.round(torsoBone.length * 1.25)),
      angle: 90
    })
  }

  const tail = layers.find((l) => /(tail|đuôi)/i.test(`${l.id} ${l.name}`) && !/(ponytail|đuôi tóc)/i.test(`${l.id} ${l.name}`))
  if (tail && pelvisBone && !out.some((b) => b.id === 'bone-tail')) {
    out.push({
      id: 'bone-tail',
      name: 'Đuôi nhân vật',
      parentId: pelvisBone.id,
      x: Math.round(tail.x),
      y: Math.round(pelvisBone.y),
      length: Math.max(50, Math.round(pelvisBone.length * 1.1)),
      angle: 45
    })
  }

  const weapon = layers.find((l) => /(weapon|sword|blade|staff|wand|bow|gun|cane|kiếm|vũ khí|trượng|cung|gậy)/i.test(`${l.id} ${l.name}`))
  if (weapon && handRBone && !out.some((b) => b.id === 'bone-weapon')) {
    out.push({
      id: 'bone-weapon',
      name: 'Vũ khí / Đạo cụ tay',
      parentId: handRBone.id,
      x: Math.round(weapon.x),
      y: Math.round(weapon.y),
      length: Math.max(50, Math.round(handRBone.length * 1.8)),
      angle: -45
    })
  }

  return out
}

/** Sinh bộ xương chuẩn giải phẫu 2.5D khớp với tọa độ thực tế của các Layer trong Composite */
export function buildAnatomicalBonesFromLayers(
  composite: LayerComposite,
  archetype: SmartRigArchetype = 'auto'
): { resolvedArchetype: Exclude<SmartRigArchetype, 'auto'>; bones: LayerBone[]; clips: AnimationClip[] } {
  const resolved = archetype === 'auto' ? detectCompositeRigArchetype(composite) : archetype
  const bounds = computeLayersBounds(composite.layers, composite.width, composite.height)

  if (resolved === 'humanoid') {
    const lm = autoDetectLandmarksFromComposite(composite)
    const baseBones = buildHumanoidBonesFromLandmarks(lm)
    const bones = appendHumanoidAccessoryBones(baseBones, composite.layers)
    const clips = buildStarterPresetClipsForBones(bones, 'front')
    return { resolvedArchetype: resolved, bones, clips }
  }

  if (resolved === 'quadruped') {
    const bones = scaleBoneList(createQuadrupedBones(), bounds.scale, bounds.cx, bounds.cy)
    const clips: AnimationClip[] = [
      { id: 'clip-quad-walk', name: 'Bước đi 4 chân (Walk)', duration: 1.4, loop: true, tracks: generateQuadrupedWalk(bones, 1.4) },
      { id: 'clip-quad-wag', name: 'Vẫy đuôi & Thở (Idle Wag)', duration: 1.0, loop: true, tracks: generateQuadrupedWagTail(bones, 1.0) },
      { id: 'clip-quad-graze', name: 'Cúi đầu gặm cỏ (Graze)', duration: 2.4, loop: true, tracks: generateQuadrupedGraze(bones, 2.4) }
    ]
    return { resolvedArchetype: resolved, bones, clips }
  }

  if (resolved === 'bird') {
    const bones = scaleBoneList(createBirdBones(), bounds.scale, bounds.cx, bounds.cy)
    const clips: AnimationClip[] = [
      { id: 'clip-bird-flap', name: 'Vỗ cánh bay (Wing Flap)', duration: 0.8, loop: true, tracks: generateBirdWingFlap(bones, 0.8) },
      { id: 'clip-bird-peck', name: 'Bước đi & Mổ thóc (Peck Walk)', duration: 1.4, loop: true, tracks: generateBirdPeckWalk(bones, 1.4) }
    ]
    return { resolvedArchetype: resolved, bones, clips }
  }

  if (resolved === 'fish') {
    const bones = scaleBoneList(createFishBones(), bounds.scale, bounds.cx, bounds.cy)
    const clips: AnimationClip[] = [
      { id: 'clip-fish-swim', name: 'Bơi uốn lượn (Swim)', duration: 1.6, loop: true, tracks: generateFishSwim(bones, 1.6) },
      { id: 'clip-fish-float', name: 'Lơ lửng vẫy vây (Float)', duration: 2.4, loop: true, tracks: generateFishFloat(bones, 2.4) }
    ]
    return { resolvedArchetype: resolved, bones, clips }
  }

  // 'plant-chain'
  const bones = scaleBoneList(createSimpleChainBones(), bounds.scale, bounds.cx, bounds.cy)
  const clips: AnimationClip[] = [
    { id: 'clip-chain-sway', name: 'Đung đưa trước gió (Sway)', duration: 2.0, loop: true, tracks: generateSway(bones, 2.0) }
  ]
  return { resolvedArchetype: resolved, bones, clips }
}

/** Khoảng cách từ điểm (px, py) đến đoạn thẳng xương (x1, y1) -> (x2, y2) */
function pointToBoneSegmentDistance(px: number, py: number, bone: LayerBone): number {
  const rad = (bone.angle * Math.PI) / 180
  const x2 = bone.x + Math.cos(rad) * bone.length
  const y2 = bone.y + Math.sin(rad) * bone.length
  const dx = x2 - bone.x
  const dy = y2 - bone.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-6) return Math.hypot(px - bone.x, py - bone.y)
  const t = Math.max(0, Math.min(1, ((px - bone.x) * dx + (py - bone.y) * dy) / lenSq))
  const projX = bone.x + t * dx
  const projY = bone.y + t * dy
  return Math.hypot(px - projX, py - projY)
}

/** Tìm xương khớp theo ngữ nghĩa hoặc khoảng cách hình học gần nhất */
export function matchBestBoneForLayer25D(
  layer: AssembledLayerItem,
  bones: LayerBone[],
  totalVisibleLayers: number,
  bindModePref: 'auto' | 'rigid' | 'soft' = 'auto'
): { boneId: string; bindingMode: 'rigid' | 'soft' } | null {
  if (!bones.length) return null
  const byId = new Map(bones.map((b) => [b.id, b]))
  const pick = (...ids: string[]) => ids.find((id) => byId.has(id))

  // Nếu cả cụm chỉ có 1 layer duy nhất (ảnh đơn) → gắn uốn mềm vào xương gốc
  if (totalVisibleLayers === 1) {
    const root = bones.find((b) => !b.parentId) ?? bones[0]
    return { boneId: root.id, bindingMode: bindModePref === 'rigid' ? 'rigid' : 'soft' }
  }

  const tag = `${layer.id} ${layer.name} ${layer.slot ?? ''}`.toLowerCase()
  const isSoftPart = /(hair|ponytail|braid|cape|cloak|scarf|skirt|tail|wing|fin|foliage|branch|leaf|tóc|áo choàng|khăn|váy|đuôi|cánh|vây|tán lá|cành)/i.test(tag)
  const resolveMode = (defaultMode: 'rigid' | 'soft'): 'rigid' | 'soft' => {
    if (bindModePref !== 'auto') return bindModePref
    return isSoftPart ? 'soft' : defaultMode
  }

  // Ưu tiên xương phụ chuyên biệt
  if (/(hair[-_ ]?back|ponytail|braid|tóc sau|đuôi tóc)/i.test(tag) && byId.has('bone-hair-back')) {
    return { boneId: 'bone-hair-back', bindingMode: resolveMode('soft') }
  }
  if (/(cape|cloak|mantle|scarf|áo choàng|khăn choàng|tà áo)/i.test(tag) && byId.has('bone-cape')) {
    return { boneId: 'bone-cape', bindingMode: resolveMode('soft') }
  }
  if (/(weapon|sword|blade|staff|wand|cane|kiếm|vũ khí|trượng|gậy)/i.test(tag) && byId.has('bone-weapon')) {
    return { boneId: 'bone-weapon', bindingMode: resolveMode('rigid') }
  }
  if (/(tail|đuôi)/i.test(tag)) {
    const tailBone = pick('bone-tail', 'bone-bird-tail', 'bone-fish-fin-tail', 'bone-fish-tail-base', 'bone-chain-tip')
    if (tailBone) return { boneId: tailBone, bindingMode: resolveMode('soft') }
  }

  // Khớp theo bộ phận người / thú / chim / cá
  if (/(head|face|eye|mouth|brow|nose|glass|hat|helmet|ear|bang|snout|muzzle|beak|crown|đầu|mặt|mắt|miệng|mày|mũi|kính|mũ|tai|tóc|mõm|mỏ)/i.test(tag)) {
    const b = pick('bone-head', 'bone-bird-head', 'bone-fish-head', 'bone-chain-tip')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(hand|palm|wrist|finger|bàn tay|cổ tay|ngón tay)/i.test(tag)) {
    const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
    const b = isRight ? pick('bone-hand-r', 'bone-forearm-r', 'bone-arm-r') : pick('bone-hand-l', 'bone-forearm-l', 'bone-arm-l')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(forearm|lowerarm|cẳng tay)/i.test(tag)) {
    const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
    const b = isRight ? pick('bone-forearm-r', 'bone-arm-r') : pick('bone-forearm-l', 'bone-arm-l')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(arm|sleeve|shoulder|bắp tay|tay áo|vai)/i.test(tag)) {
    const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
    const b = isRight ? pick('bone-arm-r') : pick('bone-arm-l')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(wing|cánh)/i.test(tag)) {
    const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
    const b = isRight ? pick('bone-bird-wing-r', 'bone-arm-r') : pick('bone-bird-wing-l', 'bone-arm-l')
    if (b) return { boneId: b, bindingMode: resolveMode('soft') }
  }
  if (/(foot|feet|shoe|sneaker|boot|ankle|toe|heel|bàn chân|giày|cổ chân|mũi chân)/i.test(tag)) {
    const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
    const b = isRight ? pick('bone-foot-r', 'bone-shin-r') : pick('bone-foot-l', 'bone-shin-l')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(shin|calf|lowerleg|cẳng chân|ống quần|ống chân)/i.test(tag)) {
    const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
    const b = isRight
      ? pick('bone-shin-r', 'bone-leg-fr-shin', 'bone-leg-br-shin', 'bone-bird-shin-r')
      : pick('bone-shin-l', 'bone-leg-fl-shin', 'bone-leg-bl-shin', 'bone-bird-shin-l')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(thigh|upperleg|leg|đùi|chân)/i.test(tag)) {
    const isRight = /(right|[-_ ]r\b|phải)/i.test(tag)
    const b = isRight
      ? pick('bone-thigh-r', 'bone-leg-fr-thigh', 'bone-leg-br-thigh', 'bone-bird-thigh-r')
      : pick('bone-thigh-l', 'bone-leg-fl-thigh', 'bone-leg-bl-thigh', 'bone-bird-thigh-l')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(neck|cổ)/i.test(tag)) {
    const b = pick('bone-neck', 'bone-bird-neck', 'bone-torso')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(torso|chest|body|shirt|vest|jacket|thân|ngực|áo)/i.test(tag)) {
    const b = pick('bone-torso', 'bone-bird-body', 'bone-fish-mid', 'bone-chain-mid')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }
  if (/(pelvis|hip|waist|belt|skirt|hông|eo|thắt lưng|váy)/i.test(tag)) {
    const b = pick('bone-pelvis', 'bone-bird-body', 'bone-chain-root')
    if (b) return { boneId: b, bindingMode: resolveMode('rigid') }
  }

  // Fallback: Tìm đoạn thẳng xương gần tâm (layer.x, layer.y) nhất
  let bestBone = bones[0]
  let bestDist = Infinity
  for (const b of bones) {
    const d = pointToBoneSegmentDistance(layer.x, layer.y, b)
    if (d < bestDist) {
      bestDist = d
      bestBone = b
    }
  }
  return { boneId: bestBone.id, bindingMode: resolveMode(totalVisibleLayers <= 3 ? 'soft' : 'rigid') }
}

/** Tự động gắn toàn bộ Layer trong Composite vào xương phù hợp nhất */
export function smartAutoBindCompositeLayers(
  layers: AssembledLayerItem[],
  bones: LayerBone[],
  bindModePref: 'auto' | 'rigid' | 'soft' = 'auto'
): AssembledLayerItem[] {
  if (!bones.length) return layers
  const totalVisible = layers.filter((l) => !l.hidden).length || layers.length
  return layers.map((layer) => {
    if (layer.locked) return layer
    const matched = matchBestBoneForLayer25D(layer, bones, totalVisible, bindModePref)
    if (!matched) return layer
    return {
      ...layer,
      boneId: matched.boneId,
      bindingMode: matched.bindingMode
    }
  })
}

/**
 * Chuẩn hóa thứ tự độ sâu Z 2.5D (Z-Depth Planes) theo giải phẫu nhân vật / sinh vật:
 * - Z âm (gần camera hơn): kính (-42), ngũ quan/mặt (-30), tóc mái (-24), đầu (-20), vũ khí/bàn tay trước (-14).
 * - Z = 0: thân / ngực (torso).
 * - Z dương (xa camera hơn): đùi (20), cẳng chân & giày (25), bắp tay (35), cẳng tay (40), tóc sau / áo choàng / đuôi (52).
 */
export function autoSortLayersZDepth25D(layers: AssembledLayerItem[]): AssembledLayerItem[] {
  return layers.map((layer, idx) => {
    if (layer.locked) return layer
    const tag = `${layer.id} ${layer.name} ${layer.slot ?? ''}`.toLowerCase()
    let z = layer.z
    if (/(glass|visor|mask|kính|mặt nạ)/i.test(tag)) z = -42
    else if (/(weapon|sword|blade|wand|kiếm|vũ khí)/i.test(tag)) z = -36
    else if (/(face|eye|mouth|brow|lip|biểu cảm|mặt|mắt|miệng|mày)/i.test(tag)) z = layer.hidden ? -32 : -30
    else if (/(bang|hair[-_ ]?front|tóc mái)/i.test(tag)) z = -25
    else if (/(head|hat|helmet|crown|đầu|mũ|nón)/i.test(tag)) z = -20
    else if (/(torso|chest|body|shirt|vest|thân|ngực|áo)/i.test(tag)) z = 0
    else if (/(pelvis|hip|belt|hông|thắt lưng)/i.test(tag)) z = 8
    else if (/(thigh|upperleg|đùi)/i.test(tag)) z = 20
    else if (/(shin|calf|foot|shoe|sneaker|cẳng chân|ống quần|bàn chân|giày)/i.test(tag)) z = 25
    else if (/(arm|sleeve|bắp tay|tay áo)/i.test(tag) && !/(forearm|cẳng tay)/i.test(tag)) z = 35
    else if (/(forearm|hand|cẳng tay|bàn tay)/i.test(tag)) z = 40
    else if (/(hair[-_ ]?back|ponytail|cape|cloak|tail|wing|tóc sau|áo choàng|đuôi|cánh)/i.test(tag)) z = 52
    else {
      // Giữ độ sâu hợp lý theo chỉ số nếu không khớp từ khóa
      z = Number.isFinite(layer.z) ? layer.z : idx * 4
    }
    return { ...layer, z }
  })
}
