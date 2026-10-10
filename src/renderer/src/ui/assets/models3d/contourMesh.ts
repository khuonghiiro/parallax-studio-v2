/**
 * Contour-following mesh cells for alpha-trimmed image planes.
 *
 * The exact outline of the opaque pixels (see `silhouette.ts`) is transformed into grid
 * space and clipped against every grid cell (Weiler–Atherton against the cell square):
 *  - cells fully inside the outline stay full quads (two triangles, `_t0` / `_t1`),
 *  - boundary cells become the exact piece of the outline inside the cell,
 *  - cells outside the outline are dropped.
 * Crossing points on a cell border are computed once per outline segment and shared by
 * both neighbouring cells, so the mesh is watertight. Outline points are nudged by a tiny
 * irrational offset so they never fall exactly on a grid line (no degenerate cases).
 */
import * as THREE from 'three'
import { pointInPolygon, signedArea, type Pt, type Silhouette } from './silhouette'

export interface ContourCell {
  key: string
  r: number
  c: number
  /** True when the whole quad is kept (the cell lies completely inside the outline). */
  full: boolean
  /** Vertices in normalized grid space (x → right, y → down, both 0..1). */
  polygon: Array<[number, number]>
  /** Triangles as polygon indices, counter-clockwise when y points up (front face = +Z). */
  triangles: Array<[number, number, number]>
}

const NUDGE_X = 2.718281e-6
const NUDGE_Y = 3.141592e-6

const FULL_TRIANGLES: Array<[number, number, number]> = [
  [0, 3, 1], // TL, BL, TR
  [1, 3, 2] // TR, BL, BR
]

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

function fullCell(r: number, c: number, cols: number, rows: number): ContourCell {
  const polygon: Array<[number, number]> = [
    [c / cols, r / rows], [(c + 1) / cols, r / rows], [(c + 1) / cols, (r + 1) / rows], [c / cols, (r + 1) / rows]
  ]
  return { key: `${r}_${c}`, r, c, full: true, polygon, triangles: FULL_TRIANGLES }
}

/**
 * Silhouette loops in grid units (cell (r, c) spans x ∈ [c, c+1], y ∈ [r, r+1]).
 * Preserve all holes and nested islands, including outlines smaller than one cell.
 */
function gridLoops(sil: Silhouette, cols: number, rows: number, gridRotation: number): Pt[][] {
  const a = (gridRotation * Math.PI) / 180
  const cosA = Math.cos(a)
  const sinA = Math.sin(a)
  return sil.loops
    .map((loop) =>
      loop.points.map(([ix, iy]): Pt => {
        // image (y down) → texture uv (v up) → inverse grid rotation → grid (y down)
        const du = ix - 0.5
        const dv = 0.5 - iy
        const gu = 0.5 + du * cosA + dv * sinA
        const gv = 0.5 - du * sinA + dv * cosA
        return [gu * cols + NUDGE_X, (1 - gv) * rows + NUDGE_Y]
      })
    )
}

interface Chain {
  pts: Pt[]
  entryT: number
  exitT: number
}

interface CellBucket {
  r: number
  c: number
  chains: Chain[]
  islands: Pt[][]
}

/** Crossings of segment a → b with integer grid lines, sorted along the segment. */
function segmentCrossings(a: Pt, b: Pt): Pt[] {
  const hits: Array<[number, Pt]> = []
  for (let axis = 0; axis < 2; axis++) {
    const p0 = a[axis]
    const p1 = b[axis]
    if (p0 === p1) continue
    const lo = Math.min(p0, p1)
    const hi = Math.max(p0, p1)
    for (let k = Math.ceil(lo); k <= hi; k++) {
      if (k <= lo || k >= hi) continue
      const t = (k - p0) / (p1 - p0)
      const other = axis === 0 ? a[1] + (b[1] - a[1]) * t : a[0] + (b[0] - a[0]) * t
      hits.push([t, axis === 0 ? [k, other] : [other, k]])
    }
  }
  hits.sort((x, y) => x[0] - y[0])
  return hits.map((h) => h[1])
}

/** Clockwise perimeter parameter (0..4, from the top-left corner) of a border point. */
function perimeterT(p: Pt, c: number, r: number): number {
  const [x, y] = p
  if (y === r) return x - c
  if (x === c + 1) return 1 + (y - r)
  if (y === r + 1) return 2 + (c + 1 - x)
  if (x === c) return 3 + (r + 1 - y)
  // Fallback (should not happen): nearest border.
  const d = [Math.abs(y - r), Math.abs(x - c - 1), Math.abs(y - r - 1), Math.abs(x - c)]
  const e = d.indexOf(Math.min(...d))
  return [x - c, 1 + (y - r), 2 + (c + 1 - x), 3 + (r + 1 - y)][e]
}

/** Splits one loop into per-cell chains (or a whole-loop island when it stays in one cell). */
function splitLoop(loop: Pt[], cols: number, rows: number, buckets: Map<number, CellBucket>): void {
  const bucket = (r: number, c: number): CellBucket | null => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return null
    const id = r * cols + c
    let b = buckets.get(id)
    if (!b) buckets.set(id, (b = { r, c, chains: [], islands: [] }))
    return b
  }
  const ext: Array<{ p: Pt; cross: boolean }> = []
  for (let i = 0, n = loop.length; i < n; i++) {
    ext.push({ p: loop[i], cross: false })
    for (const p of segmentCrossings(loop[i], loop[(i + 1) % n])) ext.push({ p, cross: true })
  }
  const first = ext.findIndex((e) => e.cross)
  if (first < 0) {
    bucket(Math.floor(loop[0][1]), Math.floor(loop[0][0]))?.islands.push(loop)
    return
  }
  const emit = (pts: Pt[]): void => {
    const c = Math.floor((pts[0][0] + pts[1][0]) / 2)
    const r = Math.floor((pts[0][1] + pts[1][1]) / 2)
    bucket(r, c)?.chains.push({ pts, entryT: perimeterT(pts[0], c, r), exitT: perimeterT(pts[pts.length - 1], c, r) })
  }
  let chain: Pt[] = [ext[first].p]
  for (let k = 1, m = ext.length; k <= m; k++) {
    const e = ext[(first + k) % m]
    chain.push(e.p)
    if (e.cross) {
      emit(chain)
      chain = [e.p]
    }
  }
}

/** Closes the chains of a cell into rings by walking the cell border clockwise. */
function stitchCell(b: CellBucket): Pt[][] {
  const { r, c, chains } = b
  const corner = (t: number): Pt => [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]][((t % 4) + 4) % 4] as Pt
  const used = new Uint8Array(chains.length)
  const rings: Pt[][] = []
  for (let s = 0; s < chains.length; s++) {
    if (used[s]) continue
    const ring: Pt[] = []
    let cur = s
    for (let guard = 0; guard <= chains.length; guard++) {
      used[cur] = 1
      ring.push(...chains[cur].pts)
      const ex = chains[cur].exitT
      let best = -1
      let bestD = Infinity
      chains.forEach((ch, j) => {
        const d = (ch.entryT - ex + 4) % 4
        if (d > 0 && d < bestD) {
          bestD = d
          best = j
        }
      })
      if (best < 0) break
      for (let k = Math.floor(ex) + 1; k < ex + bestD; k++) ring.push(corner(k))
      if (best === s || used[best]) break
      cur = best
    }
    if (ring.length >= 3) rings.push(ring)
  }
  return rings.concat(b.islands)
}

/** Triangulates rings (grid units) into one cell (normalized polygon + CCW triangles). */
function triangulateRings(b: CellBucket, rings: Pt[][], cols: number, rows: number): ContourCell | null {
  const polygon: Array<[number, number]> = []
  const triangles: Array<[number, number, number]> = []
  const outer = rings.filter((ring) => signedArea(ring) > 0)
  const holes = rings.filter((ring) => signedArea(ring) < 0)
  for (const ring of outer) {
    const owned = holes.filter((hole) => {
      const containers = outer.filter((o) => pointInPolygon(hole[0][0], hole[0][1], o))
      containers.sort((a, b) => Math.abs(signedArea(a)) - Math.abs(signedArea(b)))
      return containers[0] === ring
    })
    const points = [ring, ...owned].flat()
    const base = polygon.length
    points.forEach(([x, y]) => polygon.push([x / cols, y / rows]))
    const vectors = (pts: Pt[]) => pts.map(([x, y]) => new THREE.Vector2(x, y))
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(vectors(ring), owned.map(vectors))) {
      const [a, b, c] = [points[i], points[j], points[k]]
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      if (Math.abs(cross) < 1e-14) continue
      triangles.push(cross > 0 ? [base + i, base + k, base + j] : [base + i, base + j, base + k])
    }
  }
  if (triangles.length === 0) return null
  return { key: `${b.r}_${b.c}`, r: b.r, c: b.c, full: false, polygon, triangles }
}

/** Whether the top-left corner of every cell lies inside the outline (even-odd scanlines). */
function cornerInside(loops: Pt[][], cols: number, rows: number): Uint8Array {
  const inside = new Uint8Array(cols * rows)
  for (let r = 0; r < rows; r++) {
    const xs: number[] = []
    for (const loop of loops) {
      for (let i = 0, n = loop.length; i < n; i++) {
        const [ax, ay] = loop[i]
        const [bx, by] = loop[(i + 1) % n]
        if (ay > r !== by > r) xs.push(ax + ((r - ay) * (bx - ax)) / (by - ay))
      }
    }
    xs.sort((p, q) => p - q)
    let k = 0
    for (let c = 0; c < cols; c++) {
      while (k < xs.length && xs[k] < c) k++
      inside[r * cols + c] = k % 2
    }
  }
  return inside
}

/**
 * Computes the kept cells of a grid. With `autoTrim` false (manual mesh mode) or without a
 * silhouette every cell is a full quad.
 */
export function computeContourCells(
  cols: number,
  rows: number,
  silhouette: Silhouette | null,
  gridRotation = 0,
  autoTrim = true
): ContourCell[] {
  const cells: ContourCell[] = []
  if (!autoTrim || !silhouette) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(fullCell(r, c, cols, rows))
    return cells
  }
  const loops = gridLoops(silhouette, cols, rows, gridRotation)
  const buckets = new Map<number, CellBucket>()
  for (const loop of loops) splitLoop(loop, cols, rows, buckets)
  const inside = cornerInside(loops, cols, rows)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = buckets.get(r * cols + c)
      if (!b || b.chains.length === 0) {
        // No outline crosses the cell border: the cell is fully inside or outside.
        if (inside[r * cols + c]) {
          const full = fullCell(r, c, cols, rows)
          if (!b?.islands.length) { cells.push(full); continue }
          b.islands.unshift(full.polygon.map(([x, y]): Pt => [x * cols, y * rows]))
        }
        if (!b) continue
      }
      const cell = triangulateRings(b, stitchCell(b), cols, rows)
      if (cell) cells.push(cell)
    }
  }
  return cells
}
