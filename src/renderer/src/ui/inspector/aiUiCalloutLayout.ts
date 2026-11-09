/**
 * Bố cục nhãn chú thích (callout) cho hiệu ứng quét AI UI Inspector.
 *
 * Mục tiêu: nhãn KHÔNG BAO GIỜ đè lên nhau hay đè lên vùng vừa quét. Nhãn được xếp thành cột bên trái/phải
 * vùng quét (hoặc sát mép màn hình khi thiếu chỗ), giải xung đột theo trục dọc, và nối với phần tử bằng
 * đường dẫn nét đứt gấp khúc vuông góc (ngang → dọc → ngang).
 */

export interface CalloutBox {
  left: number
  top: number
  width: number
  height: number
}

export interface CalloutTarget {
  idx: number
  bounds: CalloutBox
}

export interface CalloutPlacement {
  idx: number
  side: 'left' | 'right'
  label: CalloutBox
  /** Điểm neo trên phần tử */
  anchor: { x: number; y: number }
  /** Polyline vuông góc: neo → khuỷu ngang → khuỷu dọc → mép nhãn */
  points: Array<[number, number]>
  length: number
  compact: boolean
}

export interface CalloutLayoutOptions {
  labelWidth?: number
  labelHeight?: number
  compactHeight?: number
  gap?: number
  margin?: number
  gutter?: number
  /** Vùng cấm đặt nhãn (toast, HUD…) */
  reserved?: CalloutBox[]
}

interface Viewport {
  width: number
  height: number
}

interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

const toRect = (b: CalloutBox): Rect => ({ left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height })

function unionRects(rects: Rect[]): Rect {
  return rects.reduce((acc, r) => ({
    left: Math.min(acc.left, r.left),
    top: Math.min(acc.top, r.top),
    right: Math.max(acc.right, r.right),
    bottom: Math.max(acc.bottom, r.bottom)
  }))
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

function centerOf(b: CalloutBox): { x: number; y: number } {
  return { x: b.left + b.width * 0.5, y: b.top + b.height * 0.5 }
}

/** Gán bên trái/phải cho từng phần tử dựa trên khoảng trống còn lại quanh vùng quét. */
function assignSides(
  targets: CalloutTarget[],
  region: Rect,
  viewport: Viewport,
  need: number,
  margin: number
): Map<number, 'left' | 'right'> {
  const spaceLeft = region.left - margin
  const spaceRight = viewport.width - region.right - margin
  const canLeft = spaceLeft >= need
  const canRight = spaceRight >= need
  const midX = (region.left + region.right) * 0.5
  const sides = new Map<number, 'left' | 'right'>()
  for (const t of targets) {
    let side: 'left' | 'right'
    if (canLeft && canRight) side = centerOf(t.bounds).x < midX ? 'left' : 'right'
    else if (canLeft) side = 'left'
    else if (canRight) side = 'right'
    else side = spaceLeft > spaceRight ? 'left' : 'right'
    sides.set(t.idx, side)
  }
  return sides
}

/** Giải xung đột dọc trong 1 cột: giữ nhãn gần tâm phần tử nhất có thể nhưng không chồng nhau. */
export function resolveColumn(desired: number[], h: number, gap: number, minY: number, maxY: number): number[] {
  const ys = desired.map((d) => clamp(d, minY, Math.max(minY, maxY - h)))
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + h + gap)
  const overflow = ys.length > 0 ? ys[ys.length - 1] + h - maxY : 0
  if (overflow > 0) {
    ys[ys.length - 1] -= overflow
    for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.min(ys[i], ys[i + 1] - h - gap)
  }
  for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i === 0 ? minY : ys[i - 1] + h + gap)
  return ys
}

function columnMinY(x: number, w: number, margin: number, gap: number, reserved: CalloutBox[]): number {
  let minY = margin
  for (const r of reserved) {
    const overlapX = x < r.left + r.width && x + w > r.left
    if (overlapX && r.top <= margin + 4) minY = Math.max(minY, r.top + r.height + gap)
  }
  return minY
}

function buildLeader(
  side: 'left' | 'right',
  target: CalloutBox,
  label: CalloutBox,
  lane: number
): { anchor: { x: number; y: number }; points: Array<[number, number]>; length: number } {
  const c = centerOf(target)
  const ly = label.top + label.height * 0.5
  const anchorY = clamp(ly, target.top + 3, target.top + Math.max(3, target.height - 3))
  const useStraight = Math.abs(anchorY - ly) < 1
  const ay = useStraight ? ly : c.y
  if (side === 'right') {
    const ax = target.left + target.width
    const lx = label.left
    const elbow = clamp(lx - 18 - lane * 7, Math.min(ax + 10, lx - 6), lx - 6)
    const points: Array<[number, number]> = useStraight
      ? [[ax, ay], [lx, ay]]
      : [[ax, ay], [elbow, ay], [elbow, ly], [lx, ly]]
    return { anchor: { x: ax, y: ay }, points, length: polylineLength(points) }
  }
  const ax = target.left
  const lx = label.left + label.width
  const elbow = clamp(lx + 18 + lane * 7, lx + 6, Math.max(lx + 6, ax - 10))
  const points: Array<[number, number]> = useStraight
    ? [[ax, ay], [lx, ay]]
    : [[ax, ay], [elbow, ay], [elbow, ly], [lx, ly]]
  return { anchor: { x: ax, y: ay }, points, length: polylineLength(points) }
}

export function polylineLength(points: Array<[number, number]>): number {
  let len = 0
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return len
}

/**
 * Tính vị trí nhãn + đường dẫn cho mọi phần tử đã quét.
 */
export function layoutScanCallouts(
  targets: CalloutTarget[],
  scanRect: CalloutBox,
  viewport: Viewport,
  options: CalloutLayoutOptions = {}
): CalloutPlacement[] {
  const valid = targets.filter((t) => t.bounds.width > 0 && t.bounds.height > 0)
  if (valid.length === 0) return []
  const w = options.labelWidth ?? 248
  const gap = options.gap ?? 8
  const margin = options.margin ?? 14
  const gutter = options.gutter ?? 46
  const reserved = options.reserved ?? []

  const rects = valid.map((t) => toRect(t.bounds))
  if (scanRect.width >= 10 && scanRect.height >= 10) rects.push(toRect(scanRect))
  const region = unionRects(rects)
  const sides = assignSides(valid, region, viewport, w + gutter, margin)

  const placements: CalloutPlacement[] = []
  for (const side of ['left', 'right'] as const) {
    const column = valid
      .filter((t) => sides.get(t.idx) === side)
      .sort((a, b) => centerOf(a.bounds).y - centerOf(b.bounds).y)
    if (column.length === 0) continue
    const x =
      side === 'left'
        ? Math.max(margin, region.left - gutter - w)
        : Math.min(viewport.width - margin - w, region.right + gutter)
    const minY = columnMinY(x, w, margin, gap, reserved)
    const maxY = viewport.height - margin
    const fullH = options.labelHeight ?? 46
    const fits = column.length * (fullH + gap) <= maxY - minY
    const h = fits ? fullH : Math.max(options.compactHeight ?? 26, Math.floor((maxY - minY) / column.length) - gap)
    const ys = resolveColumn(
      column.map((t) => centerOf(t.bounds).y - h * 0.5),
      h,
      gap,
      minY,
      maxY
    )
    column.forEach((t, i) => {
      const label = { left: x, top: ys[i], width: w, height: h }
      const lane = side === 'right' ? i % 4 : (column.length - 1 - i) % 4
      const leader = buildLeader(side, t.bounds, label, lane)
      placements.push({ idx: t.idx, side, label, ...leader, compact: !fits })
    })
  }
  return placements.sort((a, b) => a.idx - b.idx)
}
