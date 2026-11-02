import { describe, expect, it } from 'vitest'
import {
  applyChromaKeyToImageData,
  autoCenterLoopFrames,
  buildGridFrames,
  clusterAndSortBoxes,
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

  it('clusters and sorts boxes deterministically to prevent frame swapping at the end', () => {
    // Simulate a 2x3 grid where boxes in the bottom row have fluctuating vertical positions
    const boxes = [
      // Row 0
      { minX: 10, minY: 12, maxX: 110, maxY: 110 },
      { minX: 120, minY: 8, maxX: 220, maxY: 115 },
      { minX: 230, minY: 15, maxX: 330, maxY: 108 },
      // Row 1 (Bottom row with significant vertical jitter)
      { minX: 10, minY: 210, maxX: 110, maxY: 320 },
      { minX: 120, minY: 180, maxX: 220, maxY: 300 }, // Higher top edge
      { minX: 230, minY: 225, maxX: 330, maxY: 340 }  // Lower bottom edge
    ]

    const sorted = clusterAndSortBoxes(boxes, 'row_first')
    expect(sorted).toHaveLength(6)

    // Row 0 must be in strict left-to-right order
    expect(sorted[0].minX).toBe(10)
    expect(sorted[1].minX).toBe(120)
    expect(sorted[2].minX).toBe(230)

    // Row 1 must also maintain strict left-to-right order without swapping column 2 and 3
    expect(sorted[3].minX).toBe(10)
    expect(sorted[4].minX).toBe(120)
    expect(sorted[5].minX).toBe(230)
  })

  it('supports snake and column-first reading orders', () => {
    const boxes = [
      { minX: 10, minY: 10, maxX: 100, maxY: 100 },
      { minX: 110, minY: 10, maxX: 200, maxY: 100 },
      { minX: 10, minY: 110, maxX: 100, maxY: 200 },
      { minX: 110, minY: 110, maxX: 200, maxY: 200 }
    ]

    const snake = clusterAndSortBoxes(boxes, 'snake')
    expect(snake[0].minX).toBe(10)
    expect(snake[1].minX).toBe(110)
    // Row 1 reverses in snake mode (right to left)
    expect(snake[2].minX).toBe(110)
    expect(snake[3].minX).toBe(10)

    const colFirst = clusterAndSortBoxes(boxes, 'col_first')
    expect(colFirst[0].minX).toBe(10)
    expect(colFirst[0].minY).toBe(10)
    expect(colFirst[1].minX).toBe(10)
    expect(colFirst[1].minY).toBe(110)
  })

  it('detects contour islands, normalizes uniform size, and auto-centers frames', () => {
    const w = 64
    const h = 32
    const raw = new Uint8ClampedArray(w * h * 4)
    // Paint island A: 6x6 at (4..9, 4..9)
    for (let y = 4; y <= 9; y++) {
      for (let x = 4; x <= 9; x++) {
        const idx = (y * w + x) * 4
        raw[idx] = 255
        raw[idx + 3] = 255
      }
    }
    // Paint island B: 10x8 at (30..39, 6..13)
    for (let y = 6; y <= 13; y++) {
      for (let x = 30; x <= 39; x++) {
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
      mergeGap: 1,
      uniformSize: true,
      alignAnchor: 'bottom'
    })

    expect(islands).toHaveLength(2)
    // Both frames must have identical uniform width & height
    expect(islands[0].width).toBe(islands[1].width)
    expect(islands[0].height).toBe(islands[1].height)
    expect(islands[0].width).toBeGreaterThanOrEqual(10)

    const centered = autoCenterLoopFrames(mockCanvas, islands, 20, 'bottom')
    expect(centered).toHaveLength(2)
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
