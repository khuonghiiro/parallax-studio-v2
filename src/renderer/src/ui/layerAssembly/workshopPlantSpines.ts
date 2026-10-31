import {
  PLANT_SPINE_PRESETS,
  type PlantSpine,
  type PlantSpinePoint,
  type PlantSpinePresetId
} from '@shared/plantSpine'
import type { LayerComposite } from './types'
import { validatePlantMotion } from '../../engine/plantMotion'

/** auto = layer nằm dưới nét vẽ · selected = layer đang chọn · all = toàn bộ layer. */
export type PlantSpineTarget = 'auto' | 'selected' | 'all'

/** Hướng mọc mặc định khi tạo tự động trục xương gió: mọc lên, vươn ngang, hoặc rủ từ trên xuống. */
export type PlantSpineDirection = 'up' | 'horizontal' | 'down'

export type WindWeatherPresetId = 'breeze' | 'moderate' | 'strong' | 'storm'

export interface WindWeatherPreset {
  id: WindWeatherPresetId
  label: string
  meta: string
  hint: string
  params: Pick<PlantSpine, 'amplitude' | 'speed' | 'stiffness' | 'flexibility' | 'turbulence' | 'verticalBob'>
}

export const WIND_WEATHER_PRESETS: WindWeatherPreset[] = [
  {
    id: 'breeze',
    label: 'Hiu hiu',
    meta: '±6° · 0.55/s',
    hint: 'Gió thoảng nhẹ nhàng cho lá cây, tóc hoặc tà áo đứng yên',
    params: { amplitude: 6, speed: 0.55, stiffness: 0.35, flexibility: 0.28, turbulence: 0.1, verticalBob: 0.03 }
  },
  {
    id: 'moderate',
    label: 'Gió vừa',
    meta: '±13° · 0.85/s',
    hint: 'Gió tự nhiên ngoài trời cho tán cây, bụi cỏ, dây leo và vải mềm',
    params: { amplitude: 13, speed: 0.85, stiffness: 0.28, flexibility: 0.45, turbulence: 0.25, verticalBob: 0.07 }
  },
  {
    id: 'strong',
    label: 'Gió mạnh',
    meta: '±22° · 1.25/s',
    hint: 'Gió thổi mạnh có độ giật rõ và ngọn phất nhanh',
    params: { amplitude: 22, speed: 1.25, stiffness: 0.22, flexibility: 0.65, turbulence: 0.52, verticalBob: 0.14 }
  },
  {
    id: 'storm',
    label: 'Gió lốc',
    meta: '±32° · 1.85/s',
    hint: 'Gió bão giật dồn dập, biên độ uốn lớn và nhún thân rõ rệt',
    params: { amplitude: 32, speed: 1.85, stiffness: 0.18, flexibility: 0.85, turbulence: 0.82, verticalBob: 0.22 }
  }
]

export type PlantSpineAction =
  | { action: 'add'; spine: PlantSpine }
  | { action: 'update'; id: string; patch: Partial<Omit<PlantSpine, 'id'>> }
  | { action: 'delete'; id: string }
  | { action: 'clear' }
  /** So le nhịp (lệch pha theo tỉ lệ vàng trong khoảng `spread` giây) hoặc đồng bộ toàn bộ xương về pha 0. */
  | { action: 'phase'; mode: 'stagger' | 'sync'; spread?: number }
  /** Sao chép nhịp (motion riêng hoặc thông số gió) của xương `id` sang các xương khác, tuỳ chọn lệch pha `stagger` giây. */
  | { action: 'copy-motion'; id: string; targetIds?: string[]; stagger?: number }
  /** Áp nhanh cấp độ gió / hướng nghiêng lên một trục hoặc toàn bộ các trục đang bật (tự so le pha nếu nhiều trục). */
  | {
      action: 'apply-weather'
      patch: Partial<Omit<PlantSpine, 'id' | 'points' | 'layerIds' | 'name'>>
      spineId?: string
      stagger?: boolean
    }

function perpendicularDistance(p: PlantSpinePoint, a: PlantSpinePoint, b: PlantSpinePoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
}

function rdpSimplify(points: PlantSpinePoint[], tolerance: number): PlantSpinePoint[] {
  if (points.length <= 2) return points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
  let maxDist = 0
  let index = 0
  const last = points.length - 1
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last])
    if (d > maxDist) {
      maxDist = d
      index = i
    }
  }
  if (maxDist <= tolerance) {
    return [points[0], points[last]].map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))
  }
  const left = rdpSimplify(points.slice(0, index + 1), tolerance)
  const right = rdpSimplify(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

/**
 * Đảm bảo khoảng cách giữa các khớp uốn không quá dài (mặc định tối đa 65px).
 * Nếu người dùng vẽ một đường thẳng dài, tự động chia đều đoạn đó thành các khớp ô vuông.
 */
export function ensureJointSpacing(points: PlantSpinePoint[], maxSegmentLength = 65): PlantSpinePoint[] {
  if (points.length < 2) return points
  const out: PlantSpinePoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    if (dist > maxSegmentLength) {
      const segments = Math.ceil(dist / maxSegmentLength)
      for (let s = 1; s < segments; s++) {
        const t = s / segments
        out.push({
          x: Math.round(a.x + (b.x - a.x) * t),
          y: Math.round(a.y + (b.y - a.y) * t)
        })
      }
    }
    out.push(b)
  }
  return out
}

/** Ramer–Douglas–Peucker + phân bổ đều khớp uốn. */
export function simplifyStroke(
  points: PlantSpinePoint[],
  tolerance = 2.5,
  maxSegmentLength = 65
): PlantSpinePoint[] {
  const simplified = rdpSimplify(points, tolerance)
  return ensureJointSpacing(simplified, maxSegmentLength)
}

/** Nhân đôi số khớp uốn của xương (chèn trung điểm vào giữa mỗi đoạn). */
export function subdividePlantSpine(points: PlantSpinePoint[]): PlantSpinePoint[] {
  if (points.length < 2) return points
  const out: PlantSpinePoint[] = []
  for (let i = 0; i < points.length; i++) {
    out.push(points[i])
    if (i < points.length - 1) {
      const next = points[i + 1]
      out.push({
        x: Math.round((points[i].x + next.x) / 2),
        y: Math.round((points[i].y + next.y) / 2)
      })
    }
  }
  return out
}

/** Phân bố lại các khớp uốn cách đều nhau dọc theo tổng chiều dài xương. */
export function resamplePlantSpinePoints(points: PlantSpinePoint[], targetSpacing = 55): PlantSpinePoint[] {
  if (points.length < 2) return points
  const total = strokeLength(points)
  if (total < 10) return points
  const count = Math.max(3, Math.min(16, Math.round(total / targetSpacing) + 1))
  return setPlantSpineJointCount(points, count)
}

/** Đặt chính xác số lượng khớp uốn cho xương motion (tối thiểu 2 điểm, tối đa 32 điểm). */
export function setPlantSpineJointCount(points: PlantSpinePoint[], targetCount: number): PlantSpinePoint[] {
  if (points.length < 2) return points
  const count = Math.max(2, Math.min(32, Math.round(targetCount)))
  if (count === points.length) return points
  const total = strokeLength(points)
  if (total < 1e-4) {
    return Array.from({ length: count }, () => ({ ...points[0] }))
  }
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const out: PlantSpinePoint[] = []
  let j = 1
  for (let k = 0; k < count; k++) {
    const s = (total * k) / (count - 1)
    while (j < points.length - 1 && cum[j] < s) j++
    const seg = cum[j] - cum[j - 1] || 1
    const t = Math.min(1, Math.max(0, (s - cum[j - 1]) / seg))
    out.push({
      x: Math.round(points[j - 1].x + (points[j].x - points[j - 1].x) * t),
      y: Math.round(points[j - 1].y + (points[j].y - points[j - 1].y) * t)
    })
  }
  return out
}

export function strokeLength(points: PlantSpinePoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return total
}

/** Chọn layer gắn vào xương: layer dưới nét vẽ (auto), layer đang chọn, hoặc toàn bộ layer. */
export function resolveSpineLayerIds(
  composite: LayerComposite,
  target: PlantSpineTarget,
  selectedIds: string[],
  hitIds: string[] = []
): string[] {
  const all = composite.layers.map((l) => l.id)
  if (target === 'all') return all
  const known = (ids: string[]) => ids.filter((id) => composite.layers.some((l) => l.id === id))
  if (target === 'auto') {
    const hits = known(hitIds)
    if (hits.length) return hits
  }
  const picked = known(selectedIds)
  return picked.length ? picked : all
}

export function createPlantSpine(options: {
  points: PlantSpinePoint[]
  layerIds: string[]
  preset?: PlantSpinePresetId
  name?: string
  id?: string
}): PlantSpine {
  const preset = PLANT_SPINE_PRESETS.find((p) => p.id === options.preset) ?? PLANT_SPINE_PRESETS[1]
  return {
    id: options.id ?? `spine-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: options.name ?? `Trục ${preset.label}`,
    points: options.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    layerIds: [...options.layerIds],
    enabled: true,
    phaseOffset: 0,
    ...preset.params
  }
}

/**
 * Tự động sinh đường trục xương 4 điểm theo 3 hướng mọc:
 * - `'up'`: Gốc dưới → Ngọn trên (cây, bụi cỏ, bông hoa)
 * - `'horizontal'`: Gốc trái → Ngọn phải (cành ngang, cờ bay, khăn choàng)
 * - `'down'`: Gốc trên → Đuôi rủ xuống (dây leo, mái tóc dài, vạt áo, tua đèn)
 */
export function buildAutoPlantSpinePoints(
  composite: LayerComposite,
  targetLayerIds: string[],
  existingCount = 0,
  direction: PlantSpineDirection = 'up'
): PlantSpinePoint[] {
  const targetLayers = composite.layers.filter((l) => targetLayerIds.includes(l.id))
  const pool = targetLayers.length > 0 ? targetLayers : composite.layers
  const canvasW = composite.width || 600
  const canvasH = composite.height || 600

  let sumX = 0
  let sumY = 0
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  if (pool.length === 0) {
    minX = -Math.round(canvasW * 0.32)
    maxX = Math.round(canvasW * 0.32)
    minY = -Math.round(canvasH * 0.34)
    maxY = Math.round(canvasH * 0.34)
  } else {
    for (const l of pool) {
      sumX += l.x
      sumY += l.y
      const estHalfW = Math.max(55, Math.round(125 * (l.scale || 1)))
      const estHalfH = Math.max(55, Math.round(130 * (l.scale || 1)))
      if (l.x - estHalfW < minX) minX = l.x - estHalfW
      if (l.x + estHalfW > maxX) maxX = l.x + estHalfW
      if (l.y - estHalfH < minY) minY = l.y - estHalfH
      if (l.y + estHalfH > maxY) maxY = l.y + estHalfH
    }
  }

  const avgX = pool.length ? Math.round(sumX / pool.length) : 0
  const avgY = pool.length ? Math.round(sumY / pool.length) : 0
  const offset = existingCount > 0 && pool.length > 1 ? ((existingCount % 3) - 1) * 18 : 0

  if (direction === 'horizontal') {
    const leftX = Math.max(-Math.round(canvasW * 0.44), Math.min(-40, Math.round(minX * 0.85)))
    const rightX = Math.min(Math.round(canvasW * 0.44), Math.max(40, Math.round(maxX * 0.85)))
    const spanX = Math.max(110, rightX - leftX)
    const startX = Math.round((leftX + rightX) / 2 - spanX / 2)
    const endX = Math.round((leftX + rightX) / 2 + spanX / 2)
    const rootY = avgY + offset
    return [
      { x: startX, y: rootY },
      { x: Math.round(startX + spanX * 0.33), y: rootY },
      { x: Math.round(startX + spanX * 0.67), y: rootY },
      { x: endX, y: rootY }
    ]
  }

  const bottomY = Math.min(Math.round(canvasH * 0.44), Math.max(40, Math.round(maxY * 0.85)))
  const topY = Math.max(-Math.round(canvasH * 0.44), Math.min(-40, Math.round(minY * 0.85)))
  const spanY = Math.max(110, bottomY - topY)
  const rY = Math.round((bottomY + topY) / 2 + spanY / 2)
  const tY = Math.round((bottomY + topY) / 2 - spanY / 2)
  const rootX = avgX + offset

  if (direction === 'down') {
    return [
      { x: rootX, y: tY },
      { x: rootX, y: Math.round(tY + spanY * 0.33) },
      { x: rootX, y: Math.round(tY + spanY * 0.67) },
      { x: rootX, y: rY }
    ]
  }

  return [
    { x: rootX, y: rY },
    { x: rootX, y: Math.round(rY - spanY * 0.33) },
    { x: rootX, y: Math.round(rY - spanY * 0.67) },
    { x: rootX, y: tY }
  ]
}

export function validatePlantSpine(spine: PlantSpine, composite: LayerComposite): void {
  if (!Array.isArray(spine.points) || spine.points.length < 2) {
    throw new Error('Trục gió cần ít nhất 2 điểm (vẽ từ gốc tới ngọn)')
  }
  if (spine.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error('Toạ độ điểm trục gió không hợp lệ')
  }
  if (strokeLength(spine.points) < 8) throw new Error('Đường trục quá ngắn, hãy vẽ dài hơn')
  const known = new Set(composite.layers.map((l) => l.id))
  if (!spine.layerIds.length || spine.layerIds.some((id) => !known.has(id))) {
    throw new Error('Trục gió phải gắn vào ít nhất 1 layer có trong cụm')
  }
  for (const key of ['amplitude', 'speed', 'stiffness', 'flexibility', 'turbulence'] as const) {
    if (!Number.isFinite(spine[key])) throw new Error(`Thông số ${key} không hợp lệ`)
  }
  if (spine.motion) validatePlantMotion(spine.motion)
}

/** Tắt chuyển động đung đưa cũ của layer vừa gắn xương để không bị lắc chồng 2 lần. */
function muteLegacyMotion(composite: LayerComposite, layerIds: string[]): LayerComposite['layers'] {
  const ids = new Set(layerIds)
  return composite.layers.map((l) =>
    ids.has(l.id) && l.motion.type !== 'none' ? { ...l, motion: { ...l.motion, type: 'none' } } : l
  )
}

const WIND_KEYS = ['amplitude', 'speed', 'stiffness', 'flexibility', 'turbulence', 'lean', 'verticalBob'] as const
const GOLDEN = 0.6180339887
const round2 = (v: number) => Math.round(v * 100) / 100

function applyPhase(spines: PlantSpine[], mode: 'stagger' | 'sync', spread = 1.2): PlantSpine[] {
  const s = Math.max(0, Math.min(3, spread))
  return spines.map((sp, i) => ({ ...sp, phaseOffset: mode === 'sync' ? 0 : round2(((i * GOLDEN) % 1) * s) }))
}

function copyMotion(spines: PlantSpine[], id: string, targetIds?: string[], stagger = 0): PlantSpine[] {
  const source = spines.find((s) => s.id === id)
  if (!source) throw new Error(`Không tìm thấy trục gió "${id}"`)
  const targets = spines.filter((s) => s.id !== id && (!targetIds?.length || targetIds.includes(s.id)))
  if (!targets.length) throw new Error('Cần ít nhất 1 trục gió khác để áp nhịp')
  const wind = Object.fromEntries(WIND_KEYS.map((k) => [k, source[k]]))
  return spines.map((s) => {
    const order = targets.findIndex((t) => t.id === s.id)
    if (order < 0) return s
    const phase = stagger > 0 ? { phaseOffset: round2(((source.phaseOffset ?? 0) + (order + 1) * stagger) % 3) } : {}
    return { ...s, ...wind, motion: source.motion ? structuredClone(source.motion) : undefined, ...phase }
  })
}

export function applyPlantSpineAction(composite: LayerComposite, action: PlantSpineAction): LayerComposite {
  const spines = composite.plantSpines ?? []
  if (action.action === 'clear') return { ...composite, plantSpines: [] }
  if (action.action === 'phase') return { ...composite, plantSpines: applyPhase(spines, action.mode, action.spread) }
  if (action.action === 'copy-motion') {
    return { ...composite, plantSpines: copyMotion(spines, action.id, action.targetIds, action.stagger) }
  }
  if (action.action === 'apply-weather') {
    if (!spines.length) return composite
    const nextSpines = spines.map((sp, idx) => {
      if (action.spineId && sp.id !== action.spineId) return sp
      if (!action.spineId && sp.enabled === false) return sp
      const autoPhase =
        action.stagger && !action.spineId && spines.length > 1
          ? { phaseOffset: round2(((idx * GOLDEN) % 1) * 1.2) }
          : {}
      const updated = { ...sp, ...action.patch, ...autoPhase, id: sp.id }
      validatePlantSpine(updated, composite)
      return updated
    })
    return { ...composite, plantSpines: nextSpines }
  }
  if (action.action === 'delete') {
    if (!spines.some((s) => s.id === action.id)) throw new Error(`Không tìm thấy trục gió "${action.id}"`)
    return { ...composite, plantSpines: spines.filter((s) => s.id !== action.id) }
  }
  if (action.action === 'add') {
    validatePlantSpine(action.spine, composite)
    if (spines.some((s) => s.id === action.spine.id)) throw new Error(`Trùng ID trục gió "${action.spine.id}"`)
    return {
      ...composite,
      layers: muteLegacyMotion(composite, action.spine.layerIds),
      plantSpines: [...spines, action.spine]
    }
  }
  const current = spines.find((s) => s.id === action.id)
  if (!current) throw new Error(`Không tìm thấy trục gió "${action.id}"`)
  const next = { ...current, ...action.patch, id: current.id }
  validatePlantSpine(next, composite)
  const added = next.layerIds.filter((id) => !current.layerIds.includes(id))
  return {
    ...composite,
    layers: added.length ? muteLegacyMotion(composite, added) : composite.layers,
    plantSpines: spines.map((s) => (s.id === current.id ? next : s))
  }
}

/** Gỡ tham chiếu tới layer đã bị xoá; bỏ trục không còn layer nào. */
export function prunePlantSpines(composite: LayerComposite): LayerComposite {
  if (!composite.plantSpines?.length) return composite
  const known = new Set(composite.layers.map((l) => l.id))
  const pruned = composite.plantSpines
    .map((s) => ({ ...s, layerIds: s.layerIds.filter((id) => known.has(id)) }))
    .filter((s) => s.layerIds.length > 0)
  return { ...composite, plantSpines: pruned }
}
