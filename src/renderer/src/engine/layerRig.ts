import type { BoneKeyframe, BonePose, LayerRig } from '@shared/layerRig'

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

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

function unwrapAngle(ref: number, val: number): number {
  let diff = (val - ref) % 360
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  return ref + diff
}

function interpolateKeys(
  k0: BoneKeyframe,
  k1: BoneKeyframe,
  k2: BoneKeyframe,
  k3: BoneKeyframe,
  time: number
): BonePose {
  const span = k2.time - k1.time || 1
  let t = Math.max(0, Math.min(1, (time - k1.time) / span))
  if (k1.easing === 'hold') return k1
  if (k1.easing === 'linear') {
    return {
      x: k1.x + (k2.x - k1.x) * t,
      y: k1.y + (k2.y - k1.y) * t,
      rotation: k1.rotation + (k2.rotation - k1.rotation) * t,
      scaleX: (k1.scaleX ?? 1) + ((k2.scaleX ?? 1) - (k1.scaleX ?? 1)) * t,
      scaleY: (k1.scaleY ?? 1) + ((k2.scaleY ?? 1) - (k1.scaleY ?? 1)) * t
    }
  }

  // Easing 'smooth': Catmull-Rom spline with continuous velocity
  const rot0 = unwrapAngle(k1.rotation, k0.rotation)
  const rot1 = k1.rotation
  const rot2 = unwrapAngle(k1.rotation, k2.rotation)
  const rot3 = unwrapAngle(rot2, k3.rotation)

  return {
    x: catmullRom(k0.x, k1.x, k2.x, k3.x, t),
    y: catmullRom(k0.y, k1.y, k2.y, k3.y, t),
    rotation: catmullRom(rot0, rot1, rot2, rot3, t),
    scaleX: catmullRom(k0.scaleX ?? 1, k1.scaleX ?? 1, k2.scaleX ?? 1, k3.scaleX ?? 1, t),
    scaleY: catmullRom(k0.scaleY ?? 1, k1.scaleY ?? 1, k2.scaleY ?? 1, k3.scaleY ?? 1, t)
  }
}

/** Cyclic Catmull-Rom interpolation for silky smooth organic animation. */
export function sampleBonePose(rig: LayerRig, id: string, time: number): BonePose {
  const rawKeys = rig.tracks[id] ?? []
  if (!rawKeys.length) return REST
  if (rawKeys.length === 1) return rawKeys[0]

  const dur = rig.duration || 1
  const t = rig.loop ? ((time % dur) + dur) % dur : Math.max(0, Math.min(dur, time))
  const n = rawKeys.length

  // Build looping virtual key list with seam continuity
  if (t < rawKeys[0].time) {
    if (!rig.loop) return rawKeys[0]
    const k1 = { ...rawKeys[n - 1], time: rawKeys[n - 1].time - dur }
    const k2 = rawKeys[0]
    const k0 = { ...rawKeys[n - 2 < 0 ? 0 : n - 2], time: (rawKeys[n - 2 < 0 ? 0 : n - 2].time) - dur }
    const k3 = rawKeys[1] ?? k2
    return interpolateKeys(k0, k1, k2, k3, t)
  }

  if (t >= rawKeys[n - 1].time) {
    if (!rig.loop || rawKeys[n - 1].time >= dur) return rawKeys[n - 1]
    const k1 = rawKeys[n - 1]
    const k2 = { ...rawKeys[0], time: rawKeys[0].time + dur }
    const k0 = rawKeys[n - 2] ?? k1
    const k3 = { ...rawKeys[1] ?? rawKeys[0], time: (rawKeys[1]?.time ?? 0) + dur }
    return interpolateKeys(k0, k1, k2, k3, t)
  }

  const idx = rawKeys.findIndex((k) => k.time > t) - 1
  const i = Math.max(0, idx)
  const k1 = rawKeys[i]
  const k2 = rawKeys[i + 1]

  const k0 = i > 0
    ? rawKeys[i - 1]
    : rig.loop
      ? { ...rawKeys[n - 1], time: rawKeys[n - 1].time - dur }
      : k1

  const k3 = i + 2 < n
    ? rawKeys[i + 2]
    : rig.loop
      ? { ...rawKeys[0], time: rawKeys[0].time + dur }
      : k2

  return interpolateKeys(k0, k1, k2, k3, t)
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
