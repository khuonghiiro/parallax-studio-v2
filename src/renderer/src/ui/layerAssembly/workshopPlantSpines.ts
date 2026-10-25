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

export type PlantSpineAction =
  | { action: 'add'; spine: PlantSpine }
  | { action: 'update'; id: string; patch: Partial<Omit<PlantSpine, 'id'>> }
  | { action: 'delete'; id: string }
  | { action: 'clear' }
  /** So le nhịp (lệch pha theo tỉ lệ vàng trong khoảng `spread` giây) hoặc đồng bộ toàn bộ xương về pha 0. */
  | { action: 'phase'; mode: 'stagger' | 'sync'; spread?: number }
  /** Sao chép nhịp (motion riêng hoặc thông số gió) của xương `id` sang các xương khác, tuỳ chọn lệch pha `stagger` giây. */
  | { action: 'copy-motion'; id: string; targetIds?: string[]; stagger?: number }

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
 * Nếu người dùng vẽ một đường thẳng dài, tự động chia đều đoạn đó thành các khớp ô vuông
 * để người dùng có đầy đủ các điểm căn chỉnh uốn nắn thân cây.
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

/** Ramer–Douglas–Peucker + phân bổ đều khớp uốn: vừa khử rung tay vừa tự tạo các điểm ô vuông đều đặn theo chiều dài cành. */
export function simplifyStroke(
  points: PlantSpinePoint[],
  tolerance = 2.5,
  maxSegmentLength = 65
): PlantSpinePoint[] {
  const simplified = rdpSimplify(points, tolerance)
  return ensureJointSpacing(simplified, maxSegmentLength)
}

/**
 * Nhân đôi số khớp uốn của xương (chèn trung điểm vào giữa mỗi đoạn).
 * Giúp xương có nhiều khớp hơn để uốn cong mượt mà theo ý muốn.
 */
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

/**
 * Phân bố lại các khớp uốn cách đều nhau dọc theo tổng chiều dài xương.
 */
export function resamplePlantSpinePoints(points: PlantSpinePoint[], targetSpacing = 55): PlantSpinePoint[] {
  if (points.length < 2) return points
  const total = strokeLength(points)
  if (total < 10) return points
  const count = Math.max(3, Math.min(16, Math.round(total / targetSpacing) + 1))
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

/**
 * Đặt chính xác số lượng khớp uốn cho xương motion (tối thiểu 2 điểm, tối đa 32 điểm).
 * Dù tăng hay giảm số điểm, hàm sẽ phân bố lại các khớp cách đều nhau dọc theo đường cong hiện tại,
 * bảo toàn vị trí gốc và ngọn cũng như dáng uốn cong tổng thể của thân cây.
 */
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

/**
 * Chọn layer gắn vào xương: layer dưới nét vẽ (auto), layer đang chọn, hoặc toàn bộ layer
 * (kể cả biến thể đang ẩn để bật lên vẫn đung đưa). Không trúng gì thì rơi về lựa chọn kế tiếp.
 */
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
    name: options.name ?? `Xương ${preset.label}`,
    points: options.points.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    layerIds: [...options.layerIds],
    enabled: true,
    phaseOffset: 0,
    ...preset.params
  }
}

/**
 * Tự động sinh đường trục xương 4 điểm từ GỐC (dưới) lên NGỌN (trên) theo toạ độ của các layer đích
 * giúp người dùng bấm 1 nút là tạo ngay được chuyển động mới mà không cần tự kéo vẽ tay.
 */
export function buildAutoPlantSpinePoints(
  composite: LayerComposite,
  targetLayerIds: string[],
  existingCount = 0
): PlantSpinePoint[] {
  const targetLayers = composite.layers.filter((l) => targetLayerIds.includes(l.id))
  const pool = targetLayers.length > 0 ? targetLayers : composite.layers
  const canvasH = composite.height || 600

  if (pool.length === 0) {
    const halfSpan = Math.round(canvasH * 0.34)
    return [
      { x: 0, y: halfSpan },
      { x: 0, y: Math.round(halfSpan * 0.33) },
      { x: 0, y: -Math.round(halfSpan * 0.33) },
      { x: 0, y: -halfSpan }
    ]
  }

  let sumX = 0
  let minY = Infinity
  let maxY = -Infinity
  for (const l of pool) {
    sumX += l.x
    const estHalfH = Math.max(55, Math.round(130 * (l.scale || 1)))
    if (l.y - estHalfH < minY) minY = l.y - estHalfH
    if (l.y + estHalfH > maxY) maxY = l.y + estHalfH
  }
  const avgX = Math.round(sumX / pool.length)
  // Nếu tạo thêm nhiều xương trên cùng vị trí thì dịch nhẹ X để dễ phân biệt trên khung 2D
  const xOffset = existingCount > 0 && pool.length > 1 ? ((existingCount % 3) - 1) * 18 : 0
  const rootX = avgX + xOffset
  const bottomY = Math.min(Math.round(canvasH * 0.44), Math.max(40, Math.round(maxY * 0.85)))
  const topY = Math.max(-Math.round(canvasH * 0.44), Math.min(-40, Math.round(minY * 0.85)))
  const spanY = Math.max(110, bottomY - topY)
  const rY = Math.round((bottomY + topY) / 2 + spanY / 2)
  const tY = Math.round((bottomY + topY) / 2 - spanY / 2)

  return [
    { x: rootX, y: rY },
    { x: rootX, y: Math.round(rY - spanY * 0.33) },
    { x: rootX, y: Math.round(rY - spanY * 0.67) },
    { x: rootX, y: tY }
  ]
}

export function validatePlantSpine(spine: PlantSpine, composite: LayerComposite): void {
  if (!Array.isArray(spine.points) || spine.points.length < 2) {
    throw new Error('Xương motion cần ít nhất 2 điểm (vẽ từ gốc lên ngọn)')
  }
  if (spine.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error('Toạ độ điểm xương không hợp lệ')
  }
  if (strokeLength(spine.points) < 8) throw new Error('Đường xương quá ngắn, hãy vẽ dài hơn')
  const known = new Set(composite.layers.map((l) => l.id))
  if (!spine.layerIds.length || spine.layerIds.some((id) => !known.has(id))) {
    throw new Error('Xương motion phải gắn vào ít nhất 1 layer có trong cụm')
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
  if (!source) throw new Error(`Không tìm thấy xương motion "${id}"`)
  const targets = spines.filter((s) => s.id !== id && (!targetIds?.length || targetIds.includes(s.id)))
  if (!targets.length) throw new Error('Cần ít nhất 1 xương motion khác để áp nhịp')
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
  if (action.action === 'copy-motion') return { ...composite, plantSpines: copyMotion(spines, action.id, action.targetIds, action.stagger) }
  if (action.action === 'delete') {
    if (!spines.some((s) => s.id === action.id)) throw new Error(`Không tìm thấy xương motion "${action.id}"`)
    return { ...composite, plantSpines: spines.filter((s) => s.id !== action.id) }
  }
  if (action.action === 'add') {
    validatePlantSpine(action.spine, composite)
    if (spines.some((s) => s.id === action.spine.id)) throw new Error(`Trùng ID xương "${action.spine.id}"`)
    return {
      ...composite,
      layers: muteLegacyMotion(composite, action.spine.layerIds),
      plantSpines: [...spines, action.spine]
    }
  }
  const current = spines.find((s) => s.id === action.id)
  if (!current) throw new Error(`Không tìm thấy xương motion "${action.id}"`)
  const next = { ...current, ...action.patch, id: current.id }
  validatePlantSpine(next, composite)
  const added = next.layerIds.filter((id) => !current.layerIds.includes(id))
  return {
    ...composite,
    layers: added.length ? muteLegacyMotion(composite, added) : composite.layers,
    plantSpines: spines.map((s) => (s.id === current.id ? next : s))
  }
}

/** Gỡ tham chiếu tới layer đã bị xoá; bỏ xương không còn layer nào. */
export function prunePlantSpines(composite: LayerComposite): LayerComposite {
  if (!composite.plantSpines?.length) return composite
  const known = new Set(composite.layers.map((l) => l.id))
  const pruned = composite.plantSpines
    .map((s) => ({ ...s, layerIds: s.layerIds.filter((id) => known.has(id)) }))
    .filter((s) => s.layerIds.length > 0)
  return { ...composite, plantSpines: pruned }
}
