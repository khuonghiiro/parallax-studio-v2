/**
 * High-resolution silhouette of an image's opaque pixels as closed outline polygons.
 *
 * Pipeline: alpha → binary mask (≤ 512 px on the long side) → 1 px dilation (so the outline
 * never cuts into an opaque pixel) → marching squares on pixel centres (outline runs along
 * pixel borders with 45° chamfers instead of stair steps) → Douglas–Peucker simplification.
 *
 * The polygons live in normalized image space (x → right, y → down, 0..1). Outer outlines
 * have a positive signed area, holes a negative one; `parent` gives the nesting.
 */

export type Pt = [number, number]

export interface SilhouetteLoop {
  points: Pt[]
  /** Signed area in normalized units: > 0 outer outline, < 0 hole. */
  area: number
  /** Smallest loop containing this one, -1 for top-level outlines. */
  parent: number
}

export interface Silhouette {
  loops: SilhouetteLoop[]
}

export interface BinaryMask {
  w: number
  h: number
  /** 1 = opaque, row 0 = top of the image. */
  data: Uint8Array
}

/** Long side of the analysed mask (pixels). */
const MAX_MASK_SIZE = 512
/** Alpha (0..255) above which a mask pixel counts as opaque. */
const ALPHA_MIN = 8
/** Douglas–Peucker tolerance in mask pixels (covered by the 1 px dilation). */
const SIMPLIFY_PX = 0.75
/** Outlines smaller than this (mask px²) are noise. */
const MIN_LOOP_AREA_PX = 3
/** How far outside [0, 1] outline points may sit, so image borders stay crisp. */
const EDGE_EPS = 1e-5

const cache = new WeakMap<object, Silhouette>()
const detailCache = new WeakMap<object, Silhouette>()

/** 3 × 3 (radius 1) or larger square dilation of a binary mask. */
export function dilateMask(m: BinaryMask, radius = 1): BinaryMask {
  const { w, h, data } = m
  const tmp = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let k = Math.max(0, x - radius); k <= Math.min(w - 1, x + radius) && !v; k++) v = data[y * w + k]
      tmp[y * w + x] = v
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let k = Math.max(0, y - radius); k <= Math.min(h - 1, y + radius) && !v; k++) v = tmp[k * w + x]
      out[y * w + x] = v
    }
  }
  return { w, h, data: out }
}

/**
 * Marching squares over pixel centres of a zero-padded mask. Returns closed loops in
 * mask pixel coordinates (outline points lie on pixel borders).
 */
export function traceMaskLoops(m: BinaryMask): Pt[][] {
  const { w, h, data } = m
  const W = w + 2
  const padded = new Uint8Array(W * (h + 2))
  for (let y = 0; y < h; y++) padded.set(data.subarray(y * w, (y + 1) * w), (y + 1) * W + 1)
  // Edge point ids: horizontal edge (x,y)-(x+1,y) → even, vertical edge (x,y)-(x,y+1) → odd.
  const next = new Map<number, number>()
  const ins = [0, 0, 0, 0]
  const edges = [0, 0, 0, 0]
  for (let y = 0; y <= h; y++) {
    for (let x = 0; x <= w; x++) {
      const i = y * W + x
      ins[0] = padded[i]; ins[1] = padded[i + 1]; ins[2] = padded[i + W + 1]; ins[3] = padded[i + W]
      const sum = ins[0] + ins[1] + ins[2] + ins[3]
      if (sum === 0 || sum === 4) continue
      edges[0] = 2 * i; edges[1] = 2 * (i + 1) + 1; edges[2] = 2 * (i + W); edges[3] = 2 * i + 1
      // Clockwise walk TL → TR → BR → BL: each inside run gives a segment entry → exit.
      for (let k = 0; k < 4; k++) {
        if (ins[k] || !ins[(k + 1) % 4]) continue
        for (let s = 1; s < 4; s++) {
          const e = (k + s) % 4
          if (ins[e] && !ins[(e + 1) % 4]) {
            next.set(edges[k], edges[e])
            break
          }
        }
      }
    }
  }
  const toPt = (id: number): Pt => {
    const cell = id >> 1
    const x = cell % W
    const y = (cell - x) / W
    return id & 1 ? [x - 0.5, y] : [x, y - 0.5]
  }
  const loops: Pt[][] = []
  const visited = new Set<number>()
  for (const start of next.keys()) {
    if (visited.has(start)) continue
    const loop: Pt[] = []
    let cur: number | undefined = start
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur)
      loop.push(toPt(cur))
      cur = next.get(cur)
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

function segDist2(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  let t = len2 > 0 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const ex = a[0] + dx * t - p[0]
  const ey = a[1] + dy * t - p[1]
  return ex * ex + ey * ey
}

/** Douglas–Peucker simplification of a closed polygon. */
export function simplifyClosed(pts: Pt[], tolerance: number): Pt[] {
  const n = pts.length
  if (n <= 4) return pts.slice()
  let far = 0
  let best = -1
  for (let i = 1; i < n; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2
    if (d > best) {
      best = d
      far = i
    }
  }
  const ext = pts.concat([pts[0]])
  const keep = new Uint8Array(n + 1)
  keep[0] = keep[far] = keep[n] = 1
  const tol2 = tolerance * tolerance
  const stack: Array<[number, number]> = [[0, far], [far, n]]
  while (stack.length) {
    const [lo, hi] = stack.pop()!
    let idx = -1
    let max = tol2
    for (let i = lo + 1; i < hi; i++) {
      const d = segDist2(ext[i], ext[lo], ext[hi])
      if (d > max) {
        max = d
        idx = i
      }
    }
    if (idx < 0) continue
    keep[idx] = 1
    stack.push([lo, idx], [idx, hi])
  }
  const out: Pt[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i])
  return out
}

/** Signed shoelace area (positive = clockwise on screen with y pointing down). */
export function signedArea(pts: Pt[]): number {
  let a = 0
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % n]
    a += p[0] * q[1] - q[0] * p[1]
  }
  return a / 2
}

/** Even-odd point-in-polygon test. */
export function pointInPolygon(x: number, y: number, pts: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function bbox(pts: Pt[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of pts) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}

/** Smallest enclosing loop of every loop (loops never intersect each other). */
function computeParents(loops: SilhouetteLoop[]): void {
  const boxes = loops.map((l) => bbox(l.points))
  loops.forEach((loop, i) => {
    const [px, py] = loop.points[0]
    let best = -1
    loops.forEach((other, j) => {
      if (j === i || Math.abs(other.area) <= Math.abs(loop.area)) return
      const b = boxes[j]
      if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) return
      if (!pointInPolygon(px, py, other.points)) return
      if (best < 0 || Math.abs(other.area) < Math.abs(loops[best].area)) best = j
    })
    loop.parent = best
  })
}

/** Detailed mode keeps thin islands/gaps intact; the legacy 3D path retains its bleed margin. */
export function silhouetteFromMask(mask: BinaryMask, detailed = false): Silhouette {
  const { w, h } = mask
  // Pad by one pixel first so the dilation may spill past the image border: outlines that
  // touch the border then run just outside it and image corners stay square.
  const pw = w + 2
  const padded = new Uint8Array(pw * (h + 2))
  for (let y = 0; y < h; y++) padded.set(mask.data.subarray(y * w, (y + 1) * w), (y + 1) * pw + 1)
  const raw = traceMaskLoops(dilateMask({ w: pw, h: h + 2, data: padded }, detailed ? 0 : 1))
    .map((l) => simplifyClosed(l, detailed ? 0 : SIMPLIFY_PX))
    .filter((l) => l.length >= 3 && Math.abs(signedArea(l)) >= (detailed ? 0.1 : MIN_LOOP_AREA_PX))
  if (raw.length === 0) return { loops: [] }
  // The biggest loop is always an outer outline → its orientation defines "outer".
  let biggest = raw[0]
  for (const l of raw) if (Math.abs(signedArea(l)) > Math.abs(signedArea(biggest))) biggest = l
  const flip = signedArea(biggest) < 0
  const clamp = (v: number): number => Math.max(-EDGE_EPS, Math.min(1 + EDGE_EPS, v))
  const loops = raw.map((l): SilhouetteLoop => {
    const pts = l
      .map(([x, y]): Pt => [clamp((x - 1) / w), clamp((y - 1) / h)])
      .filter((p, i, arr) => {
        const q = arr[(i + arr.length - 1) % arr.length]
        return p[0] !== q[0] || p[1] !== q[1]
      })
    if (flip) pts.reverse()
    return { points: pts, area: signedArea(pts), parent: -1 }
  })
  computeParents(loops)
  return { loops }
}

/** Silhouette of a boolean cell grid (rows × cols, true = opaque) — used by tests / fallbacks. */
export function silhouetteFromBoolGrid(grid: boolean[][], cols: number, rows: number, pxPerCell = 4): Silhouette {
  const w = Math.max(1, cols * pxPerCell)
  const h = Math.max(1, rows * pxPerCell)
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const r = Math.floor(y / pxPerCell)
    for (let x = 0; x < w; x++) data[y * w + x] = grid[r]?.[Math.floor(x / pxPerCell)] ? 1 : 0
  }
  return silhouetteFromMask({ w, h, data })
}

/**
 * Tạo Silhouette trực tiếp từ đa giác khép kín (viền mesh cấu hình sẵn).
 * Tọa độ các điểm có thể ở không gian UV (u sang phải 0..1, v hướng lên 0..1) hoặc image space (x sang phải 0..1, y hướng xuống 0..1).
 * Loop tự động được chuẩn hóa, giới hạn trong [-EDGE_EPS, 1 + EDGE_EPS] và đảm bảo diện tích dương (clockwise với y hướng xuống).
 */
export function silhouetteFromPolygon(polygon: Pt[] | number[][], space: 'uv' | 'image' = 'uv'): Silhouette {
  if (!polygon || polygon.length < 3) return { loops: [] }
  const clamp = (v: number): number => Math.max(-EDGE_EPS, Math.min(1 + EDGE_EPS, v))
  let pts: Pt[] = polygon.map(([x, y]) => {
    const ix = clamp(x)
    const iy = clamp(space === 'uv' ? 1 - y : y)
    return [ix, iy] as Pt
  })
  pts = pts.filter((p, i, arr) => {
    const q = arr[(i + arr.length - 1) % arr.length]
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-5
  })
  if (pts.length < 3) return { loops: [] }
  let area = signedArea(pts)
  if (Math.abs(area) < 1e-6) return { loops: [] }
  if (area < 0) {
    pts.reverse()
    area = -area
  }
  return { loops: [{ points: pts, area, parent: -1 }] }
}

/**
 * Silhouette of an image (cached per image element). Returns null when the pixels cannot
 * be read (image not decoded yet, no 2D canvas, tainted canvas…).
 */
export function getImageSilhouette(image: HTMLImageElement | HTMLCanvasElement, detailed = false): Silhouette | null {
  const imageCache = detailed ? detailCache : cache
  const cached = imageCache.get(image)
  if (cached) return cached
  const nw = 'naturalWidth' in image ? image.naturalWidth : image.width
  const nh = 'naturalHeight' in image ? image.naturalHeight : image.height
  if (!nw || !nh) return null
  const s = Math.min(1, (detailed ? 2048 : MAX_MASK_SIZE) / Math.max(nw, nh))
  const w = Math.max(1, Math.round(nw * s))
  const h = Math.max(1, Math.round(nh * s))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, 0, 0, w, h)
    const rgba = ctx.getImageData(0, 0, w, h).data
    const data = new Uint8Array(w * h)
    for (let i = 0; i < data.length; i++) data[i] = rgba[i * 4 + 3] > ALPHA_MIN ? 1 : 0
    const sil = silhouetteFromMask({ w, h, data }, detailed)
    imageCache.set(image, sil)
    return sil
  } catch {
    return null
  }
}

/**
 * Bounding box [uMin, vMin, uMax, vMax] of the opaque pixels in texture UV (v up), or the
 * full image when the silhouette is empty / unavailable.
 */
export function silhouetteBounds(sil: Silhouette | null): [number, number, number, number] {
  const outer = sil?.loops.filter((l) => l.area > 0) ?? []
  if (outer.length === 0) return [0, 0, 1, 1]
  const [x0, y0, x1, y1] = bbox(outer.flatMap((l) => l.points))
  const c = (v: number): number => Math.max(0, Math.min(1, v))
  return [c(x0), c(1 - y1), c(x1), c(1 - y0)]
}
