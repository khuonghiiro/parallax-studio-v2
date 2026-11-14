import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { SkinBinding } from './layerSkinning'
import { computeMeshCorridor, computeMeshCorridorJs } from './meshCorridor'

/** Số mẫu chia đều theo chiều dài xương — đủ mượt cho uốn cong mà vẫn rẻ mỗi khung hình. */
export const PLANT_SPINE_SAMPLES = 32

/** Mỗi đỉnh 5 số: [đoạn (-1 = dưới gốc/ngoài vùng, đứng yên), t, lệchX, lệchY, trọng số bán kính]. */
export const PLANT_PROJ_STRIDE = 5

export interface LayerPlantProjection {
  key: string
  world: Float32Array
  perSpine: Float32Array[]
  packedPerSpine: Float32Array
}

interface Projection {
  seg: number
  t: number
  dist: number
}

const restCache = new WeakMap<PlantSpinePoint[], PlantSpinePoint[]>()
const projectionCache = new WeakMap<Float32Array, LayerPlantProjection>()

function rotate(x: number, y: number, deg: number): PlantSpinePoint {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** Chia lại đường vẽ tay thành `count + 1` điểm cách đều nhau. */
export function resamplePolyline(
  points: PlantSpinePoint[],
  count = PLANT_SPINE_SAMPLES
): PlantSpinePoint[] {
  if (points.length < 2) return points.map((p) => ({ ...p }))
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const total = cum[cum.length - 1]
  if (total < 1e-6) return [{ ...points[0] }, { ...points[points.length - 1] }]
  const out: PlantSpinePoint[] = []
  let j = 1
  for (let k = 0; k <= count; k++) {
    const s = (total * k) / count
    while (j < points.length - 1 && cum[j] < s) j++
    const seg = cum[j] - cum[j - 1] || 1
    const t = Math.min(1, Math.max(0, (s - cum[j - 1]) / seg))
    out.push({
      x: points[j - 1].x + (points[j].x - points[j - 1].x) * t,
      y: points[j - 1].y + (points[j].y - points[j - 1].y) * t
    })
  }
  return out
}

export function restSamples(spine: PlantSpine): PlantSpinePoint[] {
  let rest = restCache.get(spine.points)
  if (!rest) {
    rest = resamplePolyline(spine.points)
    restCache.set(spine.points, rest)
  }
  return rest
}

function projectOnRest(
  rest: PlantSpinePoint[],
  x: number,
  y: number,
  loSeg = 0,
  hiSeg = rest.length - 2
): Projection {
  let best: Projection = { seg: 0, t: 0, dist: Infinity }
  const last = rest.length - 2
  const from = Math.max(0, Math.min(last, loSeg))
  const to = Math.max(from, Math.min(last, hiSeg))
  for (let i = from; i <= to; i++) {
    const a = rest[i]
    const b = rest[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2
    const lo = i === 0 ? -Infinity : 0
    const hi = i === last ? Infinity : 1
    t = Math.min(hi, Math.max(lo, t))
    const cx = a.x + dx * Math.min(1, Math.max(0, t))
    const cy = a.y + dy * Math.min(1, Math.max(0, t))
    const dist = Math.hypot(x - cx, y - cy)
    if (dist < best.dist) best = { seg: i, t, dist }
  }
  return best
}

function projectionKey(
  binding: SkinBinding,
  spines: PlantSpine[],
  indices?: ArrayLike<number>
): string {
  const b = `v5:${binding.x},${binding.y},${binding.rotation},${binding.scale},${binding.scaleX ?? 1},${binding.scaleY ?? 1}:${indices?.length ?? 0}`
  return (
    b +
    '|' +
    spines.map((s) => `${s.reach ?? 0}:${s.points.map((p) => `${p.x},${p.y}`).join(';')}`).join('|')
  )
}

function buildSpineProjectionData(
  world: Float32Array,
  spine: PlantSpine,
  indices: ArrayLike<number> | undefined,
  forceJs: boolean
): Float32Array {
  const count = world.length >> 1
  const rest = restSamples(spine)
  const data = new Float32Array(count * PLANT_PROJ_STRIDE)
  const reach = spine.reach ?? 0
  const useCorridor = Boolean(indices && indices.length >= 3 && count > 3)
  const corridor = useCorridor
    ? forceJs
      ? computeMeshCorridorJs(world, indices!, rest, reach)
      : computeMeshCorridor(world, indices!, rest, reach)
    : null

  for (let i = 0; i < count; i++) {
    const o = i * PLANT_PROJ_STRIDE
    if (rest.length < 2) {
      data[o] = -1
      continue
    }
    if (useCorridor) {
      if (corridor) {
        if (corridor.weights[i] <= 1e-4) {
          data[o] = -1
          continue
        }
      } else if (reach > 0) {
        data[o] = -1
        continue
      }
    }
    const x = world[i * 2]
    const y = world[i * 2 + 1]
    const pad = corridor && corridor.geoDist[i] <= corridor.avgCoreEdge * 2 ? 2 : 0
    const { seg, t: rawT, dist } = corridor
      ? projectOnRest(rest, x, y, corridor.segMin[i] - pad, corridor.segMax[i] + pad)
      : projectOnRest(rest, x, y)
    if (!corridor && rawT < 0 && seg === 0) {
      data[o] = -1
      continue
    }
    const t = corridor ? Math.max(0, Math.min(1, rawT)) : rawT
    let w = corridor ? corridor.weights[i] : 1
    if (!corridor && reach > 0) {
      const k = Math.min(1, Math.max(0, (reach - dist) / (reach * 0.5)))
      w = k * k * (3 - 2 * k)
    }
    if (w <= 1e-4) {
      data[o] = -1
      continue
    }
    const a = rest[seg]
    const b = rest[seg + 1]
    data[o] = seg
    data[o + 1] = t
    data[o + 2] = x - (a.x + (b.x - a.x) * t)
    data[o + 3] = y - (a.y + (b.y - a.y) * t)
    data[o + 4] = w
  }
  return data
}

function buildProjection(
  positions: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  key: string,
  indices: ArrayLike<number> | undefined,
  forceJs: boolean
): LayerPlantProjection {
  const count = positions.length / 3
  const scale = binding.scale ?? 1
  const sx = scale * (binding.scaleX ?? 1)
  const sy = scale * (binding.scaleY ?? 1)
  const rot = binding.rotation ?? 0
  const world = new Float32Array(count * 2)
  for (let i = 0; i < count; i++) {
    const p = rotate(positions[i * 3] * sx, -positions[i * 3 + 1] * sy, rot)
    world[i * 2] = p.x + (binding.x ?? 0)
    world[i * 2 + 1] = p.y + (binding.y ?? 0)
  }
  const perSpine = spines.map((spine) => buildSpineProjectionData(world, spine, indices, forceJs))
  if (perSpine.length > 1) {
    for (let i = 0; i < count; i++) {
      const o = i * PLANT_PROJ_STRIDE
      let sumW = 0
      let activeCount = 0
      for (let k = 0; k < perSpine.length; k++) {
        if (perSpine[k][o] >= 0 && perSpine[k][o + 4] > 0) {
          sumW += perSpine[k][o + 4]
          activeCount++
        }
      }
      if (activeCount > 1 && sumW > 1) {
        const env = Math.min(1, sumW)
        let rawSum = 0
        const raws = new Float32Array(perSpine.length)
        for (let k = 0; k < perSpine.length; k++) {
          const d = perSpine[k]
          if (d[o] >= 0 && d[o + 4] > 0) {
            const dist2 = d[o + 2] * d[o + 2] + d[o + 3] * d[o + 3]
            const aff = 1 / (144 + dist2) ** 2
            raws[k] = d[o + 4] * aff
            rawSum += raws[k]
          }
        }
        if (rawSum > 0) {
          for (let k = 0; k < perSpine.length; k++) {
            if (perSpine[k][o] >= 0) perSpine[k][o + 4] = (raws[k] / rawSum) * env
          }
        }
      }
    }
  }
  const perLen = count * PLANT_PROJ_STRIDE
  const packedPerSpine = new Float32Array(perSpine.length * perLen)
  for (let k = 0; k < perSpine.length; k++) {
    packedPerSpine.set(perSpine[k], k * perLen)
  }
  return { key, world, perSpine, packedPerSpine }
}

export function getOrBuildLayerProjection(
  owner: Float32Array,
  binding: SkinBinding,
  spines: PlantSpine[],
  indices?: ArrayLike<number>,
  forceJs = false
): LayerPlantProjection {
  const key = projectionKey(binding, spines, indices)
  if (forceJs) {
    return buildProjection(owner, binding, spines, key, indices, true)
  }
  let proj = projectionCache.get(owner)
  if (!proj || proj.key !== key) {
    proj = buildProjection(owner, binding, spines, key, indices, false)
    projectionCache.set(owner, proj)
  }
  return proj
}
