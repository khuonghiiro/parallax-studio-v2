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

  it('extracts semi-transparent clouds and shadows with Color Unmixing in include and only modes', async () => {
    const { processAdvancedChromaPixelData } = await import('./chromaAdvancedProcessor')
    const w = 40
    const h = 40
    const makeTestScene = () => {
      const buf = new Uint8ClampedArray(w * h * 4)
      // Fill with realistic green screen background [0, 164, 42]
      for (let i = 0; i < w * h; i++) {
        buf[i * 4] = 0
        buf[i * 4 + 1] = 164
        buf[i * 4 + 2] = 42
        buf[i * 4 + 3] = 255
      }
      // Solid character block at (6..14, 6..14): dark hair [30, 32, 38]
      for (let y = 6; y <= 14; y++) {
        for (let x = 6; x <= 14; x++) {
          const idx = (y * w + x) * 4
          buf[idx] = 30
          buf[idx + 1] = 32
          buf[idx + 2] = 38
          buf[idx + 3] = 255
        }
      }
      // Semi-transparent white cloud at (24..33, 24..33): ~28% white blended over [0, 164, 42] -> [67, 185, 98]
      for (let y = 24; y <= 33; y++) {
        for (let x = 24; x <= 33; x++) {
          const idx = (y * w + x) * 4
          buf[idx] = 67
          buf[idx + 1] = 185
          buf[idx + 2] = 98
          buf[idx + 3] = 255
        }
      }
      return buf
    }

    // 1. Mode 'off': cloud is removed, solid character remains
    const bufOff = makeTestScene()
    processAdvancedChromaPixelData(bufOff, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      tolerance: 36,
      enabled: true,
      shadowMode: 'off',
      keepShadows: false
    })
    const charIdx = (10 * w + 10) * 4
    const cloudIdx = (28 * w + 28) * 4
    const bgIdx = (2 * w + 2) * 4
    expect(bufOff[bgIdx + 3]).toBe(0)
    expect(bufOff[charIdx + 3]).toBe(255)
    expect(bufOff[cloudIdx + 3]).toBe(0)

    // 2. Mode 'include': both solid character AND unmixed white cloud remain
    const bufInclude = makeTestScene()
    processAdvancedChromaPixelData(bufInclude, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      tolerance: 36,
      enabled: true,
      shadowMode: 'include',
      keepShadows: true,
      shadowType: 'auto',
      shadowRetention: 68,
      shadowSolidThreshold: 62,
      shadowUnmixColor: true
    })
    expect(bufInclude[bgIdx + 3]).toBe(0)
    expect(bufInclude[charIdx + 3]).toBe(255)
    expect(bufInclude[cloudIdx + 3]).toBeGreaterThan(40)
    expect(bufInclude[cloudIdx + 3]).toBeLessThan(200)
    // Cloud color should be unmixed from green [67, 185, 98] to neutral bright white
    expect(bufInclude[cloudIdx]).toBeGreaterThanOrEqual(210)
    expect(bufInclude[cloudIdx + 1]).toBeGreaterThanOrEqual(210)
    expect(bufInclude[cloudIdx + 2]).toBeGreaterThanOrEqual(210)

    // 3. Mode 'only': solid character is removed (alpha = 0), only the cloud remains as a standalone island
    const bufOnly = makeTestScene()
    processAdvancedChromaPixelData(bufOnly, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      tolerance: 36,
      enabled: true,
      shadowMode: 'only',
      keepShadows: true,
      shadowType: 'auto',
      shadowRetention: 68,
      shadowSolidThreshold: 62,
      shadowUnmixColor: true
    })
    expect(bufOnly[bgIdx + 3]).toBe(0)
    expect(bufOnly[charIdx + 3]).toBe(0)
    expect(bufOnly[cloudIdx + 3]).toBeGreaterThan(40)
    const shadowIslands = scanRawIslandsFromData(bufOnly, w, h, 1)
    expect(shadowIslands.length).toBe(1)
    expect(shadowIslands[0].x).toBeGreaterThanOrEqual(20)
    expect(shadowIslands[0].y).toBeGreaterThanOrEqual(20)
  })

  it('unmixes semi-transparent star halos on both bright green (#0AF804) and magenta (#FB05FC) without color rings', async () => {
    const { processAdvancedChromaPixelData } = await import('./chromaAdvancedProcessor')
    const w = 24
    const h = 24

    // 1. Green screen star halo ([10, 248, 4] background, [142, 243, 147] 55% halo, [255, 255, 255] core)
    const greenBuf = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      greenBuf[i * 4] = 10
      greenBuf[i * 4 + 1] = 248
      greenBuf[i * 4 + 2] = 4
      greenBuf[i * 4 + 3] = 255
    }
    const haloIdx = (12 * w + 10) * 4
    greenBuf[haloIdx] = 142
    greenBuf[haloIdx + 1] = 243
    greenBuf[haloIdx + 2] = 147
    const coreIdx = (12 * w + 12) * 4
    greenBuf[coreIdx] = 255
    greenBuf[coreIdx + 1] = 255
    greenBuf[coreIdx + 2] = 255

    processAdvancedChromaPixelData(greenBuf, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      enabled: true,
      keyColorType: 'custom',
      keyColorHex: '#0AF804',
      shadowMode: 'include',
      shadowType: 'auto',
      shadowRetention: 68,
      shadowSolidThreshold: 62,
      shadowUnmixColor: true
    })

    // Background is removed
    expect(greenBuf[3]).toBe(0)
    // Halo pixel is semi-transparent and green tint is completely unmixed to neutral white
    expect(greenBuf[haloIdx + 3]).toBeGreaterThan(80)
    expect(greenBuf[haloIdx + 3]).toBeLessThan(250)
    expect(greenBuf[haloIdx]).toBeGreaterThanOrEqual(230)
    expect(greenBuf[haloIdx + 2]).toBeGreaterThanOrEqual(230)
    expect(greenBuf[haloIdx + 1]).toBeLessThanOrEqual(Math.max(greenBuf[haloIdx], greenBuf[haloIdx + 2]) + 4)

    // 2. Magenta screen star halo ([251, 5, 252] background, [237, 104, 249] 40% halo)
    const magBuf = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
      magBuf[i * 4] = 251
      magBuf[i * 4 + 1] = 5
      magBuf[i * 4 + 2] = 252
      magBuf[i * 4 + 3] = 255
    }
    magBuf[haloIdx] = 237
    magBuf[haloIdx + 1] = 104
    magBuf[haloIdx + 2] = 249

    processAdvancedChromaPixelData(magBuf, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      enabled: true,
      keyColorType: 'custom',
      keyColorHex: '#FB05FC',
      shadowMode: 'include',
      shadowType: 'auto',
      shadowRetention: 68,
      shadowSolidThreshold: 62,
      shadowUnmixColor: true
    })

    expect(magBuf[3]).toBe(0)
    expect(magBuf[haloIdx + 3]).toBeGreaterThan(60)
    expect(magBuf[haloIdx + 3]).toBeLessThan(240)
    // Unmixed from magenta to neutral bright white/cyan (G channel lifted from 104 to >= 230)
    expect(magBuf[haloIdx + 1]).toBeGreaterThanOrEqual(230)
  })

  it('removes magenta anti-aliased fringe and preserves exact original brown hair & jade colors in both off and include shadow modes', async () => {
    const { processAdvancedChromaPixelData } = await import('./chromaAdvancedProcessor')
    const w = 30
    const h = 30

    const buildCharacterOnMagenta = () => {
      const buf = new Uint8ClampedArray(w * h * 4)
      // Fill with magenta background #FB02FA (251, 2, 250)
      for (let i = 0; i < w * h; i++) {
        buf[i * 4] = 251
        buf[i * 4 + 1] = 2
        buf[i * 4 + 2] = 250
        buf[i * 4 + 3] = 255
      }
      // Solid warm brown hair block at (8..21, 8..21): [89, 71, 62]
      for (let y = 8; y <= 21; y++) {
        for (let x = 8; x <= 21; x++) {
          const idx = (y * w + x) * 4
          buf[idx] = 89
          buf[idx + 1] = 71
          buf[idx + 2] = 62
          buf[idx + 3] = 255
        }
      }
      // Jade green gem at center (14, 14): [135, 195, 165]
      const jadeIdx = (14 * w + 14) * 4
      buf[jadeIdx] = 135
      buf[jadeIdx + 1] = 195
      buf[jadeIdx + 2] = 165

      // Anti-aliased magenta-contaminated edge pixels at x=6 (outer AA) and x=7 (inner AA) on row y=14
      const outerEdgeIdx = (14 * w + 6) * 4
      buf[outerEdgeIdx] = 199
      buf[outerEdgeIdx + 1] = 25
      buf[outerEdgeIdx + 2] = 189

      const innerEdgeIdx = (14 * w + 7) * 4
      buf[innerEdgeIdx] = 104
      buf[innerEdgeIdx + 1] = 18
      buf[innerEdgeIdx + 2] = 87

      return buf
    }

    // 1. Mode 'off' with max tolerance (100%): removes stubborn dark-magenta fringe and preserves brown hair
    const bufOff = buildCharacterOnMagenta()
    processAdvancedChromaPixelData(bufOff, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      enabled: true,
      keyColorType: 'custom',
      keyColorHex: '#FB02FA',
      fringeColorType: 'custom',
      fringeColorHex: '#FB02FA',
      isolationMode: 'all',
      tolerance: 100,
      smoothness: 0,
      shadowMode: 'off'
    })

    const outerEdgeIdx = (14 * w + 6) * 4
    const innerEdgeIdx = (14 * w + 7) * 4
    const hairInteriorIdx = (14 * w + 12) * 4
    const jadeIdx = (14 * w + 14) * 4

    expect(bufOff[outerEdgeIdx + 3]).toBe(0)
    expect(bufOff[innerEdgeIdx + 3]).toBe(0)
    expect(bufOff[hairInteriorIdx + 3]).toBe(255)
    expect([bufOff[hairInteriorIdx], bufOff[hairInteriorIdx + 1], bufOff[hairInteriorIdx + 2]]).toEqual([
      89, 71, 62
    ])

    // 2. Mode 'include' with high solid threshold (90%) and unmix enabled:
    // Edge is unmixed cleanly without turning interior brown hair green or jade gem pink
    const bufInc = buildCharacterOnMagenta()
    processAdvancedChromaPixelData(bufInc, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      enabled: true,
      keyColorType: 'custom',
      keyColorHex: '#FB02FA',
      fringeColorType: 'custom',
      fringeColorHex: '#FB02FA',
      isolationMode: 'all',
      tolerance: 100,
      smoothness: 0,
      shadowMode: 'include',
      shadowRetention: 76,
      shadowSolidThreshold: 90,
      shadowUnmixColor: true
    })

    // Interior brown hair must stay 100% opaque and keep exact warm brown RGB (R > G > B, never green)
    expect(bufInc[hairInteriorIdx + 3]).toBe(255)
    expect([bufInc[hairInteriorIdx], bufInc[hairInteriorIdx + 1], bufInc[hairInteriorIdx + 2]]).toEqual([
      89, 71, 62
    ])
    // Jade gem must stay exact jade green
    expect(bufInc[jadeIdx + 3]).toBe(255)
    expect([bufInc[jadeIdx], bufInc[jadeIdx + 1], bufInc[jadeIdx + 2]]).toEqual([135, 195, 165])
    // Inner edge pixel (104, 18, 87) has its purple spill unmixed so blue no longer exceeds green
    expect(bufInc[innerEdgeIdx + 2]).toBeLessThanOrEqual(bufInc[innerEdgeIdx + 1] + 4)

    // 3. Smoothness (Mềm biên = 20px): creates a monotonic smooth alpha gradient without discoloring interior
    const bufFeather = buildCharacterOnMagenta()
    processAdvancedChromaPixelData(bufFeather, w, h, {
      ...DEFAULT_CHROMA_SETTINGS,
      enabled: true,
      keyColorType: 'custom',
      keyColorHex: '#FB02FA',
      isolationMode: 'all',
      tolerance: 80,
      smoothness: 12,
      shadowMode: 'off'
    })
    const aEdge1 = bufFeather[(14 * w + 8) * 4 + 3]
    const aEdge2 = bufFeather[(14 * w + 10) * 4 + 3]
    const aCenter = bufFeather[(14 * w + 14) * 4 + 3]
    expect(aEdge1).toBeGreaterThan(0)
    expect(aEdge1).toBeLessThan(aEdge2)
    expect(aEdge2).toBeLessThanOrEqual(aCenter)
    expect(aCenter).toBe(255)
  })

  it('draws a continuous, smooth anti-aliased stroke around a jagged circle in both off and include shadow modes', async () => {
    const { processAdvancedChromaPixelData } = await import('./chromaAdvancedProcessor')
    const w = 64
    const h = 64
    const cx = 32
    const cy = 32
    const radius = 14

    const buildJaggedCircleOnMagenta = () => {
      const buf = new Uint8ClampedArray(w * h * 4)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4
          const dist = Math.hypot(x - cx, y - cy)
          // Tạo hình tròn có răng cưa bậc thang ở rìa (stair-step jaggedness)
          const jitter = ((x + y) % 2 === 0 ? 0.45 : -0.45)
          if (dist <= radius + jitter) {
            buf[idx] = 90
            buf[idx + 1] = 72
            buf[idx + 2] = 64
            buf[idx + 3] = 255
          } else {
            buf[idx] = 252
            buf[idx + 1] = 2
            buf[idx + 2] = 250
            buf[idx + 3] = 255
          }
        }
      }
      return buf
    }

    for (const shadowMode of ['off', 'include'] as const) {
      const buf = buildJaggedCircleOnMagenta()
      processAdvancedChromaPixelData(buf, w, h, {
        ...DEFAULT_CHROMA_SETTINGS,
        enabled: true,
        keyColorType: 'custom',
        keyColorHex: '#FC02FA',
        isolationMode: 'all',
        tolerance: 45,
        smoothness: 2,
        shadowMode,
        shadowRetention: 68,
        shadowSolidThreshold: 62,
        strokeWidth: 4,
        strokeColorHex: '#112233'
      })

      // Kiểm tra 16 góc đều quanh hình tròn tại bán kính r = radius + 2 (nằm giữa thân nét viền 4px):
      // Mọi góc đều phải có nét viền đặc (alpha = 255) và đúng màu #112233 (17, 34, 51), không bị đứt đoạn hay tạo cục u
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 2) / 16
        const sx = Math.round(cx + Math.cos(angle) * (radius + 2))
        const sy = Math.round(cy + Math.sin(angle) * (radius + 2))
        const idx = (sy * w + sx) * 4
        expect(buf[idx + 3]).toBe(255)
        expect([buf[idx], buf[idx + 1], buf[idx + 2]]).toEqual([17, 34, 51])
      }

      // Kiểm tra vùng nét viền ngay sát rìa (r = radius + 1): phủ đặc bởi màu viền #112233
      const seamIdx = (cy * w + (cx + radius + 1)) * 4
      expect(buf[seamIdx + 3]).toBe(255)
      expect([buf[seamIdx], buf[seamIdx + 1], buf[seamIdx + 2]]).toEqual([17, 34, 51])

      // Kiểm tra tâm hình tròn: vẫn giữ nguyên 100% màu gốc [90, 72, 64]
      const centerIdx = (cy * w + cx) * 4
      expect(buf[centerIdx + 3]).toBe(255)
      expect([buf[centerIdx], buf[centerIdx + 1], buf[centerIdx + 2]]).toEqual([90, 72, 64])
    }
  })
})

