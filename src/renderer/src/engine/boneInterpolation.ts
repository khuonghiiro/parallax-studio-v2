import type { BoneKeyframe, BonePose, LayerRig } from '@shared/layerRig'

const REST: BonePose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
const fields = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const
const value = (k: BonePose, field: typeof fields[number]) => k[field] ?? 1
const shifted = (key: BoneKeyframe, offset: number) => ({ ...key, time: key.time + offset })

function unwrap(ref: number, angle: number): number {
  return ref + ((angle - ref + 180) % 360 + 360) % 360 - 180
}

/** Hermite tangents use seconds, so unequal key spacing cannot introduce speed jumps. */
function interpolate(keys: BoneKeyframe[], time: number): BonePose {
  const [a, b, c, d] = keys
  if (b.easing === 'hold') return b
  const span = c.time - b.time
  const t = Math.max(0, Math.min(1, (time - b.time) / span))
  const result = { ...REST }
  for (const field of fields) {
    let [v0, v1, v2, v3] = keys.map((k) => value(k, field))
    if (field === 'rotation' && b.easing === 'smooth') {
      v0 = unwrap(v1, v0); v2 = unwrap(v1, v2); v3 = unwrap(v2, v3)
    }
    if (b.easing === 'linear') result[field] = v1 + (v2 - v1) * t
    else {
      const m1 = (v2 - v0) / (c.time - a.time) * span
      const m2 = (v3 - v1) / (d.time - b.time) * span
      const t2 = t * t, t3 = t2 * t
      result[field] = (2 * t3 - 3 * t2 + 1) * v1 + (t3 - 2 * t2 + t) * m1
        + (-2 * t3 + 3 * t2) * v2 + (t3 - t2) * m2
    }
  }
  return result
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
    if (index < 0) return { ...keys[0], time: 2 * keys[0].time - keys[1].time }
    if (index >= n) return { ...keys[n - 1], time: 2 * keys[n - 1].time - keys[n - 2].time }
    return keys[index]
  }
  return interpolate([at(i - 1), at(i), at(i + 1), at(i + 2)], t)
}
