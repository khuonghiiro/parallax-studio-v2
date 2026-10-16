import { describe, expect, it } from 'vitest'
import { detectCornerBackground } from './cutterHelpers'

function mockCornerContext(
  colorAt: (x: number, y: number) => [number, number, number]
): CanvasRenderingContext2D {
  return {
    canvas: { width: 100, height: 100 },
    getImageData: (x: number, y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4)
      const [r, g, b] = colorAt(x, y)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = 255
      }
      return { data }
    }
  } as unknown as CanvasRenderingContext2D
}

describe('cutter background sampling', () => {
  it('uses the stable corner cluster when one corner is covered by the subject', () => {
    const ctx = mockCornerContext((x, y) => (x < 50 && y < 50 ? [220, 45, 30] : [4, 218, 72]))
    expect(detectCornerBackground(ctx)).toEqual({ type: 'chroma_green', hex: '#04DA48' })
  })

  it('recognises a blue-screen background', () => {
    const ctx = mockCornerContext(() => [3, 76, 224])
    expect(detectCornerBackground(ctx)).toEqual({ type: 'chroma_blue', hex: '#034CE0' })
  })
})
