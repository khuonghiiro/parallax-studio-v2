import { describe, expect, it } from 'vitest'
import {
  dilateMask,
  signedArea,
  silhouetteBounds,
  silhouetteFromBoolGrid,
  silhouetteFromMask,
  simplifyClosed,
  traceMaskLoops,
  type Pt
} from './silhouette'

const mask = (w: number, h: number, on: (x: number, y: number) => boolean) => {
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = on(x, y) ? 1 : 0
  return { w, h, data }
}

describe('silhouette', () => {
  it('traces one closed loop around a single opaque pixel along its borders', () => {
    const loops = traceMaskLoops(mask(3, 3, (x, y) => x === 1 && y === 1))
    expect(loops).toHaveLength(1)
    for (const [x, y] of loops[0]) {
      expect(x).toBeGreaterThanOrEqual(1)
      expect(x).toBeLessThanOrEqual(2)
      expect(y).toBeGreaterThanOrEqual(1)
      expect(y).toBeLessThanOrEqual(2)
    }
  })

  it('dilates by one pixel', () => {
    const m = dilateMask(mask(5, 5, (x, y) => x === 2 && y === 2))
    expect(Array.from(m.data).filter(Boolean)).toHaveLength(9)
  })

  it('simplifies collinear runs but keeps corners', () => {
    const square: Pt[] = []
    for (let i = 0; i < 10; i++) square.push([i, 0])
    for (let i = 0; i < 10; i++) square.push([10, i])
    for (let i = 10; i > 0; i--) square.push([i, 10])
    for (let i = 10; i > 0; i--) square.push([0, i])
    const simple = simplifyClosed(square, 0.5)
    expect(simple.length).toBeLessThanOrEqual(5)
    expect(Math.abs(signedArea(simple))).toBeCloseTo(100, 0)
  })

  it('orients outer outlines positive and holes negative with nesting', () => {
    const sil = silhouetteFromMask(mask(40, 40, (x, y) => (x >= 4 && x < 36 && y >= 4 && y < 36) && !(x >= 14 && x < 26 && y >= 14 && y < 26)))
    expect(sil.loops).toHaveLength(2)
    const outer = sil.loops.find((l) => l.area > 0)!
    const hole = sil.loops.find((l) => l.area < 0)!
    expect(outer.parent).toBe(-1)
    expect(sil.loops[hole.parent]).toBe(outer)
  })

  it('covers every opaque pixel (outline is never inside the opaque area)', () => {
    const sil = silhouetteFromBoolGrid([[false, true], [true, true]], 2, 2, 8)
    const outer = sil.loops[0]
    expect(outer.area).toBeGreaterThan(0.75 - 1e-9)
  })

  it('reports the opaque bounds in texture UV', () => {
    const sil = silhouetteFromBoolGrid([[false, false], [true, false]], 2, 2, 50)
    const [u0, v0, u1, v1] = silhouetteBounds(sil)
    expect(u0).toBeCloseTo(0, 1)
    expect(u1).toBeCloseTo(0.5, 1)
    expect(v0).toBeCloseTo(0, 1)
    expect(v1).toBeCloseTo(0.5, 1)
    expect(silhouetteBounds(null)).toEqual([0, 0, 1, 1])
  })
})
