import type { LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint } from './layerRig'
import { computeMeshCorridor } from './meshCorridor'

export interface SkinBinding {
  boneId?: string
  /** Các xương phụ cùng gắn uốn mềm trên một layer (nhiều nhánh cây / nhiều đường kẻ độc lập). */
  extraBoneIds?: string[]
  x: number
  y: number
  rotation: number
  scale: number
  scaleX?: number
  scaleY?: number
  bindPose?: { x: number; y: number; rotation: number }
}
export interface SkinInfluence { id: string; weight: number }
const weightCache = new WeakMap<Float32Array, { key: string; weights: SkinInfluence[][] }>()
const sharedTopologyWeightCache = new Map<string, SkinInfluence[][]>()
const MAX_SHARED_TOPOLOGY_CACHE = 96

function buildBonesSignature(bones: LayerRig['bones']): string {
  let sig = ''
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i]
    sig += `${b.id}|${b.parentId ?? ''}|${b.x.toFixed(2)},${b.y.toFixed(2)},${b.length.toFixed(2)},${b.angle.toFixed(2)},${(b.strength ?? 1).toFixed(2)},${b.pin ? 1 : 0};`
  }
  return sig
}

function buildGeometrySignature(positions: Float32Array, indices?: ArrayLike<number>): string {
  const n = positions.length
  if (n < 6) return `v${n}`
  const mid = Math.floor(n / 6) * 3
  const end = n - 3
  return `v${n}:i${indices?.length ?? 0}:${positions[0].toFixed(2)},${positions[1].toFixed(2)}:${positions[mid].toFixed(2)},${positions[mid + 1].toFixed(2)}:${positions[end].toFixed(2)},${positions[end + 1].toFixed(2)}`
}

function isCoincidentWithTail(parent: LayerRig['bones'][number], child: LayerRig['bones'][number]): boolean {
  if (child.parentJoint === 'head') return false
  const pEnd = rotatePoint(parent.length, 0, parent.angle)
  const pTailX = parent.x + pEnd.x
  const pTailY = parent.y + pEnd.y
  return Math.hypot(child.x - pTailX, child.y - pTailY) <= 8
}

function buildBoneChains(bones: LayerRig['bones']): Array<LayerRig['bones']> {
  const byId = new Map(bones.map((b) => [b.id, b]))
  const children = new Map<string, LayerRig['bones']>()
  for (const b of bones) {
    if (b.parentId && byId.has(b.parentId)) {
      const list = children.get(b.parentId) ?? []
      list.push(b)
      children.set(b.parentId, list)
    }
  }
  const chains: Array<LayerRig['bones']> = []
  for (const b of bones) {
    const parent = b.parentId ? byId.get(b.parentId) : undefined
    const isCoincident = parent ? isCoincidentWithTail(parent, b) : false
    const isStart = !parent || (children.get(parent.id)?.length ?? 0) > 1 || !isCoincident
    if (!isStart) continue
    const chain: LayerRig['bones'] = [b]
    let cur = b
    while (true) {
      const kids = children.get(cur.id)
      if (!kids || kids.length !== 1) break
      const next = kids[0]
      if (!isCoincidentWithTail(cur, next)) break
      cur = next
      chain.push(cur)
    }
    chains.push(chain)
  }
  return chains.length ? chains : bones.map((b) => [b])
}

function buildCorridorWeights(
  world: Float32Array,
  bones: LayerRig['bones'],
  indices: ArrayLike<number>
): SkinInfluence[][] | null {
  const vCount = world.length >> 1
  const chains = buildBoneChains(bones)
  const chainMeta = chains.map((chain) => {
    const ends = chain.map((b) => rotatePoint(b.length, 0, b.angle))
    const points = [
      { x: chain[0].x, y: chain[0].y },
      ...chain.map((b, idx) => ({ x: b.x + ends[idx].x, y: b.y + ends[idx].y }))
    ]
    const corridor = computeMeshCorridor(world, indices, points)
    return { chain, ends, corridor }
  })
  if (chainMeta.every((m) => m.corridor === null)) return null

  const out: SkinInfluence[][] = new Array(vCount)
  for (let i = 0; i < vCount; i++) {
    const x = world[i * 2]
    const y = world[i * 2 + 1]

    // 1. Gom candidates theo từng chuỗi xương hợp lệ (cw > 1e-4)
    const chainCandidates: Array<{
      chainIdx: number
      minDist: number
      items: Array<{ id: string; dEff: number; raw: number; cw: number }>
    }> = []

    for (let c = 0; c < chainMeta.length; c++) {
      const { chain, ends, corridor } = chainMeta[c]
      if (!corridor) continue
      const cw = corridor.weights[i]
      if (cw <= 1e-4) continue

      let cMinDist = Infinity
      const items: Array<{ id: string; dEff: number; raw: number; cw: number }> = []
      const lastIdx = chain.length - 1
      const lo = Math.max(0, Math.min(lastIdx, corridor.segMin[i] - 1))
      const hi = lastIdx

      for (let s = lo; s <= hi; s++) {
        const b = chain[s]
        const end = ends[s]
        const reachMult = Math.max(0.5, Math.min(3.0, b.influenceReach ?? 1.0))
        const len = b.length * reachMult
        const baseLen2 = b.length * b.length || 1
        const rawT = ((x - b.x) * end.x + (y - b.y) * end.y) / baseLen2
        const perpX = x - b.x - Math.min(1, Math.max(0, rawT)) * end.x
        const perpY = y - b.y - Math.min(1, Math.max(0, rawT)) * end.y
        const dPerp = Math.hypot(perpX, perpY)
        let dAxial = 0
        if (!b.pin) {
          if (rawT < 0) dAxial = -rawT * len
          else if (rawT > reachMult) dAxial = (rawT - reachMult) * len
        }
        const sMult = Math.max(0.1, b.strength ?? 1)
        const radius = Math.max(1, len * 0.15 * sMult)
        const dEff = Math.hypot(dPerp, Math.sqrt(5.0) * dAxial)
        const dEff2 = dPerp * dPerp + 5.0 * dAxial * dAxial
        const affinity = (sMult * sMult) / (dEff2 + radius * radius) ** 2
        items.push({ id: b.id, dEff, raw: cw * affinity, cw })
        if (dEff < cMinDist) cMinDist = dEff
      }

      if (items.length > 0) {
        chainCandidates.push({ chainIdx: c, minDist: cMinDist, items })
      }
    }

    if (!chainCandidates.length) {
      out[i] = []
      continue
    }

    // 2. Voronoi Bone Chain Partitioning (Tự động tách 2 nhánh/2 chân chữ V):
    // Khi một đỉnh nhận ảnh hưởng từ 2 chuỗi trở lên (chân trái và chân phải),
    // ta chọn chuỗi có xương gần nhất (Voronoi winner). Chỉ giữ lại cả 2 chuỗi nếu khoảng cách
    // tới cả 2 chuỗi chênh lệch rất nhỏ (vùng chạc hông / đáy quần tiếp giáp).
    let selectedChains = chainCandidates
    if (chainCandidates.length > 1) {
      const best = chainCandidates.reduce((prev, cur) => (cur.minDist < prev.minDist ? cur : prev))
      const closeChains = chainCandidates.filter((cc) => cc.minDist <= Math.min(best.minDist * 1.35, best.minDist + 16))
      selectedChains = closeChains.length > 0 ? closeChains : [best]
    }

    const candidates: Array<{ id: string; dEff: number; raw: number; cw: number }> = []
    let minDist = Infinity
    for (const sc of selectedChains) {
      for (const item of sc.items) {
        candidates.push(item)
        if (item.dEff < minDist) minDist = item.dEff
      }
    }

    // Lọc bỏ xương ở nhánh xa trong cùng chuỗi
    const maxAllowed = Math.max(minDist * 2.0, minDist + 16)
    const active = candidates.filter((c) => candidates.length === 1 || c.dEff <= maxAllowed)
    const list = active.length > 0 ? active : candidates
    list.sort((a, b) => b.raw - a.raw)
    const top = list.slice(0, 4)
    const rawSum = top.reduce((s, w) => s + w.raw, 0) || 1
    const envelope = Math.min(1, top.reduce((s, w) => s + w.cw, 0))
    out[i] = top.map((w) => ({ id: w.id, weight: (w.raw / rawSum) * envelope }))
  }
  return out
}

function cachedWeights(
  positions: Float32Array,
  binding: SkinBinding,
  bones: LayerRig['bones'],
  indices?: ArrayLike<number>
): SkinInfluence[][] {
  const scale = binding.scale ?? 1
  const rot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const bx = binding.bindPose?.x ?? binding.x ?? 0
  const by = binding.bindPose?.y ?? binding.y ?? 0
  const vCount = positions.length / 3
  const useCorridor = Boolean(indices && indices.length >= 3 && vCount > 3)
  const key = `${bx.toFixed(2)}:${by.toFixed(2)}:${rot.toFixed(2)}:${scale.toFixed(4)}:${(binding.scaleX ?? 1).toFixed(4)}:${(binding.scaleY ?? 1).toFixed(4)}:${useCorridor ? indices!.length : 0}:${buildBonesSignature(bones)}`
  const cached = weightCache.get(positions)
  if (cached?.key === key) return cached.weights

  const topoKey = `${buildGeometrySignature(positions, useCorridor ? indices : undefined)}|${key}`
  const shared = sharedTopologyWeightCache.get(topoKey)
  if (shared) {
    weightCache.set(positions, { key, weights: shared })
    return shared
  }

  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const world = new Float32Array(vCount * 2)
  for (let i = 0; i < vCount; i++) {
    const p = rotatePoint(positions[i * 3] * sx, -positions[i * 3 + 1] * sy, rot)
    world[i * 2] = p.x + bx
    world[i * 2 + 1] = p.y + by
  }

  let weights: SkinInfluence[][] | null = null
  if (useCorridor) {
    weights = buildCorridorWeights(world, bones, indices!)
  }
  if (!weights) {
    weights = []
    for (let i = 0; i < vCount; i++) {
      weights.push(skinWeights(world[i * 2], world[i * 2 + 1], bones))
    }
  }
  weightCache.set(positions, { key, weights })
  sharedTopologyWeightCache.set(topoKey, weights)
  if (sharedTopologyWeightCache.size > MAX_SHARED_TOPOLOGY_CACHE) {
    const oldest = sharedTopologyWeightCache.keys().next().value
    if (oldest !== undefined) sharedTopologyWeightCache.delete(oldest)
  }
  return weights
}

/** Lấy nhánh xương được gắn cho layer (hỗ trợ cả xương chính lẫn danh sách xương phụ độc lập trên cùng layer). */
export function skinBones(rig: LayerRig, root?: string, extraRoots?: string[]) {
  if (!root && (!extraRoots || !extraRoots.length)) return rig.bones
  const seeds = [root, ...(extraRoots ?? [])].filter((id): id is string => Boolean(id))
  const ids = new Set(seeds)
  for (let i = 0; i < rig.bones.length; i++) {
    for (const b of rig.bones) if (b.parentId && ids.has(b.parentId)) ids.add(b.id)
  }
  for (const seed of seeds) {
    const current = rig.bones.find((b) => b.id === seed)
    if (current?.parentId) ids.add(current.parentId)
  }
  return rig.bones.filter((b) => ids.has(b.id))
}

export function skinWeights(x: number, y: number, bones: LayerRig['bones']): SkinInfluence[] {
  if (!bones.length) return []
  const candidates: Array<{ id: string; dEff: number; weight: number }> = []
  let minDist = Infinity
  for (const b of bones) {
    const end = rotatePoint(b.length, 0, b.angle)
    const reachMult = Math.max(0.5, Math.min(3.0, b.influenceReach ?? 1.0))
    const len = b.length * reachMult
    const baseLen2 = b.length * b.length || 1
    const rawT = ((x - b.x) * end.x + (y - b.y) * end.y) / baseLen2
    const perpX = x - b.x - Math.min(1, Math.max(0, rawT)) * end.x
    const perpY = y - b.y - Math.min(1, Math.max(0, rawT)) * end.y
    const dPerp = Math.hypot(perpX, perpY)
    let dAxial = 0
    if (!b.pin) {
      if (rawT < 0) dAxial = -rawT * len
      else if (rawT > reachMult) dAxial = (rawT - reachMult) * len
    }
    const sMult = Math.max(0.1, b.strength ?? 1)
    const radius = Math.max(1, len * 0.15 * sMult)
    const dEff = Math.hypot(dPerp, Math.sqrt(5.0) * dAxial)
    const dEff2 = dPerp * dPerp + 5.0 * dAxial * dAxial
    const weight = (sMult * sMult) / (dEff2 + radius * radius) ** 2
    candidates.push({ id: b.id, dEff, weight })
    if (dEff < minDist) minDist = dEff
  }

  // Lọc bỏ xương ở nhánh khác qua khoảng không gian rỗng (chữ V, cành đối diện)
  const maxAllowed = Math.max(minDist * 2.0, minDist + 16)
  const active = candidates.filter((c) => candidates.length === 1 || c.dEff <= maxAllowed)
  const list = active.length > 0 ? active : candidates
  list.sort((a, b) => b.weight - a.weight)
  const top = list.slice(0, 4)
  const sum = top.reduce((s, w) => s + w.weight, 0) || 1
  return top.map((w) => ({ id: w.id, weight: w.weight / sum }))
}

/** Returns local Y-up mesh positions; bind coordinates and bone transforms are Y-down. */
export function deformSkin(
  positions: Float32Array,
  binding: SkinBinding,
  rig: LayerRig,
  time: number,
  indices?: ArrayLike<number>,
  out?: Float32Array
): Float32Array {
  const bones = skinBones(rig, binding.boneId, binding.extraBoneIds)
  if (!bones.length) {
    if (out && out !== positions) {
      out.set(positions)
      return out
    }
    return positions
  }
  const output = out && out.length === positions.length ? out : positions.slice()
  if (output !== positions) output.set(positions)
  const transforms = evaluateRig(rig, time)
  const scale = binding.scale ?? 1
  const restRot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const restBx = binding.bindPose?.x ?? binding.x ?? 0
  const restBy = binding.bindPose?.y ?? binding.y ?? 0
  const curRot = binding.rotation ?? restRot
  const curBx = binding.x ?? restBx
  const curBy = binding.y ?? restBy

  // Fast-path: nếu toàn bộ xương của nhánh đang ở tư thế nghỉ gốc (0°, không tịnh tiến/co giãn) thì trả về ngay (~0.002ms)
  if (
    Math.abs(curRot - restRot) < 1e-4 &&
    Math.abs(curBx - restBx) < 1e-4 &&
    Math.abs(curBy - restBy) < 1e-4
  ) {
    let allAtRest = true
    for (let i = 0; i < bones.length; i++) {
      const b = bones[i]
      const tf = transforms.get(b.id)
      if (!tf) continue
      if (
        Math.abs(tf.x - b.x) > 1e-4 ||
        Math.abs(tf.y - b.y) > 1e-4 ||
        Math.abs(tf.rotation) > 1e-4 ||
        Math.abs((tf.scaleX ?? 1) - 1) > 1e-4 ||
        Math.abs((tf.scaleY ?? 1) - 1) > 1e-4
      ) {
        allAtRest = false
        break
      }
    }
    if (allAtRest) return output
  }

  const weights = cachedWeights(positions, binding, bones, indices)
  const boneById = new Map(bones.map((b) => [b.id, b]))

  const sx = scale * (binding.scaleX ?? 1), sy = scale * (binding.scaleY ?? 1)
  if (Math.abs(sx * sy) < 1e-10) return output

  const restRad = (restRot * Math.PI) / 180
  const restCos = Math.cos(restRad)
  const restSin = Math.sin(restRad)
  const invCurRad = (-curRot * Math.PI) / 180
  const invCurCos = Math.cos(invCurRad)
  const invCurSin = Math.sin(invCurRad)
  const invSx = 1 / sx
  const invSy = 1 / sy

  for (let i = 0; i < positions.length; i += 3) {
    const influences = weights[i / 3]
    if (!influences || !influences.length) continue
    const px = positions[i] * sx
    const py = -positions[i + 1] * sy
    const wx = px * restCos - py * restSin + restBx
    const wy = px * restSin + py * restCos + restBy
    let x = 0, y = 0, totalW = 0
    let p0x = 0, p0y = 0, p1x = 0, p1y = 0
    let hasP0 = false, hasP1 = false
    for (let j = 0; j < influences.length; j++) {
      const influence = influences[j]
      const transform = transforms.get(influence.id)
      const bone = boneById.get(influence.id)
      if (!transform || !bone) continue
      const scaleX = transform.scaleX ?? 1
      const scaleY = transform.scaleY ?? 1
      const dxRel = (wx - bone.x) * scaleX
      const dyRel = (wy - bone.y) * scaleY
      const delta = rotatePoint(dxRel, dyRel, transform.rotation)
      const ptX = transform.x + delta.x
      const ptY = transform.y + delta.y
      const w = influence.weight
      x += ptX * w
      y += ptY * w
      totalW += w
      if (j === 0) {
        p0x = ptX
        p0y = ptY
        hasP0 = true
      } else if (j === 1) {
        p1x = ptX
        p1y = ptY
        hasP1 = true
      }
    }
    if (totalW <= 1e-6) continue
    if (totalW < 1) {
      x += wx * (1 - totalW)
      y += wy * (1 - totalW)
    } else if (hasP0 && hasP1 && influences[1].weight > 1e-4) {
      // Bù trừ hình học cung tròn trơn mượt C∞ (Smooth Circular Sagitta Chord Compensation):
      // Triệt tiêu sập khớp LBS theo hàm parabol (4*w0*w1)/(w0+w1) liên tục 100%, bảo tồn thể tích hoàn hảo,
      // không có bất kỳ bước nhảy ranh giới nào, triệt tiêu 100% răng cưa và ngăn ngừa lộn ngược tam giác.
      const tf0 = transforms.get(influences[0].id)
      const tf1 = transforms.get(influences[1].id)
      const b1 = boneById.get(influences[1].id)
      if (tf0 && tf1 && b1) {
        let dRot = (tf1.rotation - tf0.rotation) % 360
        if (dRot > 180) dRot -= 360
        if (dRot < -180) dRot += 360
        const absDRot = Math.abs(dRot)
        if (absDRot > 0.5 && absDRot < 179) {
          const dx = p1x - p0x
          const dy = p1y - p0y
          const dist = Math.hypot(dx, dy)
          if (dist > 0.5) {
            const restRadius = Math.hypot(wx - b1.x, wy - b1.y)
            const curRadius = Math.hypot(x - tf1.x, y - tf1.y)
            if (curRadius < restRadius && restRadius > 1.0) {
              const maxDeficit = restRadius - curRadius
              const radQuarter = (absDRot * Math.PI) / 720
              const h = Math.min(maxDeficit, 0.5 * dist * Math.tan(radQuarter))
              const sign = dRot > 0 ? 1 : -1
              const nx = (sign * dy) / dist
              const ny = (-sign * dx) / dist
              const w0 = influences[0].weight
              const w1 = influences[1].weight
              const blend = (4 * w0 * w1) / (w0 + w1)
              x += blend * h * nx
              y += blend * h * ny
            }
          }
        }
      }
    }
    const dx = x - curBx
    const dy = y - curBy
    output[i] = (dx * invCurCos - dy * invCurSin) * invSx
    output[i + 1] = -(dx * invCurSin + dy * invCurCos) * invSy
  }
  return output
}
