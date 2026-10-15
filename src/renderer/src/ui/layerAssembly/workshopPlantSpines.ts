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

function perpendicularDistance(p: PlantSpinePoint, a: PlantSpinePoint, b: PlantSpinePoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y)
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
}

/** Ramer–Douglas–Peucker: giữ dáng nét vẽ tay nhưng bỏ điểm thừa do rung chuột. */
export function simplifyStroke(points: PlantSpinePoint[], tolerance = 2.5): PlantSpinePoint[] {
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
  const left = simplifyStroke(points.slice(0, index + 1), tolerance)
  const right = simplifyStroke(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
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
    throw new Error('Xương thực vật cần ít nhất 2 điểm (vẽ từ gốc lên ngọn)')
  }
  if (spine.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error('Toạ độ điểm xương không hợp lệ')
  }
  if (strokeLength(spine.points) < 8) throw new Error('Đường xương quá ngắn, hãy vẽ dài hơn')
  const known = new Set(composite.layers.map((l) => l.id))
  if (!spine.layerIds.length || spine.layerIds.some((id) => !known.has(id))) {
    throw new Error('Xương thực vật phải gắn vào ít nhất 1 layer có trong cụm')
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

export function applyPlantSpineAction(composite: LayerComposite, action: PlantSpineAction): LayerComposite {
  const spines = composite.plantSpines ?? []
  if (action.action === 'clear') return { ...composite, plantSpines: [] }
  if (action.action === 'delete') {
    if (!spines.some((s) => s.id === action.id)) throw new Error(`Không tìm thấy xương thực vật "${action.id}"`)
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
  if (!current) throw new Error(`Không tìm thấy xương thực vật "${action.id}"`)
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
