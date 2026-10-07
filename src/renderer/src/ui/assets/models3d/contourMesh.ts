/**
 * Contour-following mesh cells for alpha-trimmed image planes.
 *
 * Pipeline:
 *  1. Build an "alpha field" from the image: the alpha channel is dilated by ~1 grid cell
 *     (so no opaque pixel can ever fall outside the mesh) and lightly blurred (so the field
 *     varies smoothly across the outline and linear interpolation finds a clean contour).
 *  2. Sample the field at every grid corner and clip each cell with marching squares.
 *     Fully-inside cells stay quads; boundary cells become convex polygons whose edge
 *     crossings are shared with their neighbours, so the result is watertight and the
 *     outline follows the silhouette smoothly instead of stair-stepping.
 *
 * The exact visual silhouette is produced by the material's alpha cutout; the mesh only
 * needs to cover every opaque pixel with a small, smooth margin.
 */

export interface AlphaField {
  width: number
  height: number
  /** Dilated + blurred alpha, 0..255, row 0 = top of the image. */
  data: Float32Array
}

export interface ContourCell {
  key: string
  r: number
  c: number
  /** True when the whole quad is kept (all corners inside the silhouette). */
  full: boolean
  /** Convex polygon in normalized grid space (x → right, y → down, both 0..1). */
  polygon: Array<[number, number]>
  /** Triangles as polygon indices, counter-clockwise when y points up (front face = +Z). */
  triangles: Array<[number, number, number]>
}

/** Field value above which a grid corner counts as "inside" the silhouette. */
export const CONTOUR_ISO = 128
/** Dilation radius in grid cells; guarantees every opaque pixel is covered by the mesh. */
const DILATE_CELLS = 1.0
/** Blur radius in grid cells; smooths the field so interpolated crossings are accurate. */
const BLUR_CELLS = 0.4
/** Field resolution per grid cell. */
const FIELD_PER_CELL = 4

const fieldCache = new WeakMap<object, Map<string, AlphaField>>()

function fieldSize(cols: number, rows: number): [number, number] {
  const w = Math.max(32, Math.min(768, Math.round(cols * FIELD_PER_CELL)))
  const h = Math.max(32, Math.min(768, Math.round(rows * FIELD_PER_CELL)))
  return [w, h]
}

/** Separable running max along one axis (clamped borders). */
function maxFilter(src: Float32Array, w: number, h: number, radius: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(src.length)
  const len = horizontal ? w : h
  const lines = horizontal ? h : w
  for (let line = 0; line < lines; line++) {
    for (let i = 0; i < len; i++) {
      let m = 0
      const lo = Math.max(0, i - radius)
      const hi = Math.min(len - 1, i + radius)
      for (let k = lo; k <= hi; k++) {
        const v = horizontal ? src[line * w + k] : src[k * w + line]
        if (v > m) m = v
      }
      out[horizontal ? line * w + i : i * w + line] = m
    }
  }
  return out
}

/** Separable box blur along one axis (edge-clamped). */
function boxBlur(src: Float32Array, w: number, h: number, radius: number, horizontal: boolean): Float32Array {
  if (radius <= 0) return src
  const out = new Float32Array(src.length)
  const len = horizontal ? w : h
  const lines = horizontal ? h : w
  const at = (line: number, i: number): number => {
    const k = Math.max(0, Math.min(len - 1, i))
    return horizontal ? src[line * w + k] : src[k * w + line]
  }
  const span = radius * 2 + 1
  for (let line = 0; line < lines; line++) {
    let sum = 0
    for (let k = -radius; k <= radius; k++) sum += at(line, k)
    for (let i = 0; i < len; i++) {
      out[horizontal ? line * w + i : i * w + line] = sum / span
      sum += at(line, i + radius + 1) - at(line, i - radius)
    }
  }
  return out
}

/**
 * Dilates + blurs a raw alpha buffer (already at field resolution) into a contour field.
 */
export function buildFieldFromAlpha(alpha: Float32Array, w: number, h: number, cols: number, rows: number): AlphaField {
  const pxPerCellX = w / Math.max(1, cols)
  const pxPerCellY = h / Math.max(1, rows)
  const dx = Math.max(1, Math.round(DILATE_CELLS * pxPerCellX))
  const dy = Math.max(1, Math.round(DILATE_CELLS * pxPerCellY))
  const bx = Math.round(BLUR_CELLS * pxPerCellX)
  const by = Math.round(BLUR_CELLS * pxPerCellY)
  let f = maxFilter(alpha, w, h, dx, true)
  f = maxFilter(f, w, h, dy, false)
  f = boxBlur(f, w, h, bx, true)
  f = boxBlur(f, w, h, by, false)
  return { width: w, height: h, data: f }
}

/** Builds a field from a boolean cell grid (rows × cols, true = visible). */
export function fieldFromBoolGrid(grid: boolean[][], cols: number, rows: number): AlphaField {
  const [w, h] = fieldSize(cols, rows)
  const alpha = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const r = Math.min(rows - 1, Math.floor((y / h) * rows))
    for (let x = 0; x < w; x++) {
      const c = Math.min(cols - 1, Math.floor((x / w) * cols))
      alpha[y * w + x] = grid[r]?.[c] ? 255 : 0
    }
  }
  return buildFieldFromAlpha(alpha, w, h, cols, rows)
}

/**
 * Builds (and caches per image + resolution) the contour field of an image.
 * Returns null when pixels cannot be read (no 2D canvas, tainted image…): callers
 * should then treat the whole plane as opaque.
 */
export function getImageAlphaField(
  image: HTMLImageElement | HTMLCanvasElement,
  cols: number,
  rows: number
): AlphaField | null {
  const [w, h] = fieldSize(cols, rows)
  const key = `${w}x${h}`
  let perImage = fieldCache.get(image)
  const cached = perImage?.get(key)
  if (cached) return cached
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
    const alpha = new Float32Array(w * h)
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
    const field = buildFieldFromAlpha(alpha, w, h, cols, rows)
    if (!perImage) {
      perImage = new Map()
      fieldCache.set(image, perImage)
    }
    perImage.set(key, field)
    return field
  } catch {
    return null
  }
}

/** Bilinear sample of the field at texture UV (v = 1 is the top of the image). */
export function sampleField(field: AlphaField, u: number, v: number): number {
  const fx = Math.max(0, Math.min(1, u)) * (field.width - 1)
  const fy = Math.max(0, Math.min(1, 1 - v)) * (field.height - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(field.width - 1, x0 + 1)
  const y1 = Math.min(field.height - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const d = field.data
  const w = field.width
  const top = d[y0 * w + x0] * (1 - tx) + d[y0 * w + x1] * tx
  const bot = d[y1 * w + x0] * (1 - tx) + d[y1 * w + x1] * tx
  return top * (1 - ty) + bot * ty
}

/** Rotates grid UVs around the image centre (matches the mesh "grid rotation" control). */
export function makeUVTransform(gridRotation: number): (u: number, v: number) => [number, number] {
  if (!gridRotation) return (u, v) => [u, v]
  const a = (gridRotation * Math.PI) / 180
  const cosA = Math.cos(a)
  const sinA = Math.sin(a)
  return (u, v) => {
    const du = u - 0.5
    const dv = v - 0.5
    return [
      Math.max(0, Math.min(1, 0.5 + (du * cosA - dv * sinA))),
      Math.max(0, Math.min(1, 0.5 + (du * sinA + dv * cosA)))
    ]
  }
}

/** Samples the field at all (cols+1) × (rows+1) grid corners. */
function sampleCorners(field: AlphaField | null, cols: number, rows: number, gridRotation: number): Float32Array {
  const values = new Float32Array((cols + 1) * (rows + 1))
  if (!field) return values.fill(255)
  const toUV = makeUVTransform(gridRotation)
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const [u, v] = toUV(i / cols, 1 - j / rows)
      values[j * (cols + 1) + i] = sampleField(field, u, v)
    }
  }
  return values
}

const FULL_TRIANGLES: Array<[number, number, number]> = [
  [0, 3, 1], // TL, BL, TR
  [1, 3, 2] // TR, BL, BR
]

/**
 * Computes the kept cells of a grid. With `autoTrim` false (manual mesh mode) or without a
 * field every cell is a full quad.
 */
export function computeContourCells(
  cols: number,
  rows: number,
  field: AlphaField | null,
  gridRotation = 0,
  autoTrim = true
): ContourCell[] {
  const cells: ContourCell[] = []
  const stride = cols + 1
  const values = autoTrim ? sampleCorners(field, cols, rows, gridRotation) : null
  // Canonical crossing so both cells sharing an edge get bit-identical points.
  const crossing = (ia: number, ja: number, ib: number, jb: number): [number, number] => {
    const aFirst = ja < jb || (ja === jb && ia < ib)
    const [i0, j0, i1, j1] = aFirst ? [ia, ja, ib, jb] : [ib, jb, ia, ja]
    const v0 = values![j0 * stride + i0]
    const v1 = values![j1 * stride + i1]
    const t = Math.max(0, Math.min(1, (CONTOUR_ISO - v0) / (v1 - v0)))
    return [(i0 + (i1 - i0) * t) / cols, (j0 + (j1 - j0) * t) / rows]
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r}_${c}`
      // Corner order: TL, TR, BR, BL (grid indices i, j)
      const ids: Array<[number, number]> = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]]
      const inside = ids.map(([i, j]) => !values || values[j * stride + i] > CONTOUR_ISO)
      const insideCount = inside.filter(Boolean).length
      if (insideCount === 0) continue
      if (insideCount === 4) {
        const polygon = ids.map(([i, j]) => [i / cols, j / rows] as [number, number])
        cells.push({ key, r, c, full: true, polygon, triangles: FULL_TRIANGLES })
        continue
      }
      const polygon: Array<[number, number]> = []
      for (let k = 0; k < 4; k++) {
        const [ia, ja] = ids[k]
        const [ib, jb] = ids[(k + 1) % 4]
        if (inside[k]) polygon.push([ia / cols, ja / rows])
        if (inside[k] !== inside[(k + 1) % 4]) polygon.push(crossing(ia, ja, ib, jb))
      }
      const triangles: Array<[number, number, number]> = []
      // Walk is clockwise with y up → reverse the fan for counter-clockwise triangles.
      for (let k = 1; k < polygon.length - 1; k++) triangles.push([0, k + 1, k])
      cells.push({ key, r, c, full: false, polygon, triangles })
    }
  }
  return cells
}
