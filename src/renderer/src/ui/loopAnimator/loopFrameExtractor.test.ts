import { describe, expect, it } from 'vitest'
import {
  applyChromaKeyToImageData,
  autoCenterLoopFrames,
  buildGridFrames,
  detectContourFrames,
  parseHexRgb
} from './loopFrameExtractor'
import type { ChromaKeyConfig, GridSlicerConfig } from './types'

describe('loopFrameExtractor', () => {
  it('parses hex RGB colors accurately', () => {
    expect(parseHexRgb('#ff00ff')).toEqual([255, 0, 255])
    expect(parseHexRgb('#00ff00')).toEqual([0, 255, 0])
    expect(parseHexRgb('#123')).toEqual([17, 34, 51])
  })

  it('computes grid frames in row-first order (left to right, top to bottom)', () => {
    const config: GridSlicerConfig = {
      rows: 4,
      cols: 4,
      paddingX: 0,
      paddingY: 0,
      marginX: 0,
      marginY: 0
    }
    const frames = buildGridFrames(1024, 1024, config)
    expect(frames).toHaveLength(16)

    // First frame: Row 0, Col 0
    expect(frames[0].x).toBe(0)
    expect(frames[0].y).toBe(0)
    expect(frames[0].width).toBe(256)
    expect(frames[0].height).toBe(256)

    // Second frame: Row 0, Col 1 (moving right)
    expect(frames[1].x).toBe(256)
    expect(frames[1].y).toBe(0)

    // Fifth frame: Row 1, Col 0 (next row down)
    expect(frames[4].x).toBe(0)
    expect(frames[4].y).toBe(256)

    // Last frame: Row 3, Col 3
    expect(frames[15].x).toBe(768)
    expect(frames[15].y).toBe(768)
  })

  it('detects contour islands and auto-centers frames', () => {
    const w = 32
    const h = 16
    const raw = new Uint8ClampedArray(w * h * 4)
    // Paint two 6x6 opaque islands at (4..9, 4..9) and (20..25, 4..9)
    for (let y = 4; y <= 9; y++) {
      for (let x = 4; x <= 9; x++) {
        const idx = (y * w + x) * 4
        raw[idx] = 255
        raw[idx + 3] = 255
      }
    }
    for (let y = 4; y <= 9; y++) {
      for (let x = 20; x <= 25; x++) {
        const idx = (y * w + x) * 4
        raw[idx] = 255
        raw[idx + 3] = 255
      }
    }
    const imgData = { data: raw, width: w, height: h } as ImageData
    const mockCanvas = {
      width: w,
      height: h,
      getContext: () => ({
        getImageData: () => imgData
      })
    } as unknown as HTMLCanvasElement
    const islands = detectContourFrames(mockCanvas, {
      alphaThreshold: 20,
      minArea: 16,
      mergeGap: 1
    })
    expect(islands).toHaveLength(2)
    expect(islands[0].x).toBeLessThan(islands[1].x)
    expect(islands[0].width).toBeGreaterThanOrEqual(6)

    const centered = autoCenterLoopFrames(mockCanvas, islands, 20)
    expect(centered).toHaveLength(2)
    expect(Math.abs(centered[0].offsetX)).toBeLessThanOrEqual(1)
    expect(Math.abs(centered[0].offsetY)).toBeLessThanOrEqual(1)
  })

  it('applies chroma key to make background transparent', () => {
    const rawData = new Uint8ClampedArray(16)
    const data = { data: rawData, width: 2, height: 2 } as ImageData
    // Pixel 0: Pure magenta (should become transparent)
    data.data[0] = 255
    data.data[1] = 0
    data.data[2] = 255
    data.data[3] = 255

    // Pixel 1: Pure green (should remain opaque)
    data.data[4] = 0
    data.data[5] = 255
    data.data[6] = 0
    data.data[7] = 255

    const chroma: ChromaKeyConfig = {
      enabled: true,
      keyColor: '#ff00ff',
      similarity: 0.3,
      smoothness: 0.05,
      spill: 0.1
    }

    applyChromaKeyToImageData(data, chroma)

    // Pixel 0 is keyed out
    expect(data.data[3]).toBe(0)
    // Pixel 1 is kept
    expect(data.data[7]).toBe(255)
  })
})
