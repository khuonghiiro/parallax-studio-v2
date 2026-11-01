import { describe, it, expect } from 'vitest'
import { findOpaqueBoundingBox } from './imageAutoTrim'

describe('imageAutoTrim - findOpaqueBoundingBox', () => {
  it('detects fully transparent buffer as not found', () => {
    const w = 10, h = 10
    const data = new Uint8Array(w * h * 4) // All zeros
    const result = findOpaqueBoundingBox(data, w, h, 10)
    expect(result.found).toBe(false)
  })

  it('correctly calculates bounding box of opaque pixels', () => {
    const w = 20, h = 20
    const data = new Uint8Array(w * h * 4)

    // Đặt 1 pixel đục tại (5, 7) và 1 pixel tại (14, 18)
    const p1 = (7 * w + 5) * 4
    data[p1 + 3] = 255
    const p2 = (18 * w + 14) * 4
    data[p2 + 3] = 200

    const result = findOpaqueBoundingBox(data, w, h, 10)
    expect(result.found).toBe(true)
    expect(result.minX).toBe(5)
    expect(result.maxX).toBe(14)
    expect(result.minY).toBe(7)
    expect(result.maxY).toBe(18)
  })

  it('ignores semi-transparent pixels below threshold', () => {
    const w = 10, h = 10
    const data = new Uint8Array(w * h * 4)
    const p = (2 * w + 3) * 4
    data[p + 3] = 5 // Dưới threshold 10

    const result = findOpaqueBoundingBox(data, w, h, 10)
    expect(result.found).toBe(false)
  })
})
