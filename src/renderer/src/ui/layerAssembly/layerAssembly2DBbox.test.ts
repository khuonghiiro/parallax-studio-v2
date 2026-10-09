import { describe, it, expect } from 'vitest'
import { calculateAnchorPinnedResize } from './layerAssembly2DBbox'

describe('calculateAnchorPinnedResize', () => {
  const baseParams = {
    startX: 100,
    startY: 200,
    startScale: 1.0,
    baseWidth: 100,
    baseHeight: 100,
    minDimension: 10
  }

  it('kéo cạnh phải (e) giữ nguyên vị trí cạnh trái', () => {
    // start left edge = 100 - 50 = 50
    const res = calculateAnchorPinnedResize({
      ...baseParams,
      handle: 'e',
      dx: 40,
      dy: 0
    })

    // newWidth = 100 + 40 = 140
    // newX = 100 + 20 = 120
    // new left edge = 120 - 70 = 50 (giữ nguyên!)
    expect(res.scale).toBe(1.4)
    expect(res.x).toBe(120)
    expect(res.y).toBe(200)

    const leftEdge = res.x - (100 * res.scale) / 2
    expect(leftEdge).toBe(50)
  })

  it('kéo cạnh trái (w) giữ nguyên vị trí cạnh phải', () => {
    // start right edge = 100 + 50 = 150
    // kéo sang trái dx = -30 -> newWidth = 100 - (-30) = 130
    const res = calculateAnchorPinnedResize({
      ...baseParams,
      handle: 'w',
      dx: -30,
      dy: 0
    })

    expect(res.scale).toBe(1.3)
    expect(res.x).toBe(85)
    expect(res.y).toBe(200)

    const rightEdge = res.x + (100 * res.scale) / 2
    expect(rightEdge).toBe(150)
  })

  it('kéo cạnh dưới (s) giữ nguyên vị trí cạnh trên', () => {
    // start top edge = 200 - 50 = 150
    const res = calculateAnchorPinnedResize({
      ...baseParams,
      handle: 's',
      dx: 0,
      dy: 50
    })

    expect(res.scale).toBe(1.5)
    expect(res.y).toBe(225)
    expect(res.x).toBe(100)

    const topEdge = res.y - (100 * res.scale) / 2
    expect(topEdge).toBe(150)
  })

  it('kéo cạnh trên (n) giữ nguyên vị trí cạnh dưới', () => {
    // start bottom edge = 200 + 50 = 250
    // kéo lên trên dy = -40 -> newHeight = 140
    const res = calculateAnchorPinnedResize({
      ...baseParams,
      handle: 'n',
      dx: 0,
      dy: -40
    })

    expect(res.scale).toBe(1.4)
    expect(res.y).toBe(180)
    expect(res.x).toBe(100)

    const bottomEdge = res.y + (100 * res.scale) / 2
    expect(bottomEdge).toBe(250)
  })

  it('kéo góc dưới-phải (se) giữ nguyên góc trên-trái', () => {
    // start top-left = (50, 150)
    const res = calculateAnchorPinnedResize({
      ...baseParams,
      handle: 'se',
      dx: 60,
      dy: 60
    })

    expect(res.scale).toBe(1.6)
    expect(res.x).toBe(130)
    expect(res.y).toBe(230)

    const curTopLeftX = res.x - (100 * res.scale) / 2
    const curTopLeftY = res.y - (100 * res.scale) / 2
    expect(curTopLeftX).toBe(50)
    expect(curTopLeftY).toBe(150)
  })

  it('kéo góc trên-trái (nw) giữ nguyên góc dưới-phải', () => {
    // start bottom-right = (150, 250)
    const res = calculateAnchorPinnedResize({
      ...baseParams,
      handle: 'nw',
      dx: -40,
      dy: -40
    })

    expect(res.scale).toBe(1.4)
    expect(res.x).toBe(80)
    expect(res.y).toBe(180)

    const curBottomRightX = res.x + (100 * res.scale) / 2
    const curBottomRightY = res.y + (100 * res.scale) / 2
    expect(curBottomRightX).toBe(150)
    expect(curBottomRightY).toBe(250)
  })
})
