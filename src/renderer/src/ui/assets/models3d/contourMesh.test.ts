import { describe, expect, it } from 'vitest'
import { computeContourCells, type ContourCell } from './contourMesh'
import { silhouetteFromBoolGrid } from './silhouette'

const grid = (rows: number, cols: number, on: (r: number, c: number) => boolean): boolean[][] =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => on(r, c)))

/** Point covered by one of the cell triangles (normalized grid space, y down). */
function covers(cell: ContourCell, x: number, y: number): boolean {
  return cell.triangles.some(([a, b, c]) => {
    const [p, q, s] = [cell.polygon[a], cell.polygon[b], cell.polygon[c]]
    const d1 = (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])
    const d2 = (s[0] - q[0]) * (y - q[1]) - (s[1] - q[1]) * (x - q[0])
    const d3 = (p[0] - s[0]) * (y - s[1]) - (p[1] - s[1]) * (x - s[0])
    return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)
  })
}

const cellArea = (cell: ContourCell): number =>
  cell.triangles.reduce((sum, [a, b, c]) => {
    const [p, q, s] = [cell.polygon[a], cell.polygon[b], cell.polygon[c]]
    return sum + Math.abs((q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0])) / 2
  }, 0)

const edgeKey = (a: [number, number], b: [number, number]): string => {
  const p = `${a[0].toFixed(9)},${a[1].toFixed(9)}`
  const q = `${b[0].toFixed(9)},${b[1].toFixed(9)}`
  return p < q ? `${p}|${q}` : `${q}|${p}`
}

describe('contourMesh', () => {
  it('preserves a tiny transparent hole entirely inside one mesh cell', () => {
    const cells = computeContourCells(1, 1, { loops: [
      { points: [[0, 0], [1, 0], [1, 1], [0, 1]], area: 1, parent: -1 },
      { points: [[0.4, 0.4], [0.4, 0.6], [0.6, 0.6], [0.6, 0.4]], area: -0.04, parent: 0 }
    ] })
    expect(cells.some((cell) => covers(cell, 0.5, 0.5))).toBe(false)
    expect(cells.some((cell) => covers(cell, 0.2, 0.2))).toBe(true)
  })
  it('keeps every cell as a full quad in manual mode or without a silhouette', () => {
    const sil = silhouetteFromBoolGrid(grid(4, 4, (r) => r < 2), 4, 4)
    const manual = computeContourCells(4, 4, sil, 0, false)
    expect(manual).toHaveLength(16)
    expect(manual.every((c) => c.full)).toBe(true)
    expect(computeContourCells(3, 2, null)).toHaveLength(6)
  })

  it('never drops an opaque cell: a lone opaque cell stays covered', () => {
    const cols = 9
    const rows = 9
    const sil = silhouetteFromBoolGrid(grid(rows, cols, (r, c) => r === 4 && c === 4), cols, rows)
    const cells = computeContourCells(cols, rows, sil)
    const centre = cells.find((c) => c.key === '4_4')
    expect(centre?.full).toBe(true)
    // Far-away fully transparent cells are trimmed away.
    expect(cells.find((c) => c.key === '0_0')).toBeUndefined()
    expect(cells.length).toBeLessThan(cols * rows)
  })

  it('hugs the silhouette tightly: margin cells only carry a thin sliver', () => {
    const cols = 8
    const rows = 8
    // Left half opaque.
    const sil = silhouetteFromBoolGrid(grid(rows, cols, (_, c) => c < 4), cols, rows, 16)
    const cells = computeContourCells(cols, rows, sil)
    const margin = cells.filter((c) => c.c === 4)
    expect(margin).toHaveLength(rows)
    for (const cell of margin) {
      // Normalized cell area is 1/64; the sliver must be far smaller than half of that.
      expect(cellArea(cell)).toBeLessThan(1 / 64 / 4)
      expect(covers(cell, 4.01 / cols, (cell.r + 0.5) / rows)).toBe(true)
    }
    expect(cells.some((c) => c.c >= 5)).toBe(false)
  })

  it('produces a watertight mesh: no edge is used by more than two triangles', () => {
    const cols = 12
    const rows = 12
    const sil = silhouetteFromBoolGrid(grid(rows, cols, (r, c) => Math.abs(r - 5.5) + Math.abs(c - 5.5) < 4), cols, rows)
    const cells = computeContourCells(cols, rows, sil)
    expect(cells.filter((c) => !c.full).length).toBeGreaterThan(0)
    const edges = new Map<string, number>()
    for (const cell of cells) {
      for (const tri of cell.triangles) {
        for (let k = 0; k < 3; k++) {
          const key = edgeKey(cell.polygon[tri[k]], cell.polygon[tri[(k + 1) % 3]])
          edges.set(key, (edges.get(key) ?? 0) + 1)
        }
      }
    }
    expect(Math.max(...edges.values())).toBeLessThanOrEqual(2)
  })

  it('outputs counter-clockwise triangles (front face = +Z with y up)', () => {
    const sil = silhouetteFromBoolGrid(grid(6, 6, (r, c) => r + c < 6), 6, 6)
    for (const cell of computeContourCells(6, 6, sil, 17)) {
      for (const [a, b, c] of cell.triangles) {
        const [ax, ay] = cell.polygon[a]
        const [bx, by] = cell.polygon[b]
        const [cx, cy] = cell.polygon[c]
        const area = (bx - ax) * (-cy + ay) - (-by + ay) * (cx - ax)
        expect(area).toBeGreaterThanOrEqual(-1e-12)
      }
    }
  })

  it('cuts large transparent holes out of the mesh', () => {
    const cols = 10
    const rows = 10
    // Opaque frame with a 6×6 transparent window in the middle.
    const sil = silhouetteFromBoolGrid(grid(rows, cols, (r, c) => r < 2 || r > 7 || c < 2 || c > 7), cols, rows)
    const cells = computeContourCells(cols, rows, sil)
    expect(cells.find((c) => c.key === '5_5')).toBeUndefined()
    expect(cells.find((c) => c.key === '0_0')?.full).toBe(true)
  })
})
