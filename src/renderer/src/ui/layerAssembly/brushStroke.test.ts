import { describe, expect, it } from 'vitest'
import { brushPixel, createAlphaStroke } from './brushStroke'

describe('alpha eraser stroke', () => {
  const pixels = () => new Uint8ClampedArray(64 * 64 * 4).fill(255)
  const settings = { radiusX: 8, radiusY: 8, opacity: 0.2, hardness: 1 }
  it('caps opacity per stroke even with repeated overlapping pointer events', () => {
    const data = pixels(), stroke = createAlphaStroke(data, 64, 64, settings)
    for (let i = 0; i < 100; i++) stroke.segment({ x: 32, y: 32 }, { x: 32, y: 32 })
    expect(data[(32 * 64 + 32) * 4 + 3]).toBe(204)
    expect(data[(32 * 64 + 32) * 4]).toBe(255)
  })
  it('is independent of pointer event density along a straight stroke', () => {
    const a = pixels(), b = pixels()
    createAlphaStroke(a, 64, 64, settings).segment({ x: 10, y: 32 }, { x: 54, y: 32 })
    const dense = createAlphaStroke(b, 64, 64, settings)
    for (let x = 10; x < 54; x++) dense.segment({ x, y: 32 }, { x: x + 1, y: 32 })
    expect(a).toEqual(b)
  })
  it('adds erasing on a second stroke and does not change an off-image stroke', () => {
    const data = pixels()
    for (let i = 0; i < 2; i++) createAlphaStroke(data, 64, 64, settings).segment({ x: 32, y: 32 }, { x: 32, y: 32 })
    expect(data[(32 * 64 + 32) * 4 + 3]).toBe(163)
    const outside = createAlphaStroke(data, 64, 64, settings)
    outside.segment({ x: -100, y: -100 }, { x: -50, y: -50 })
    expect(outside.changed).toBe(false)
  })
  it('maps rotated, nonuniform and mirrored layers without clamping away their sign', () => {
    const layer = { x: 30, y: -20, rotation: 90, scale: 2, scaleX: -1, scaleY: 0.5 }
    // Source (60,70) -> local (10,20) -> scale (-20,20) -> rotate (-20,-20).
    expect(brushPixel({ x: 115, y: 40 }, { x: 100, y: 100 }, 1.5, layer, 100, 100))
      .toEqual({ x: 60, y: 70 })
  })
})
