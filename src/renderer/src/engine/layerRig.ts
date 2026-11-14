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
  /** Độ nổi Z-Index tích luỹ từ chuỗi xương cha xuống xương con (cha tăng/giảm -> con ăn theo). */
  zOrder?: number
}

import { sampleBonePose } from './boneInterpolation'
export { sampleBonePose } from './boneInterpolation'

export function rotatePoint(x: number, y: number, angle: number) {
  const radians = (angle * Math.PI) / 180
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return { x: x * c - y * s, y: x * s + y * c }
}

interface CachedRigEval {
  time: number
  rest: boolean
  bonesRef: LayerRig['bones']
  tracksRef: LayerRig['tracks']
  duration: number
  loop: boolean
  result: Map<string, BoneTransform>
}

const evalRigCache = new WeakMap<LayerRig, CachedRigEval>()

/**
 * World delta from the bind pose. Layers never jump when attached to a resting bone.
 * adjust (tuỳ chọn): chỉnh tạm tư thế từng xương trước khi tính (IK, vật lý thứ cấp) mà không sửa track.
 */
export function evaluateRig(
  rig: LayerRig,
  time: number,
  rest = false,
  adjust?: (boneId: string, pose: BonePose) => BonePose
): Map<string, BoneTransform> {
  if (!adjust) {
    const cached = evalRigCache.get(rig)
    if (
      cached &&
      cached.time === time &&
      cached.rest === rest &&
      cached.bonesRef === rig.bones &&
      cached.tracksRef === rig.tracks &&
      cached.duration === rig.duration &&
      cached.loop === rig.loop
    ) {
      return cached.result
    }
  }
  const result = new Map<string, BoneTransform>()
  const bones = new Map(rig.bones.map((b) => [b.id, b]))
  const visiting = new Set<string>()
  const visit = (id: string): BoneTransform | undefined => {
    if (result.has(id)) return result.get(id)
    const bone = bones.get(id)
    if (!bone || visiting.has(id)) return undefined
    visiting.add(id)
    const parent = bone.parentId ? visit(bone.parentId) : undefined
    const parentBone = bone.parentId ? bones.get(bone.parentId) : undefined
    const sampled = rest ? REST : sampleBonePose(rig, id, time)
    const pose = adjust ? adjust(id, sampled) : sampled
    const parentAngle = parent?.rotation ?? 0
    const parentScaleX = parent?.scaleX ?? 1
    const parentScaleY = parent?.scaleY ?? 1
    let x: number
    let y: number
    if (parent && parentBone) {
      const relX = (bone.x + pose.x - parentBone.x) * parentScaleX
      const relY = (bone.y + pose.y - parentBone.y) * parentScaleY
      const pivot = rotatePoint(relX, relY, parentAngle)
      x = parent.x + pivot.x
      y = parent.y + pivot.y
    } else {
      const pivot = rotatePoint(bone.x + pose.x, bone.y + pose.y, parentAngle)
      x = pivot.x + (parent?.tx ?? 0)
      y = pivot.y + (parent?.ty ?? 0)
    }
    const rotation = parentAngle + pose.rotation
    const scaleX = parentScaleX * (pose.scaleX ?? 1)
    const scaleY = parentScaleY * (pose.scaleY ?? 1)
    const origin = rotatePoint(bone.x * scaleX, bone.y * scaleY, rotation)
    const zOrder = (parent?.zOrder ?? 0) + (pose.zOrder ?? 0)
    const value: BoneTransform = {
      x,
      y,
      rotation,
      tx: x - origin.x,
      ty: y - origin.y,
      scaleX,
      scaleY,
      ...(Math.abs(zOrder) > 1e-6 ? { zOrder } : {})
    }
    result.set(id, value)
    visiting.delete(id)
    return value
  }
  rig.bones.forEach((bone) => visit(bone.id))
  if (!adjust) {
    evalRigCache.set(rig, {
      time,
      rest,
      bonesRef: rig.bones,
      tracksRef: rig.tracks,
      duration: rig.duration,
      loop: rig.loop,
      result
    })
  }
  return result
}

export function transformRigLayer<
  T extends {
    x: number
    y: number
    z?: number
    rotation: number
    boneId?: string
    scale?: number
    scaleX?: number
    scaleY?: number
  }
>(layer: T, transforms: Map<string, BoneTransform>): T {
  const bone = layer.boneId ? transforms.get(layer.boneId) : undefined
  if (!bone) return layer
  const sx = bone.scaleX ?? 1
  const sy = bone.scaleY ?? 1
  const position = rotatePoint(layer.x * sx, layer.y * sy, bone.rotation)
  const nextZ = typeof layer.z === 'number' ? Number((layer.z + (bone.zOrder ?? 0)).toFixed(3)) : layer.z
  return {
    ...layer,
    x: position.x + bone.tx,
    y: position.y + bone.ty,
    ...(typeof nextZ === 'number' ? { z: nextZ } : {}),
    rotation: layer.rotation + bone.rotation,
    scaleX: sx * (layer.scaleX ?? 1),
    scaleY: sy * (layer.scaleY ?? 1)
  }
}
