import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  computeColorDist,
  extractRegionDataUrl,
  createCutterStroke,
  scanRawIslandsFromData
} from './chromaKey'
import { computeChromaMatteAlpha } from './chromaAdvancedProcessor'
import { DEFAULT_CHROMA_SETTINGS } from './types'

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

  it('builds a soft chroma matte while preserving non-key subject colors', () => {
    const settings = {
      ...DEFAULT_CHROMA_SETTINGS,
      keyColorType: 'chroma_green' as const,
      keyColorHex: '#00DB4E',
      tolerance: 36,
      smoothness: 8
    }
    expect(computeChromaMatteAlpha(0, 219, 78, 255, settings)).toBe(0)
    const edgeAlpha = computeChromaMatteAlpha(120, 180, 100, 255, settings)
    expect(edgeAlpha).toBeGreaterThan(0)
    expect(edgeAlpha).toBeLessThan(255)
    expect(computeChromaMatteAlpha(220, 45, 35, 255, settings)).toBe(255)
  })

  it('supports blue-screen matte extraction', () => {
    const settings = {
      ...DEFAULT_CHROMA_SETTINGS,
      keyColorType: 'chroma_blue' as const,
      keyColorHex: '#005CE6'
    }
    expect(computeChromaMatteAlpha(0, 92, 230, 255, settings)).toBe(0)
    expect(computeChromaMatteAlpha(230, 70, 30, 255, settings)).toBe(255)
  })

  it('maps proxy island bounds back to natural 8K coordinates', () => {
    const width = 20
    const height = 20
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let y = 4; y < 8; y++) {
      for (let x = 5; x < 9; x++) pixels[(y * width + x) * 4 + 3] = 255
    }
    const islands = scanRawIslandsFromData(pixels, width, height, 4)
    expect(islands).toHaveLength(1)
    expect(islands[0]).toMatchObject({ x: 12, y: 8, width: 32, height: 32, area: 256 })
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

  it('performs continuous smooth stroke segment interpolation with createCutterStroke', () => {
    const w = 50
    const h = 50
    const targetBuffer = new Uint8ClampedArray(w * h * 4)
    // Fill all pixels with opaque white (255, 255, 255, 255)
    for (let i = 0; i < w * h; i++) {
      targetBuffer[i * 4] = 255
      targetBuffer[i * 4 + 1] = 255
      targetBuffer[i * 4 + 2] = 255
      targetBuffer[i * 4 + 3] = 255
    }

    const mockTargetCtx = {
      canvas: { width: w, height: h },
      getImageData: () => ({ data: targetBuffer }),
      putImageData: () => {}
    } as unknown as CanvasRenderingContext2D

    // Khởi tạo stroke tẩy xóa với bán kính 5px, hardness 1.0 (sắc nét)
    const stroke = createCutterStroke(mockTargetCtx, null, w, h, {
      radius: 5,
      hardness: 1.0,
      opacity: 1.0,
      isEraser: true
    })

    // Vẽ nét quét ngang từ (10, 20) tới (30, 20)
    stroke.segment({ x: 10, y: 20 }, { x: 30, y: 20 })
    expect(stroke.changed).toBe(true)

    // Kiểm tra pixel tại điểm bắt đầu (10, 20): alpha = 0
    const idxStart = (20 * w + 10) * 4
    expect(targetBuffer[idxStart + 3]).toBe(0)

    // Điểm chính giữa đoạn (20, 20): nội suy liên tục không bị đứt đoạn, alpha = 0
    const idxMid = (20 * w + 20) * 4
    expect(targetBuffer[idxMid + 3]).toBe(0)

    // Điểm kết thúc (30, 20): alpha = 0
    const idxEnd = (20 * w + 30) * 4
    expect(targetBuffer[idxEnd + 3]).toBe(0)

    // Điểm xa ngoài bán kính (20, 40): không bị ảnh hưởng, alpha vẫn là 255
    const idxFar = (40 * w + 20) * 4
    expect(targetBuffer[idxFar + 3]).toBe(255)
  })

  it('restores raw pixels when isEraser is false', () => {
    const w = 40
    const h = 40
    const targetBuffer = new Uint8ClampedArray(w * h * 4) // Đã bị tẩy alpha = 0
    const rawBuffer = new Uint8ClampedArray(w * h * 4) // Pixel gốc màu đỏ (255, 0, 0, 255)
    for (let i = 0; i < w * h; i++) {
      rawBuffer[i * 4] = 255
      rawBuffer[i * 4 + 1] = 0
      rawBuffer[i * 4 + 2] = 0
      rawBuffer[i * 4 + 3] = 255
    }

    const mockTargetCtx = {
      canvas: { width: w, height: h },
      getImageData: () => ({ data: targetBuffer }),
      putImageData: () => {}
    } as unknown as CanvasRenderingContext2D

    const mockRawCtx = {
      canvas: { width: w, height: h },
      getImageData: () => ({ data: rawBuffer }),
      putImageData: () => {}
    } as unknown as CanvasRenderingContext2D

    const stroke = createCutterStroke(mockTargetCtx, mockRawCtx, w, h, {
      radius: 6,
      hardness: 1.0,
      opacity: 1.0,
      isEraser: false
    })

    // Khôi phục tại (15, 15)
    stroke.segment({ x: 15, y: 15 }, { x: 15, y: 15 })
    expect(stroke.changed).toBe(true)

    // Pixel tại (15, 15) được phục hồi thành màu đỏ nguyên bản (255, 0, 0, 255)
    const idx = (15 * w + 15) * 4
    expect(targetBuffer[idx]).toBe(255)
    expect(targetBuffer[idx + 1]).toBe(0)
    expect(targetBuffer[idx + 3]).toBe(255)
  })

  it('clusters nearby small facial strokes (eyes, nose, mouth) into a single facial expression island', async () => {
    const { detectOpaqueIslands } = await import('./chromaKey')
    const w = 300
    const h = 300
    const buf = new Uint8ClampedArray(w * h * 4)

    function fillRect(x0: number, y0: number, rw: number, rh: number) {
      for (let y = y0; y < y0 + rh; y++) {
        for (let x = x0; x < x0 + rw; x++) {
          const idx = (y * w + x) * 4
          buf[idx] = 20
          buf[idx + 1] = 20
          buf[idx + 2] = 20
          buf[idx + 3] = 255
        }
      }
    }

    // Vẽ mắt trái, mắt phải, mũi nhỏ và miệng cười nằm gần nhau trong phạm vi 1 khuôn mặt
    fillRect(40, 40, 16, 12) // Mắt trái
    fillRect(68, 40, 16, 12) // Mắt phải
    fillRect(58, 56, 6, 8)   // Mũi nhỏ
    fillRect(50, 70, 24, 6)  // Miệng

    // Vẽ 1 bộ phận lớn nằm xa (ví dụ: Thân áo)
    fillRect(160, 120, 80, 110)

    const mockCtx = {
      getImageData: () => ({ data: buf })
    } as unknown as CanvasRenderingContext2D

    const islands = detectOpaqueIslands(mockCtx, w, h, 80)
    expect(islands).toHaveLength(2)
    expect(islands[0].width).toBeGreaterThanOrEqual(44)
    expect(islands[0].height).toBeGreaterThanOrEqual(36)
  })

  it('protects internal white pixels (eyes/shirt) when isolationMode is outer_only (BFS)', async () => {
    const { processAdvancedChromaPixelData } = await import('./chromaAdvancedProcessor')
    const w = 20
    const h = 20
    const data = new Uint8ClampedArray(w * h * 4)

    // Fill entire canvas with white background (255, 255, 255, 255)
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 255
      data[i * 4 + 1] = 255
      data[i * 4 + 2] = 255
      data[i * 4 + 3] = 255
    }

    // Draw a closed dark ring from (5,5) to (14,14) with white interior (7..12, 7..12)
    for (let y = 5; y <= 14; y++) {
      for (let x = 5; x <= 14; x++) {
        const isBorder = x <= 6 || x >= 13 || y <= 6 || y >= 13
        if (isBorder) {
          const idx = (y * w + x) * 4
          data[idx] = 20
          data[idx + 1] = 20
          data[idx + 2] = 25
          data[idx + 3] = 255
        }
      }
    }

    processAdvancedChromaPixelData(data, w, h, {
      enabled: true,
      keyColorHex: '#FFFFFF',
      keyColorType: 'pure_white',
      isolationMode: 'outer_only',
      tolerance: 30,
      smoothness: 0,
      despill: false,
      defringeStrength: 0,
      edgeSmooth: 0,
      despeckleSize: 0
    })

    // Outer corner pixel (0, 0) must be transparent (alpha = 0)
    expect(data[3]).toBe(0)
    // Interior white pixel (9, 9) inside the closed dark border must remain protected (alpha = 255)
    const innerIdx = (9 * w + 9) * 4
    expect(data[innerIdx + 3]).toBe(255)
  })

  it('computes grid islands accurately and samples 9x9 pixel grid for Photoshop Eyedropper', async () => {
    const { computeGridIslands } = await import('./chromaAdvancedProcessor')
    const { sampleEyedropperAtPoint } = await import('./chromaKey')

    const cells = computeGridIslands(300, 200, { rows: 2, cols: 3, paddingInset: 5 })
    expect(cells).toHaveLength(6)
    expect(cells[0]).toMatchObject({ x: 5, y: 5, width: 90, height: 90 })

    const w = 15
    const h = 15
    const patch = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      patch[i * 4] = 18
      patch[i * 4 + 1] = 210
      patch[i * 4 + 2] = 95
      patch[i * 4 + 3] = 255
    }
    const mockCtx = {
      getImageData: (_x: number, _y: number, rw: number, rh: number) => ({
        data: patch.subarray(0, rw * rh * 4)
      })
    } as unknown as CanvasRenderingContext2D

    const sample = sampleEyedropperAtPoint(mockCtx, w, h, 7, 7, 120, 140, 50, 60, '#FF0055', 4)
    expect(sample.hex).toBe('#12D25F')
    expect(sample.prevHex).toBe('#FF0055')
    expect(sample.pixelGrid).toHaveLength(9)
    expect(sample.pixelGrid[4]).toHaveLength(9)
    expect(sample.pixelGrid[4][4]).toBe('#12D25F')
  })
})
