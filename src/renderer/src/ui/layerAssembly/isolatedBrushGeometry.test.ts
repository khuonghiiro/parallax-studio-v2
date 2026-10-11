import { describe, expect, it } from 'vitest'
import { isolatedBrushPixel, isolatedImageGeometry } from './isolatedBrushGeometry'
import { createAlphaStroke } from './brushStroke'

describe('isolated pixel editor', () => {
  const rect = { left: 325, top: 590, width: 232, height: 204 }
  it.each([0.25, 0.87, 1, 2, 8, 15])('keeps rendered image and erased pixel aligned at zoom %s', zoom => {
    const transform = { zoom, pan: { x: 31, y: -19 } }
    const g = isolatedImageGeometry(rect, 640, 960, transform)
    const source = { x: 280, y: 600 }
    // Pixel location from the actual centered image bounds (no CSS scale/origin ambiguity).
    const client = { x: rect.left + g.centerX - g.width / 2 + source.x * g.scale,
      y: rect.top + g.centerY - g.height / 2 + source.y * g.scale }
    const p = isolatedBrushPixel(client, rect, 640, 960, transform)
    expect(p.x).toBeCloseTo(source.x)
    expect(p.y).toBeCloseTo(source.y)
    expect((28 / g.fit) * g.scale).toBeCloseTo(28 * zoom)
  })
  it('erases under the pointer after zoom and pan, preserving distant pixels', () => {
    const transform = { zoom: 3, pan: { x: -25, y: 16 } }
    const g = isolatedImageGeometry(rect, 64, 64, transform)
    const p = isolatedBrushPixel({ x: rect.left + g.centerX, y: rect.top + g.centerY }, rect, 64, 64, transform)
    const data = new Uint8ClampedArray(64 * 64 * 4).fill(255)
    createAlphaStroke(data, 64, 64, { radiusX: 8 / g.fit, radiusY: 8 / g.fit, hardness: 1, opacity: 1 }).segment(p, p)
    expect(data[(32 * 64 + 32) * 4 + 3]).toBe(0)
    expect(data[3]).toBe(255)
  })
  it('retains off-image coordinates so a stroke can cross the image edge without jumping', () => {
    expect(isolatedBrushPixel({ x: -100, y: -100 }, rect, 64, 64, { zoom: 1, pan: { x: 0, y: 0 } }).x).toBeLessThan(0)
  })
})
