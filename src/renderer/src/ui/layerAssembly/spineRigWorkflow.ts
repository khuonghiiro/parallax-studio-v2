import type { LayerBone, LayerRig } from '@shared/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { computeBoneTail, inferFallbackBoneForStackedLayer, normalizeAnatomicalRootHierarchy } from './mohoRigHelpers'
import { analyzeCutoutParts, extractLayerDimensions } from './workshopCutoutRig'

/**
 * Hệ thống Tạo Xương & Gắn Slot/Mesh Chuẩn Spine 2D (Esoteric Software Spine Workflow):
 * 1. Nhận diện vai trò giải phẫu tự động từ hình học + cấu trúc cây (`inferHumanoidBoneRoles`)
 *    kể cả khi xương được vẽ tay với tên mặc định `"Xương 1" .. "Xương 14"`.
 * 2. Khi vẽ xương bằng công cụ `Create (A)` trực tiếp trên sân khấu 2D:
 *    - Tự động nhận diện mảnh Layer (Slot) dưới nét vẽ (`findCutoutLayerAtStroke`).
 *    - Tự động nối vào xương Thân Gốc (`Root / Torso Hub`) nếu vẽ sang bộ phận mới,
 *      hoặc nối chuỗi đốt con (`Upper Arm ➔ Forearm ➔ Hand`) và tự bật Mesh uốn mềm đa đốt (`extraBoneIds`)
 *      nếu vẽ tiếp trên cùng bộ phận (`resolveSpineParentForStroke`).
 * 3. Đồng bộ 1-Click chuẩn Spine 2D (`syncSpineStyleRigAndSlots`):
 *    - Chuẩn hoá xương gốc, tự gắn 100% Slot/Mesh cho mọi mảnh cắt rời & phụ kiện, đặt tên giải phẫu rõ ràng.
 */

export interface HumanoidBoneRoleMap {
  pelvis?: string
  torso?: string
  head?: string
  armL?: string
  forearmL?: string
  handL?: string
  armR?: string
  forearmR?: string
  handR?: string
  thighL?: string
  shinL?: string
  footL?: string
  thighR?: string
  shinR?: string
  footR?: string
}

function findKeywordBoneId(bones: ReadonlyArray<LayerBone>, keywords: string[]): string | undefined {
  for (const b of bones) {
    const idLow = b.id.toLowerCase().replaceAll('_', '-')
    const nameLow = (b.name || '').toLocaleLowerCase('vi')
    for (const kw of keywords) {
      if (idLow === kw || idLow.endsWith(`-${kw}`) || nameLow.includes(kw)) {
        return b.id
      }
    }
  }
  return undefined
}

function followPrimaryLimbChain(start: LayerBone, childrenByParent: Map<string, LayerBone[]>): LayerBone[] {
  const chain: LayerBone[] = [start]
  const visited = new Set<string>([start.id])
  let cur = start
  while (chain.length < 4) {
    const kids = (childrenByParent.get(cur.id) ?? []).filter((k) => !visited.has(k.id))
    if (kids.length === 0) break
    const tail = computeBoneTail(cur)
    kids.sort(
      (a, b) => Math.hypot(a.x - tail.x, a.y - tail.y) - Math.hypot(b.x - tail.x, b.y - tail.y)
    )
    const next = kids[0]
    visited.add(next.id)
    chain.push(next)
    cur = next
  }
  return chain
}

/**
 * Suy diễn bản đồ vai trò giải phẫu Humanoid (15 khớp) kết hợp từ khóa và hình học + cây phân cấp:
 * Giúp cả bộ xương vẽ tay (`"Xương 1" .. "Xương 14"`) hoạt động hoàn hảo với mọi động tác mẫu (Walk, Run, Idle, Wave...)
 * và tự động định danh từng đốt xương chuẩn Spine 2D.
 */
export function inferHumanoidBoneRoles(rawBones: ReadonlyArray<LayerBone>): HumanoidBoneRoleMap {
  if (!rawBones.length) return {}
  const bones = normalizeAnatomicalRootHierarchy([...rawBones])
  const roles: HumanoidBoneRoleMap = {
    pelvis: findKeywordBoneId(bones, ['pelvis', 'hông', 'root']),
    torso: findKeywordBoneId(bones, ['torso', 'thân', 'ngực']),
    head: findKeywordBoneId(bones, ['head', 'đầu']),
    armL: findKeywordBoneId(bones, ['arm-l', 'bắp tay trái', 'upperarm-l']),
    forearmL: findKeywordBoneId(bones, ['forearm-l', 'cẳng tay trái', 'lowerarm-l']),
    handL: findKeywordBoneId(bones, ['hand-l', 'bàn tay trái']),
    armR: findKeywordBoneId(bones, ['arm-r', 'bắp tay phải', 'upperarm-r']),
    forearmR: findKeywordBoneId(bones, ['forearm-r', 'cẳng tay phải', 'lowerarm-r']),
    handR: findKeywordBoneId(bones, ['hand-r', 'bàn tay phải']),
    thighL: findKeywordBoneId(bones, ['thigh-l', 'đùi trái']),
    shinL: findKeywordBoneId(bones, ['shin-l', 'cẳng chân trái']),
    footL: findKeywordBoneId(bones, ['foot-l', 'bàn chân trái']),
    thighR: findKeywordBoneId(bones, ['thigh-r', 'đùi phải']),
    shinR: findKeywordBoneId(bones, ['shin-r', 'cẳng chân phải']),
    footR: findKeywordBoneId(bones, ['foot-r', 'bàn chân phải'])
  }

  // Nếu đã khớp đầy đủ qua tên chuẩn thì trả về ngay
  if (roles.torso && roles.head && (roles.armL || roles.armR) && (roles.thighL || roles.thighR)) {
    if (!roles.pelvis) roles.pelvis = roles.torso
    return roles
  }

  if (bones.length < 4) return roles

  const childrenByParent = new Map<string, LayerBone[]>()
  for (const b of bones) {
    if (!b.parentId) continue
    const list = childrenByParent.get(b.parentId) ?? []
    list.push(b)
    childrenByParent.set(b.parentId, list)
  }

  // 1. Tìm xương Thân chính (Torso / Hub): ưu tiên xương gần trục giữa có nhiều nhánh con nhất (VD: Xương 2 có 5 nhánh con: Đầu, 2 Tay, 2 Chân)
  let torsoBone = roles.torso ? bones.find((b) => b.id === roles.torso) : undefined
  if (!torsoBone) {
    const candidates = [...bones].sort((a, b) => {
      const kidsA = (childrenByParent.get(a.id) ?? []).length
      const kidsB = (childrenByParent.get(b.id) ?? []).length
      if (kidsB !== kidsA) return kidsB - kidsA
      if (Boolean(!a.parentId) !== Boolean(!b.parentId)) return !a.parentId ? -1 : 1
      return b.length - a.length
    })
    torsoBone = candidates[0]
    if (torsoBone) roles.torso = torsoBone.id
  }
  if (!torsoBone) return roles
  if (!roles.pelvis) roles.pelvis = torsoBone.id

  const torsoTail = computeBoneTail(torsoBone)
  const torsoTopY = Math.min(torsoBone.y, torsoTail.y)
  const torsoBottomY = Math.max(torsoBone.y, torsoTail.y)
  const torsoMidY = (torsoTopY + torsoBottomY) * 0.5
  const torsoCenterX = (torsoBone.x + torsoTail.x) * 0.5

  // 2. Tìm xương Đầu (Head): xương gần trục giữa ở phía trên, hướng lên trên hoặc nằm cao hơn phần thân trên
  if (!roles.head) {
    const headCandidates = bones.filter((b) => {
      if (b.id === torsoBone!.id) return false
      const bTail = computeBoneTail(b)
      const nearCenter = Math.abs(b.x - torsoCenterX) <= Math.max(42, torsoBone!.length * 0.25)
      const pointsUp = b.angle <= -20 && b.angle >= -160
      const highEnough = Math.min(b.y, bTail.y) <= torsoTopY + Math.max(30, torsoBone!.length * 0.2)
      return nearCenter && (pointsUp || highEnough) && b.y <= torsoMidY
    })
    headCandidates.sort((a, b) => Math.min(a.y, computeBoneTail(a).y) - Math.min(b.y, computeBoneTail(b).y))
    if (headCandidates[0]) {
      roles.head = headCandidates[0].id
    }
  }

  // 3. Phân loại các chuỗi chi (Tay trái, Tay phải, Chân trái, Chân phải) xuất phát từ Thân/Hông
  const hubIds = new Set<string>([torsoBone.id, ...(roles.pelvis ? [roles.pelvis] : [])])
  const limbRoots = bones.filter(
    (b) => b.id !== torsoBone!.id && b.id !== roles.head && b.parentId && hubIds.has(b.parentId)
  )

  const upperLeft: LayerBone[] = []
  const upperRight: LayerBone[] = []
  const lowerLeft: LayerBone[] = []
  const lowerRight: LayerBone[] = []

  for (const root of limbRoots) {
    const isLeft = root.x < torsoCenterX
    const isUpper = root.y < torsoMidY
    if (isUpper) {
      if (isLeft) upperLeft.push(root)
      else upperRight.push(root)
    } else {
      if (isLeft) lowerLeft.push(root)
      else lowerRight.push(root)
    }
  }

  // Nếu mọi chi đều có y gần nhau, phân tách Tay (ngoài cùng / cao hơn) và Chân (trong / thấp hơn)
  const assignChain = (
    roots: LayerBone[],
    k0: keyof HumanoidBoneRoleMap,
    k1: keyof HumanoidBoneRoleMap,
    k2: keyof HumanoidBoneRoleMap
  ) => {
    if (roots.length === 0) return
    roots.sort((a, b) => a.y - b.y)
    const chain = followPrimaryLimbChain(roots[0], childrenByParent)
    if (!roles[k0] && chain[0]) roles[k0] = chain[0].id
    if (!roles[k1] && chain[1]) roles[k1] = chain[1].id
    if (!roles[k2] && chain[2]) roles[k2] = chain[2].id
  }

  assignChain(upperLeft, 'armL', 'forearmL', 'handL')
  assignChain(upperRight, 'armR', 'forearmR', 'handR')
  assignChain(lowerLeft, 'thighL', 'shinL', 'footL')
  assignChain(lowerRight, 'thighR', 'shinR', 'footR')

  return roles
}

/** Lấy nhãn vai trò chuẩn Spine 2D cho một xương dựa trên bản đồ giải phẫu suy diễn. */
export function getSpineAnatomicalBoneLabel(
  boneId: string,
  roles: HumanoidBoneRoleMap
): string | null {
  if (roles.torso === boneId && roles.pelvis === boneId) return 'Xương Thân (Gốc)'
  if (roles.pelvis === boneId) return 'Xương Hông (Gốc)'
  if (roles.torso === boneId) return 'Xương Thân'
  if (roles.head === boneId) return 'Xương Đầu'
  if (roles.armL === boneId) return 'Bắp tay trái'
  if (roles.forearmL === boneId) return 'Cẳng tay trái'
  if (roles.handL === boneId) return 'Bàn tay trái'
  if (roles.armR === boneId) return 'Bắp tay phải'
  if (roles.forearmR === boneId) return 'Cẳng tay phải'
  if (roles.handR === boneId) return 'Bàn tay phải'
  if (roles.thighL === boneId) return 'Đùi trái'
  if (roles.shinL === boneId) return 'Cẳng chân trái'
  if (roles.footL === boneId) return 'Bàn chân trái'
  if (roles.thighR === boneId) return 'Đùi phải'
  if (roles.shinR === boneId) return 'Cẳng chân phải'
  if (roles.footR === boneId) return 'Bàn chân phải'
  return null
}

function pointToLayerBoxScore(
  px: number,
  py: number,
  layer: AssembledLayerItem,
  pad = 10
): { inside: boolean; normDist: number; area: number } {
  const { w, h } = extractLayerDimensions(layer)
  const hw = Math.max(16, w * 0.5) + pad
  const hh = Math.max(16, h * 0.5) + pad
  const dx = Math.abs(px - layer.x)
  const dy = Math.abs(py - layer.y)
  const inside = dx <= hw && dy <= hh
  const normDist = Math.hypot(dx / hw, dy / hh)
  return { inside, normDist, area: w * h }
}

/**
 * Công cụ `Create` chuẩn Spine 2D: Khi người dùng kéo vẽ một xương từ `start` đến `end` trên sân khấu 2D,
 * tự động dò tìm mảnh Layer (Slot/Attachment) nằm dưới nét vẽ để tự gắn xương vào mảnh đó.
 */
export function findCutoutLayerAtStroke(
  layers: ReadonlyArray<AssembledLayerItem>,
  start: { x: number; y: number },
  end: { x: number; y: number },
  parentBone?: LayerBone | null
): AssembledLayerItem | null {
  const visible = layers.filter((l) => !l.hidden && !l.locked)
  if (visible.length === 0) return null
  if (visible.length === 1) return visible[0]

  const mid = { x: (start.x + end.x) * 0.5, y: (start.y + end.y) * 0.5 }

  // 1. Nếu xương mới nối từ ngọn của `parentBone` vốn đã gắn với một Layer chi (VD: vẽ Cẳng tay nối từ Bắp tay trên cùng Mảnh Cánh tay),
  // và trung điểm nét vẽ vẫn nằm trong vùng bao của Layer đó -> tiếp tục gắn làm đốt con (Mesh uốn mềm) của Layer đó!
  if (parentBone) {
    const parentLayer = visible.find(
      (l) => l.boneId === parentBone.id || l.extraBoneIds?.includes(parentBone.id)
    )
    if (parentLayer) {
      const parentBox = pointToLayerBoxScore(mid.x, mid.y, parentLayer, 20)
      if (parentBox.inside) {
        // Kiểm tra xem có mảnh con nhỏ hơn chưa gắn xương nằm tepat tại trung điểm không (VD: bàn tay tách rời)
        const smallerUnbound = visible.find((other) => {
          if (other.id === parentLayer.id || other.boneId) return false
          const sc = pointToLayerBoxScore(mid.x, mid.y, other, 4)
          return sc.inside && sc.area < parentBox.area * 0.55
        })
        if (!smallerUnbound) return parentLayer
      }
    }
  }

  // 2. Dò tất cả các mảnh Layer chứa điểm bắt đầu và trung điểm của nét vẽ xương
  const parts = analyzeCutoutParts([...visible])
  const roleById = new Map(parts.map((p) => [p.layer.id, p.role]))

  const candidates = visible
    .map((layer) => {
      const sScore = pointToLayerBoxScore(start.x, start.y, layer, 12)
      const mScore = pointToLayerBoxScore(mid.x, mid.y, layer, 12)
      const eScore = pointToLayerBoxScore(end.x, end.y, layer, 12)
      const hits = (sScore.inside ? 1 : 0) + (mScore.inside ? 2 : 0) + (eScore.inside ? 1 : 0)
      const role = roleById.get(layer.id)
      // Ưu tiên mảnh bộ phận cụ thể (đầu, tay, chân) hơn mảnh thân nền rộng khi nét vẽ nằm trên chi/đầu
      const isSpecificLimbOrHead =
        role === 'head' ||
        role === 'arm_left' ||
        role === 'arm_right' ||
        role === 'leg_left' ||
        role === 'leg_right'
      const unboundBonus = !layer.boneId ? -0.22 : 0
      const specificBonus = isSpecificLimbOrHead ? -0.18 : 0
      const combinedScore = mScore.normDist * 0.65 + sScore.normDist * 0.35 + unboundBonus + specificBonus
      return { layer, hits, mScore, combinedScore }
    })
    .filter((c) => c.hits >= 2 || c.mScore.inside)

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.combinedScore - b.combinedScore)
  return candidates[0].layer
}

/**
 * Tự động chọn xương Cha chuẩn Spine 2D khi người dùng vẽ xương trên một bộ phận mới:
 * - Nếu vẽ nối tiếp trên một mảnh Layer đã có xương (VD: vẽ đốt 2, đốt 3 trên cùng cánh tay): tự nối vào đốt cuối cùng của mảnh đó.
 * - Nếu chuyển sang vẽ trên một mảnh Layer bộ phận khác (VD: đang chọn Bàn tay trái mà chuyển sang vẽ Cánh tay phải hoặc Chân trái):
 *   tự động nối vào xương Thân Gốc (`Root / Torso Hub`) thay vì nối nhầm Tay phải vào Bàn tay trái!
 */
export function resolveSpineParentForStroke(
  bones: ReadonlyArray<LayerBone>,
  layers: ReadonlyArray<AssembledLayerItem>,
  start: { x: number; y: number },
  end: { x: number; y: number },
  focusedBone: LayerBone | null
): {
  parentBone: LayerBone | null
  parentJoint?: 'head' | 'tail'
  hitLayer: AssembledLayerItem | null
} {
  const hitLayer = findCutoutLayerAtStroke(layers, start, end, focusedBone)
  if (!bones.length) {
    return { parentBone: null, hitLayer }
  }

  const normBones = normalizeAnatomicalRootHierarchy([...bones], [...layers])
  const byId = new Map(normBones.map((b) => [b.id, b]))

  // 1. Nếu mảnh Layer dưới nét vẽ ĐÃ có xương chủ quản -> nối tiếp thành chuỗi đốt con của mảnh đó
  if (hitLayer?.boneId && byId.has(hitLayer.boneId)) {
    const chainIds = [hitLayer.boneId, ...(hitLayer.extraBoneIds ?? [])].filter((id) => byId.has(id))
    let bestParent = byId.get(chainIds[chainIds.length - 1]) ?? byId.get(hitLayer.boneId)!
    let bestDist = Infinity
    for (const id of chainIds) {
      const candidate = byId.get(id)!
      const tail = computeBoneTail(candidate)
      const d = Math.hypot(start.x - tail.x, start.y - tail.y)
      if (d < bestDist) {
        bestDist = d
        bestParent = candidate
      }
    }
    return { parentBone: bestParent, parentJoint: 'tail', hitLayer }
  }

  // 2. Nếu vẽ trên một mảnh Layer MỚI chưa có xương (hoặc vẽ ngoài khớp):
  // Tìm xương Thân chính (Root Hub) để gắn bộ phận mới vào Thân giống Spine 2D
  const roles = inferHumanoidBoneRoles(normBones)
  const torsoLayer = analyzeCutoutParts([...layers]).find((p) => p.role === 'torso')?.layer
  const hubBone =
    (torsoLayer?.boneId ? byId.get(torsoLayer.boneId) : undefined) ??
    (roles.torso ? byId.get(roles.torso) : undefined) ??
    normBones.find((b) => !b.parentId) ??
    focusedBone

  if (!hubBone) {
    return { parentBone: focusedBone, hitLayer }
  }

  // Nếu người dùng đang chọn một xương mút xa (VD: Bàn tay trái) nhưng đặt bút vẽ ở bộ phận khác cách xa > 52px,
  // tự động chuyển cha về xương Thân chính (Hub)
  if (focusedBone && focusedBone.id !== hubBone.id) {
    const fTail = computeBoneTail(focusedBone)
    const distToFocused = Math.min(
      Math.hypot(start.x - focusedBone.x, start.y - focusedBone.y),
      Math.hypot(start.x - fTail.x, start.y - fTail.y)
    )
    if (distToFocused <= 48 && !hitLayer) {
      const joint =
        Math.hypot(start.x - fTail.x, start.y - fTail.y) <=
        Math.hypot(start.x - focusedBone.x, start.y - focusedBone.y)
          ? 'tail'
          : 'head'
      return { parentBone: focusedBone, parentJoint: joint, hitLayer }
    }
  }

  const hubTail = computeBoneTail(hubBone)
  const distToHead = Math.hypot(start.x - hubBone.x, start.y - hubBone.y)
  const distToTail = Math.hypot(start.x - hubTail.x, start.y - hubTail.y)
  const parentJoint: 'head' | 'tail' = distToHead <= distToTail ? 'head' : 'tail'
  return { parentBone: hubBone, parentJoint, hitLayer }
}

/**
 * Lấy danh sách tất cả các Layer (Slot / Mesh) đang gắn vào một xương cụ thể
 * (bao gồm cả gắn chính `boneId`, gắn đốt con `extraBoneIds`, và mảnh phụ xếp chồng tự suy diễn).
 */
export function getBoundLayersForBone(
  boneId: string,
  layers: ReadonlyArray<AssembledLayerItem>,
  bones: ReadonlyArray<LayerBone>
): Array<{ layer: AssembledLayerItem; isSubChainBone: boolean; isInferredStacked: boolean }> {
  const result: Array<{ layer: AssembledLayerItem; isSubChainBone: boolean; isInferredStacked: boolean }> = []
  for (const layer of layers) {
    if (layer.boneId === boneId) {
      result.push({ layer, isSubChainBone: false, isInferredStacked: false })
    } else if (layer.extraBoneIds?.includes(boneId)) {
      result.push({ layer, isSubChainBone: true, isInferredStacked: false })
    } else if (!layer.boneId && layers.length > 1) {
      const inferred = inferFallbackBoneForStackedLayer(layer, layers, bones)
      if (inferred === boneId) {
        result.push({ layer, isSubChainBone: false, isInferredStacked: true })
      }
    }
  }
  return result
}

/**
 * Đồng bộ toàn diện Khung xương + Slot/Mesh theo chuẩn Spine 2D:
 * 1. Chuẩn hoá phân cấp gốc (`Xương Thân` làm Root Hub, `Xương Đầu` và 4 chi làm nhánh con).
 * 2. Tự động gắn các mảnh phụ xếp chồng chưa có xương (Tóc trước, Tóc sau -> Xương Đầu; Đai ngọc, Tua rua -> Xương Thân).
 * 3. Tự động điền `extraBoneIds` và bật `bindingMode: 'soft'` cho các mảnh Tay/Chân có chuỗi nhiều đốt xương con.
 * 4. Tuỳ chọn đặt lại tên xương mặc định (`"Xương 1" .. "Xương 14"`) sang tên giải phẫu chuẩn Spine 2D.
 */
export function syncSpineStyleRigAndSlots(
  composite: LayerComposite,
  options?: {
    renameGenericBones?: boolean
    extraBonesResolver?: (layers: LayerComposite['layers'], rig: LayerRig, layerId: string, primaryBoneId: string) => string[]
  }
): LayerComposite {
  if (!composite.rig || composite.rig.bones.length === 0) return composite
  const renameGeneric = options?.renameGenericBones ?? false

  // 1. Chuẩn hoá phân cấp gốc
  let bones = normalizeAnatomicalRootHierarchy(composite.rig.bones, composite.layers)
  const roles = inferHumanoidBoneRoles(bones)

  if (renameGeneric) {
    bones = bones.map((b) => {
      const isGenericName = /^xương\s*\d+$/i.test((b.name || '').trim())
      if (!isGenericName) return b
      const roleLabel = getSpineAnatomicalBoneLabel(b.id, roles)
      if (!roleLabel) return b
      return { ...b, name: `${roleLabel} (${b.name.trim()})` }
    })
  }

  // 2. Gắn các mảnh phụ xếp chồng hoặc mảnh chưa có xương vào xương tương ứng
  const parts = analyzeCutoutParts(composite.layers)
  const roleByLayerId = new Map(parts.map((p) => [p.layer.id, p.role]))
  const headBoneId = roles.head
  const torsoBoneId = roles.torso ?? roles.pelvis ?? bones.find((b) => !b.parentId)?.id

  let nextLayers = composite.layers.map((layer) => {
    if (layer.boneId && bones.some((b) => b.id === layer.boneId)) return layer
    const stackedBoneId = inferFallbackBoneForStackedLayer(layer, composite.layers, bones, 64)
    if (stackedBoneId) {
      return {
        ...layer,
        boneId: stackedBoneId,
        bindingMode: layer.bindingMode ?? 'rigid'
      }
    }
    const partRole = roleByLayerId.get(layer.id)
    if ((partRole === 'head' || partRole === 'hair_front' || partRole === 'hair_back') && headBoneId) {
      return {
        ...layer,
        boneId: headBoneId,
        bindingMode: partRole === 'hair_back' ? ('soft' as const) : (layer.bindingMode ?? 'rigid')
      }
    }
    if ((partRole === 'waist_prop' || partRole === 'hanging_prop' || partRole === 'torso' || partRole === 'prop_general') && torsoBoneId) {
      return {
        ...layer,
        boneId: torsoBoneId,
        bindingMode: layer.bindingMode ?? 'rigid'
      }
    }
    return layer
  })

  // 3. Tự động điền `extraBoneIds` và nâng cấp sang `soft` Mesh cho các mảnh có chuỗi nhiều đốt xương con (Tay 3 đốt, Chân 3 đốt)
  const tempRig: LayerRig = { ...composite.rig, bones }
  if (options?.extraBonesResolver && nextLayers.length > 1) {
    nextLayers = nextLayers.map((layer) => {
      if (!layer.boneId) return layer
      const extra = options.extraBonesResolver!(nextLayers, tempRig, layer.id, layer.boneId)
      if (extra.length === 0) return layer
      return {
        ...layer,
        bindingMode: 'soft' as const,
        extraBoneIds: extra
      }
    })
  }

  return {
    ...composite,
    rig: tempRig,
    layers: nextLayers
  }
}
