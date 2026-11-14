import type { BoneKeyframe, BonePose, LayerRig } from '@shared/layerRig'
import { cubicBezierProgress } from './boneEasing'

const REST: BonePose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
const fields = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'zOrder'] as const
const value = (k: BonePose, field: typeof fields[number]) =>
  field === 'zOrder' ? (k.zOrder ?? 0) : (k[field] ?? REST[field] ?? 0)
const shifted = (key: BoneKeyframe, offset: number) => ({ ...key, time: key.time + offset })

function unwrap(ref: number, angle: number): number {
  return ref + ((angle - ref + 180) % 360 + 360) % 360 - 180
}

function clampMonotoneSlope(secantA: number, secantB: number, rawSlope: number): number {
  if (secantA * secantB <= 0) return 0
  const maxMag = 3 * Math.min(Math.abs(secantA), Math.abs(secantB))
  return Math.max(-maxMag, Math.min(maxMag, rawSlope))
}

/** Hermite tangents use seconds with Fritsch-Carlson monotone clamping to prevent overshoot whip-back. */
function interpolate(keys: BoneKeyframe[], time: number): BonePose {
  const [a, b, c, d] = keys
  if (b.easing === 'hold') return b
  const span = c.time - b.time
  const t = span <= 0 ? 0 : Math.max(0, Math.min(1, (time - b.time) / span))
  const result = { ...REST }
  const easing = b.easing
  const dtPrev = b.time - a.time
  const dtNext = d.time - c.time
  const spanLeft = c.time - a.time
  const spanRight = d.time - b.time
  for (const field of fields) {
    let [v0, v1, v2, v3] = keys.map((k) => value(k, field))
    if (field === 'rotation') {
      v0 = unwrap(v1, v0); v2 = unwrap(v1, v2); v3 = unwrap(v2, v3)
    }
    if (easing === 'bezier') {
      result[field] = v1 + (v2 - v1) * cubicBezierProgress(t, b.bezier)
    } else if (easing === 'linear') {
      result[field] = v1 + (v2 - v1) * t
    } else if (easing === 'ease-in') {
      const et = t * t * t
      result[field] = v1 + (v2 - v1) * et
    } else if (easing === 'ease-out') {
      const inv = 1 - t
      const et = 1 - inv * inv * inv
      result[field] = v1 + (v2 - v1) * et
    } else if (easing === 'ease-in-out') {
      const et = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      result[field] = v1 + (v2 - v1) * et
    } else if (Math.abs(v2 - v1) < 1e-6) {
      result[field] = v1
    } else {
      // 'smooth': Monotone-clamped cubic Hermite spline (continuous C1 velocity, zero extremum overshoot)
      const s0 = dtPrev > 1e-6 ? (v1 - v0) / dtPrev : 0
      const s1 = span > 1e-6 ? (v2 - v1) / span : 0
      const s2 = dtNext > 1e-6 ? (v3 - v2) / dtNext : 0
      const rawSlope1 = spanLeft > 1e-6 ? (v2 - v0) / spanLeft : 0
      const rawSlope2 = spanRight > 1e-6 ? (v3 - v1) / spanRight : 0
      const m1 = clampMonotoneSlope(s0, s1, rawSlope1) * span
      const m2 = clampMonotoneSlope(s1, s2, rawSlope2) * span
      const t2 = t * t, t3 = t2 * t
      result[field] = (2 * t3 - 3 * t2 + 1) * v1 + (t3 - 2 * t2 + t) * m1
        + (-2 * t3 + 3 * t2) * v2 + (t3 - t2) * m2
    }
  }
  if (result.zOrder !== undefined && Math.abs(result.zOrder) < 1e-6) {
    delete result.zOrder
  }
  return result
}

function mirrorEndpoint(anchor: BoneKeyframe, neighbor: BoneKeyframe): BoneKeyframe {
  const dt = neighbor.time - anchor.time
  return {
    ...anchor,
    time: anchor.time - dt,
    x: 2 * anchor.x - neighbor.x,
    y: 2 * anchor.y - neighbor.y,
    rotation: 2 * anchor.rotation - unwrap(anchor.rotation, neighbor.rotation),
    scaleX: 2 * (anchor.scaleX ?? 1) - (neighbor.scaleX ?? 1),
    scaleY: 2 * (anchor.scaleY ?? 1) - (neighbor.scaleY ?? 1),
    ...(anchor.zOrder !== undefined || neighbor.zOrder !== undefined
      ? { zOrder: 2 * (anchor.zOrder ?? 0) - (neighbor.zOrder ?? 0) }
      : {})
  }
}

export function sampleBonePose(rig: LayerRig, id: string, time: number): BonePose {
  const raw = rig.tracks[id] ?? []
  if (!raw.length) return REST
  if (raw.length === 1) return raw[0]
  const duration = rig.duration || 1
  const t = rig.loop ? ((time % duration) + duration) % duration : Math.max(0, Math.min(duration, time))
  // The matching key at duration aliases the first key, not its previous neighbour.
  const first = raw[0], last = raw[raw.length - 1]
  const closed = rig.loop && first.time === 0 && last.time === duration
    && fields.every((field) => Math.abs(value(first, field) - value(last, field)) < 1e-8)
  const keys = closed ? raw.slice(0, -1) : raw
  const n = keys.length
  if (n === 1) return keys[0]
  if (!rig.loop && t <= keys[0].time) return keys[0]
  if (!rig.loop && t >= keys[n - 1].time) return keys[n - 1]
  const next = keys.findIndex((key) => key.time > t)
  const i = next < 0 ? n - 1 : next - 1
  const at = (index: number): BoneKeyframe => {
    if (rig.loop) return shifted(keys[((index % n) + n) % n], Math.floor(index / n) * duration)
    if (index < 0) return mirrorEndpoint(keys[0], keys[1])
    if (index >= n) return mirrorEndpoint(keys[n - 1], keys[n - 2])
    return keys[index]
  }
  return interpolate([at(i - 1), at(i), at(i + 1), at(i + 2)], t)
}
