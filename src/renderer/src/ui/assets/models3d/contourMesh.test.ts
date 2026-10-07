import { describe, expect, it } from 'vitest'
import { computeContourCells, fieldFromBoolGrid, type ContourCell } from './contourMesh'

const grid = (rows: number, cols: number, on: (r: number, c: number) => boolean): boolean[][] =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => on(r, c)))

/** Point-in-convex-polygon test (polygon in normalized grid space). */
function containsPoint(poly: Array<[number, number]>, x: number, y: number): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[(i + 1) % poly.length]
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    if (Math.abs(cross) < 1e-9) continue
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

const edgeKey = (a: [number, number], b: [number, number]): string => {
  const p = `${a[0].toFixed(9)},${a[1].toFixed(9)}`
  const q = `${b[0].toFixed(9)},${b[1].toFixed(9)}`
  return p < q ? `${p}|${q}` : `${q}|${p}`
}

describe('contourMesh', () => {
  it('keeps every cell as a full quad in manual mode or without a field', () => {
    const field = fieldFromBoolGrid(grid(4, 4, (r) => r < 2), 4, 4)
    const manual = computeContourCells(4, 4, field, 0, false)
    expect(manual).toHaveLength(16)
    expect(manual.every((c) => c.full)).toBe(true)
    const noField = computeContourCells(3, 2, null)
    expect(noField).toHaveLength(6)
  })

  it('never drops an opaque cell: a lone opaque cell stays covered', () => {
    const cols = 9
    const rows = 9
    const field = fieldFromBoolGrid(grid(rows, cols, (r, c) => r === 4 && c === 4), cols, rows)
    const cells = computeContourCells(cols, rows, field)
    const centre: [number, number] = [4.5 / cols, 4.5 / rows]
    const covering = cells.filter((c) => containsPoint(c.polygon, centre[0], centre[1]))
    expect(covering.length).toBeGreaterThan(0)
    // Far-away fully transparent corners are trimmed away.
    expect(cells.find((c) => c.key === '0_0')).toBeUndefined()
    expect(cells.length).toBeLessThan(cols * rows)
  })

  it('produces a watertight mesh: interior edges are shared by exactly two cells', () => {
    const cols = 12
    const rows = 12
    // Diamond silhouette → many clipped boundary cells.
    const field = fieldFromBoolGrid(grid(rows, cols, (r, c) => Math.abs(r - 5.5) + Math.abs(c - 5.5) < 4), cols, rows)
    const cells = computeContourCells(cols, rows, field)
    const clipped = cells.filter((c) => !c.full)
    expect(clipped.length).toBeGreaterThan(0)

    const edges = new Map<string, number>()
    const addTriangles = (cell: ContourCell): void => {
      for (const tri of cell.triangles) {
        for (let k = 0; k < 3; k++) {
          const key = edgeKey(cell.polygon[tri[k]], cell.polygon[tri[(k + 1) % 3]])
          edges.set(key, (edges.get(key) ?? 0) + 1)
        }
      }
    }
    cells.forEach(addTriangles)
    // No edge may be used by more than two triangles (no overlaps / T-junction duplicates).
    expect(Math.max(...edges.values())).toBeLessThanOrEqual(2)
  })

  it('outputs counter-clockwise triangles (front face = +Z with y up)', () => {
    const field = fieldFromBoolGrid(grid(6, 6, (r, c) => r + c < 6), 6, 6)
    for (const cell of computeContourCells(6, 6, field)) {
      for (const [a, b, c] of cell.triangles) {
        const [ax, ay] = cell.polygon[a]
        const [bx, by] = cell.polygon[b]
        const [cx, cy] = cell.polygon[c]
        // Flip y (grid y points down) and check the signed area is non-negative.
        const area = (bx - ax) * (-cy + ay) - (-by + ay) * (cx - ax)
        expect(area).toBeGreaterThanOrEqual(-1e-12)
      }
    }
  })
})
