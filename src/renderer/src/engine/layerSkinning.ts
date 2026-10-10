import type { LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint } from './layerRig'

export interface SkinBinding {
  boneId?: string
  x: number
  y: number
  rotation: number
  scale: number
  scaleX?: number
  scaleY?: number
}
export interface SkinInfluence { id: string; weight: number }
const weightCache = new WeakMap<Float32Array, { key: string; weights: SkinInfluence[][] }>()

function cachedWeights(positions: Float32Array, binding: SkinBinding, bones: LayerRig['bones']) {
  const key = JSON.stringify([binding.x, binding.y, binding.rotation, binding.scale,
    binding.scaleX, binding.scaleY, bones])
  const cached = weightCache.get(positions)
  if (cached?.key === key) return cached.weights
  const weights: SkinInfluence[][] = []
  for (let i = 0; i < positions.length; i += 3) {
    const p = rotatePoint(positions[i] * binding.scale * (binding.scaleX ?? 1),
      -positions[i + 1] * binding.scale * (binding.scaleY ?? 1), binding.rotation)
    weights.push(skinWeights(p.x + binding.x, p.y + binding.y, bones))
  }
  weightCache.set(positions, { key, weights })
  return weights
}

/** Only the selected branch influences a layer (a hair chain cannot pull an arm). */
export function skinBones(rig: LayerRig, root?: string) {
  const ids = new Set(root ? [root] : [])
  for (let i = 0; i < rig.bones.length; i++) {
    for (const b of rig.bones) if (b.parentId && ids.has(b.parentId)) ids.add(b.id)
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
export function deformSkin(positions: Float32Array, binding: SkinBinding, rig: LayerRig, time: number): Float32Array {
  const output = positions.slice()
  const bones = skinBones(rig, binding.boneId)
  if (!bones.length) return output
  const transforms = evaluateRig(rig, time)
  const weights = cachedWeights(positions, binding, bones)
  const boneById = new Map(bones.map((b) => [b.id, b]))
  const sx = binding.scale * (binding.scaleX ?? 1), sy = binding.scale * (binding.scaleY ?? 1)
  if (Math.abs(sx * sy) < 1e-10) return output
  for (let i = 0; i < positions.length; i += 3) {
    const p = rotatePoint(positions[i] * sx, -positions[i + 1] * sy, binding.rotation)
    const wx = p.x + binding.x, wy = p.y + binding.y
    let x = 0, y = 0
    for (const influence of weights[i / 3]) {
      const transform = transforms.get(influence.id)!
      const bone = boneById.get(influence.id)!
      const delta = rotatePoint((wx - bone.x) * (transform.scaleX ?? 1),
        (wy - bone.y) * (transform.scaleY ?? 1), transform.rotation)
      x += (transform.x + delta.x) * influence.weight
      y += (transform.y + delta.y) * influence.weight
    }
    const local = rotatePoint(x - binding.x, y - binding.y, -binding.rotation)
    output[i] = local.x / sx
    output[i + 1] = -local.y / sy
  }
  return output
}
