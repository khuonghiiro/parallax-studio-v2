import type { BoneKeyframe, BonePose, LayerRig } from '@shared/layerRig'

const REST: BonePose = { x: 0, y: 0, rotation: 0 }
export interface BoneTransform { x: number; y: number; rotation: number; tx: number; ty: number }

function interpolate(a: BoneKeyframe, b: BoneKeyframe, time: number): BonePose {
  let t = Math.max(0, Math.min(1, (time - a.time) / (b.time - a.time || 1)))
  if (a.easing === 'hold') t = 0
  if (a.easing === 'smooth') t = t * t * (3 - 2 * t)
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
    rotation: a.rotation + (b.rotation - a.rotation) * t }
}

/** Cyclic interpolation includes the seam; non-looping clips hold the end pose. */
export function sampleBonePose(rig: LayerRig, id: string, time: number): BonePose {
  const keys = rig.tracks[id] ?? []
  if (!keys.length) return REST
  if (keys.length === 1) return keys[0]
  const t = rig.loop ? ((time % rig.duration) + rig.duration) % rig.duration : Math.max(0, Math.min(rig.duration, time))
  const first = keys[0], last = keys[keys.length - 1]
  if (t < first.time) return rig.loop
    ? interpolate({ ...last, time: last.time - rig.duration }, first, t) : first
  if (t >= last.time) return rig.loop && last.time < rig.duration
    ? interpolate(last, { ...first, time: first.time + rig.duration }, t) : last
  const next = keys.findIndex((k) => k.time > t)
  return interpolate(keys[next - 1], keys[next], t)
}

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
    const value = { x, y, rotation, tx: x - origin.x, ty: y - origin.y }
    result.set(id, value)
    visiting.delete(id)
    return value
  }
  rig.bones.forEach((bone) => visit(bone.id))
  return result
}

export function transformRigLayer<T extends { x: number; y: number; rotation: number; boneId?: string }>(
  layer: T, transforms: Map<string, BoneTransform>
): T {
  const bone = layer.boneId ? transforms.get(layer.boneId) : undefined
  if (!bone) return layer
  const position = rotatePoint(layer.x, layer.y, bone.rotation)
  return { ...layer, x: position.x + bone.tx, y: position.y + bone.ty, rotation: layer.rotation + bone.rotation }
}
