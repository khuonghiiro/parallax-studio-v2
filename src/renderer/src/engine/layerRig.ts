import type { BonePose, LayerRig } from '@shared/layerRig'

const REST: BonePose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
export interface BoneTransform {
  x: number
  y: number
  rotation: number
  tx: number
  ty: number
  scaleX?: number
  scaleY?: number
}

import { sampleBonePose } from './boneInterpolation'
export { sampleBonePose } from './boneInterpolation'

export function rotatePoint(x: number, y: number, angle: number) {
  const radians = angle * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** World delta from the bind pose. Layers never jump when attached to a resting bone. */
export function evaluateRig(rig: LayerRig, time: number, rest = false): Map<string, BoneTransform> {
  const result = new Map<string, BoneTransform>()
  const bones = new Map(rig.bones.map((b) => [b.id, b]))
  const visiting = new Set<string>()
  const visit = (id: string): BoneTransform | undefined => {
    if (result.has(id)) return result.get(id)
    const bone = bones.get(id)
    if (!bone || visiting.has(id)) return undefined
    visiting.add(id)
    const parent = bone.parentId ? visit(bone.parentId) : undefined
    const pose = rest ? REST : sampleBonePose(rig, id, time)
    const parentAngle = parent?.rotation ?? 0
    const pivot = rotatePoint(bone.x + pose.x, bone.y + pose.y, parentAngle)
    const x = pivot.x + (parent?.tx ?? 0), y = pivot.y + (parent?.ty ?? 0)
    const rotation = parentAngle + pose.rotation
    const origin = rotatePoint(bone.x, bone.y, rotation)
    const scaleX = (parent?.scaleX ?? 1) * (pose.scaleX ?? 1)
    const scaleY = (parent?.scaleY ?? 1) * (pose.scaleY ?? 1)
    const value: BoneTransform = { x, y, rotation, tx: x - origin.x, ty: y - origin.y, scaleX, scaleY }
    result.set(id, value)
    visiting.delete(id)
    return value
  }
  rig.bones.forEach((bone) => visit(bone.id))
  return result
}

export function transformRigLayer<T extends { x: number; y: number; rotation: number; boneId?: string; scale?: number; scaleX?: number; scaleY?: number }>(
  layer: T, transforms: Map<string, BoneTransform>
): T {
  const bone = layer.boneId ? transforms.get(layer.boneId) : undefined
  if (!bone) return layer
  const position = rotatePoint(layer.x, layer.y, bone.rotation)
  return {
    ...layer,
    x: position.x + bone.tx,
    y: position.y + bone.ty,
    rotation: layer.rotation + bone.rotation,
    scaleX: (bone.scaleX ?? 1) * (layer.scaleX ?? 1),
    scaleY: (bone.scaleY ?? 1) * (layer.scaleY ?? 1)
  }
}
