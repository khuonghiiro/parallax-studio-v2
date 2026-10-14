import { describe, it, expect } from 'vitest'
import { hexToRgb, computeColorDist, extractRegionDataUrl, createCutterStroke } from './chromaKey'

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
})
