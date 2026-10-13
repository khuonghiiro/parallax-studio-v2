import { describe, it, expect } from 'vitest'
import { computeNextLayerZ } from '../useLayerWorkshop'

describe('2D Layer Cutter Stacking & Z-Index Ordering Rules', () => {
  it('assigns z = 11 (10 + 1) to the first added layer in an empty composite', () => {
    const layers: { z?: number }[] = []
    const firstZ = computeNextLayerZ(layers)
    expect(firstZ).toBe(11) // 10 + 1 (tay vào trước)
  })

  it('assigns z = 12 (10 + 1 + 1) to the second added layer, and increments by +1 sequentially', () => {
    const layers: { z?: number }[] = []

    // 1. Tay vào trước: z = 10 + 1 = 11
    const tayZ = computeNextLayerZ(layers)
    expect(tayZ).toBe(11)
    layers.push({ z: tayZ })

    // 2. Áo vào sau: z = 10 + 1 + 1 = 12 (nằm đè lên tay)
    const aoZ = computeNextLayerZ(layers)
    expect(aoZ).toBe(12)
    layers.push({ z: aoZ })

    // 3. Quần vào sau: z = 13 (nằm đè lên áo)
    const quanZ = computeNextLayerZ(layers)
    expect(quanZ).toBe(13)
    layers.push({ z: quanZ })

    // 4. Áo khoác vào sau: z = 14
    const khoacZ = computeNextLayerZ(layers)
    expect(khoacZ).toBe(14)
  })

  it('handles existing layers where some z-indexes are below 10 by using base 10', () => {
    // If old legacy layers had z = 0 or 5, new layer will start at max(10, maxZ) + 1 = 11
    const legacyLayers = [{ z: 0 }, { z: 5 }]
    const nextZ = computeNextLayerZ(legacyLayers)
    expect(nextZ).toBe(11)
  })

  it('honors customZ when explicitly provided (e.g. from template slots)', () => {
    const layers = [{ z: 11 }, { z: 12 }]
    const customZ = computeNextLayerZ(layers, 30)
    expect(customZ).toBe(30)
  })
})

describe('2D Layer Cutter Smart Tag Placement Rules', () => {
  function getTagPlacement(w: number, h: number, y: number): string {
    const isInside = h >= 34 && w >= 46
    const isNearTop = y < 22
    return isInside ? 'inside-top-left' : isNearTop ? 'outside-bottom' : 'outside-top'
  }

  it('places tag inside-top-left when box is tall and wide enough, preventing overlap with box above', () => {
    // Like Mảnh #3 (145x51) in user screenshot
    const placement = getTagPlacement(145, 51, 80)
    expect(placement).toBe('inside-top-left')
  })

  it('places tag outside-top when box is shallow and not near top edge', () => {
    // Like Mảnh #4 (77x24) in user screenshot
    const placement = getTagPlacement(77, 24, 50)
    expect(placement).toBe('outside-top')
  })

  it('places tag outside-bottom when box is shallow but near top edge', () => {
    const placement = getTagPlacement(77, 24, 10)
    expect(placement).toBe('outside-bottom')
  })
})
