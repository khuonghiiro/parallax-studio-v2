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
    const isStart = !b.parentId || !byId.has(b.parentId) || (children.get(b.parentId)?.length ?? 0) > 1
    if (!isStart) continue
    const chain: LayerRig['bones'] = [b]
    let cur = b
    while (true) {
      const kids = children.get(cur.id)
      if (!kids || kids.length !== 1) break
      cur = kids[0]
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
    const active: Array<{ id: string; raw: number; cw: number }> = []
    for (const { chain, ends, corridor } of chainMeta) {
      if (!corridor) continue
      const cw = corridor.weights[i]
      if (cw <= 1e-4) continue
      const lastIdx = chain.length - 1
      const lo = Math.max(0, Math.min(lastIdx, corridor.segMin[i] - 1))
      const hi = lastIdx
      for (let s = lo; s <= hi; s++) {
        const b = chain[s]
        const end = ends[s]
        const len2 = b.length * b.length || 1
        const rawT = ((x - b.x) * end.x + (y - b.y) * end.y) / len2
        const t = Math.max(0, Math.min(1, rawT))
        const distance = Math.hypot(x - b.x - t * end.x, y - b.y - t * end.y)
        const radius = Math.max(1, b.length * 0.15)
        const affinity = 1 / (distance * distance + radius * radius) ** 2
        active.push({ id: b.id, raw: cw * affinity, cw })
      }
    }
    if (!active.length) {
      out[i] = []
      continue
    }
    active.sort((a, b) => b.raw - a.raw)
    const top = active.slice(0, 4)
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
  const key = JSON.stringify([
    bx, by, rot, scale,
    binding.scaleX ?? 1, binding.scaleY ?? 1,
    useCorridor ? indices!.length : 0,
    bones
  ])
  const cached = weightCache.get(positions)
  if (cached?.key === key) return cached.weights

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
  const weights = bones.map((b) => {
    const end = rotatePoint(b.length, 0, b.angle)
    const t = Math.max(0, Math.min(1, ((x - b.x) * end.x + (y - b.y) * end.y) / (b.length * b.length)))
    const distance = Math.hypot(x - b.x - t * end.x, y - b.y - t * end.y)
    const radius = Math.max(1, b.length * 0.15)
    return { id: b.id, weight: 1 / (distance * distance + radius * radius) ** 2 }
  }).sort((a, b) => b.weight - a.weight).slice(0, 4)
  const sum = weights.reduce((s, w) => s + w.weight, 0)
  return weights.map((w) => ({ id: w.id, weight: w.weight / sum }))
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
  const weights = cachedWeights(positions, binding, bones, indices)
  const boneById = new Map(bones.map((b) => [b.id, b]))
  const scale = binding.scale ?? 1
  const restRot = binding.bindPose?.rotation ?? binding.rotation ?? 0
  const restBx = binding.bindPose?.x ?? binding.x ?? 0
  const restBy = binding.bindPose?.y ?? binding.y ?? 0
  const curRot = binding.rotation ?? restRot
  const curBx = binding.x ?? restBx
  const curBy = binding.y ?? restBy

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
    for (let j = 0; j < influences.length; j++) {
      const influence = influences[j]
      const transform = transforms.get(influence.id)
      const bone = boneById.get(influence.id)
      if (!transform || !bone) continue
      const delta = rotatePoint(
        (wx - bone.x) * (transform.scaleX ?? 1),
        (wy - bone.y) * (transform.scaleY ?? 1),
        transform.rotation
      )
      x += (transform.x + delta.x) * influence.weight
      y += (transform.y + delta.y) * influence.weight
      totalW += influence.weight
    }
    if (totalW <= 1e-6) continue
    if (totalW < 1) {
      x += wx * (1 - totalW)
      y += wy * (1 - totalW)
    }
    const dx = x - curBx
    const dy = y - curBy
    output[i] = (dx * invCurCos - dy * invCurSin) * invSx
    output[i + 1] = -(dx * invCurSin + dy * invCurCos) * invSy
  }
  return output
}
