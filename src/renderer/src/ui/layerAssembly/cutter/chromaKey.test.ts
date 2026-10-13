import { describe, it, expect } from 'vitest'
import { hexToRgb, computeColorDist, extractRegionDataUrl } from './chromaKey'

describe('chromaKey algorithms', () => {
  it('correctly converts hex colors to rgb', () => {
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
    expect(hexToRgb('#0f0')).toEqual({ r: 0, g: 255, b: 0 })
    expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('computes color distance correctly', () => {
    // Exactly same color -> dist = 0
    expect(computeColorDist(0, 255, 0, 0, 255, 0)).toBe(0)
    // Black vs White -> max distance 100
    const maxDist = computeColorDist(0, 0, 0, 255, 255, 255)
    expect(Math.round(maxDist)).toBe(100)
    // Small variation
    const nearGreen = computeColorDist(10, 245, 10, 0, 255, 0)
    expect(nearGreen).toBeLessThan(10)
  })

  it('handles extractRegionDataUrl with mock canvas', () => {
    const mockCtx = {
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      clip: () => {},
      drawImage: () => {}
    }
    const mockCanvas = {
      width: 100,
      height: 100,
      getContext: () => mockCtx,
      toDataURL: () => 'data:image/png;base64,mocked'
    } as unknown as HTMLCanvasElement

    // In Node without document.createElement, global document can be mocked
    const originalDoc = (globalThis as unknown as { document?: unknown }).document
    ;(globalThis as unknown as { document: unknown }).document = {
      createElement: () => mockCanvas
    }

    try {
      const dataUrl = extractRegionDataUrl(mockCanvas, { x: 10, y: 10, width: 20, height: 20 })
      expect(dataUrl).toBe('data:image/png;base64,mocked')
    } finally {
      ;(globalThis as unknown as { document: unknown }).document = originalDoc
    }
  })
})
