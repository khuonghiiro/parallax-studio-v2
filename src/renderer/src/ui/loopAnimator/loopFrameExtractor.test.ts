import { describe, it, expect } from 'vitest'
import {
  computeLoopGridFrames,
  parseHexRgb,
  resolveKeyRgb,
  applyLoopChromaKeyToImageData
} from './loopFrameExtractor'
import type { GridSlicerConfig, LoopChromaConfig } from './types'

describe('loopFrameExtractor', () => {
  it('parses hex RGB colors accurately', () => {
    expect(parseHexRgb('#ff00ff')).toEqual({ r: 255, g: 0, b: 255 })
    expect(parseHexRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
    expect(parseHexRgb('#123')).toEqual({ r: 17, g: 34, b: 51 })
  })

  it('resolves key RGB from chroma config', () => {
    expect(resolveKeyRgb({ enabled: true, keyColorType: 'chroma_magenta', customHex: '', tolerance: 30, smoothness: 10, despill: 20 }))
      .toEqual({ r: 255, g: 0, b: 255 })
    expect(resolveKeyRgb({ enabled: true, keyColorType: 'chroma_green', customHex: '', tolerance: 30, smoothness: 10, despill: 20 }))
      .toEqual({ r: 0, g: 255, b: 0 })
  })

  it('computes grid frames in row_first order (left to right, top to bottom)', () => {
    const config: GridSlicerConfig = {
      rows: 4,
      cols: 4,
      paddingInset: 0,
      order: 'row_first'
    }
    const frames = computeLoopGridFrames(1024, 1024, config)
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

  it('computes grid frames in col_first order (top to bottom, left to right)', () => {
    const config: GridSlicerConfig = {
      rows: 4,
      cols: 4,
      paddingInset: 0,
      order: 'col_first'
    }
    const frames = computeLoopGridFrames(1024, 1024, config)
    expect(frames).toHaveLength(16)

    // First frame: Col 0, Row 0
    expect(frames[0].x).toBe(0)
    expect(frames[0].y).toBe(0)

    // Second frame: Col 0, Row 1 (moving down)
    expect(frames[1].x).toBe(0)
    expect(frames[1].y).toBe(256)

    // Fifth frame: Col 1, Row 0 (next col right)
    expect(frames[4].x).toBe(256)
    expect(frames[4].y).toBe(0)
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

    const chroma: LoopChromaConfig = {
      enabled: true,
      keyColorType: 'chroma_magenta',
      customHex: '#ff00ff',
      tolerance: 30,
      smoothness: 0,
      despill: 0
    }

    applyLoopChromaKeyToImageData(data, chroma)

    // Pixel 0 is keyed out
    expect(data.data[3]).toBe(0)
    // Pixel 1 is kept
    expect(data.data[7]).toBe(255)
  })
})
