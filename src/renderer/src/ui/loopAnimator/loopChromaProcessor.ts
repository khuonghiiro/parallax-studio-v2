import { processAdvancedChromaPixelData } from '../layerAssembly/cutter/chromaAdvancedProcessor'
import { floodFromBorder, growMaskWithin, transparentSeed } from '../layerAssembly/cutter/chromaOuterIsolation'
import type { ChromaKeySettings } from '../layerAssembly/cutter/types'
import type { ChromaKeyConfig, GridSlicerConfig, LoopIsolationMode } from './types'

/**
 * Parse a hex color string (#rrggbb) into [r, g, b] in 0..255.
 */
export function parseHexRgb(hex: string): [number, number, number] {
  const clean = (hex || '#00ff00').replace('#', '').trim()
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0
    const g = parseInt(clean[1] + clean[1], 16) || 0
    const b = parseInt(clean[2] + clean[2], 16) || 0
    return [r, g, b]
  }
  const num = parseInt(clean, 16)
  if (Number.isNaN(num)) return [0, 255, 0]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

/**
 * Sample the dominant corner pixel color of an image to auto-detect background key color.
 * Steps inward past any outer border frame (`borderPadding` or ~1.8% inset) so black grid frames
 * around the sprite sheet are never mistaken for the background key color.
 */
export function detectCornerKeyColor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  borderPadding = 0
): string {
  const inset = Math.min(
    Math.floor(Math.min(width, height) * 0.2),
    Math.max(12, Math.round(borderPadding) + 6, Math.floor(Math.min(width, height) * 0.018))
  )
  const pts: [number, number][] = [
    [inset, inset],
    [Math.max(0, width - 1 - inset), inset],
    [inset, Math.max(0, height - 1 - inset)],
    [Math.max(0, width - 1 - inset), Math.max(0, height - 1 - inset)]
  ]
  let rSum = 0
  let gSum = 0
  let bSum = 0
  for (const [x, y] of pts) {
    const d = ctx.getImageData(x, y, 1, 1).data
    rSum += d[0]
    gSum += d[1]
    bSum += d[2]
  }
  const r = Math.round(rSum / pts.length)
  const g = Math.round(gSum / pts.length)
  const b = Math.round(bSum / pts.length)
  const toHex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Xoá trong suốt (alpha = 0) toàn bộ các pixel nằm trên đường viền lưới trong phạm vi `borderPadding`
 * (bao gồm cả khung viền ngoài cùng và vạch kẻ ngăn cách giữa các ô lưới).
 */
export function clearGridBorderPadding(imageData: ImageData, grid: GridSlicerConfig): void {
  const pad = Math.max(0, Math.round(grid.borderPadding ?? 0))
  if (pad <= 0) return

  const w = imageData.width
  const h = imageData.height
  if (w <= 0 || h <= 0) return

  const cols = Math.max(1, Math.min(32, Math.round(grid.cols)))
  const rows = Math.max(1, Math.min(32, Math.round(grid.rows)))
  const usableW = Math.max(1, w - grid.marginX * 2 - grid.paddingX * (cols - 1))
  const usableH = Math.max(1, h - grid.marginY * 2 - grid.paddingY * (rows - 1))
  const cellW = Math.max(1, Math.floor(usableW / cols))
  const cellH = Math.max(1, Math.floor(usableH / rows))

  const validX = new Uint8Array(w)
  const validY = new Uint8Array(h)

  for (let c = 0; c < cols; c++) {
    const baseX = Math.round(grid.marginX + c * (cellW + grid.paddingX))
    const startX = Math.max(0, Math.min(w, baseX + pad))
    const endX = Math.max(startX, Math.min(w, baseX + cellW - pad))
    for (let x = startX; x < endX; x++) {
      validX[x] = 1
    }
  }

  for (let r = 0; r < rows; r++) {
    const baseY = Math.round(grid.marginY + r * (cellH + grid.paddingY))
    const startY = Math.max(0, Math.min(h, baseY + pad))
    const endY = Math.max(startY, Math.min(h, baseY + cellH - pad))
    for (let y = startY; y < endY; y++) {
      validY[y] = 1
    }
  }

  const data = imageData.data
  for (let y = 0; y < h; y++) {
    const rowOff = y * w
    if (!validY[y]) {
      for (let x = 0; x < w; x++) {
        data[(rowOff + x) * 4 + 3] = 0
      }
      continue
    }
    for (let x = 0; x < w; x++) {
      if (!validX[x]) {
        data[(rowOff + x) * 4 + 3] = 0
      }
    }
  }
}

function buildAdvancedCutterSettings(chroma: ChromaKeyConfig): ChromaKeySettings {
  const [kr, kg, kb] = parseHexRgb(chroma.keyColor)
  const keyColorType =
    kg > kr + 35 && kg > kb + 30
      ? 'chroma_green'
      : kb > kr + 35 && kb > kg + 30
        ? 'chroma_blue'
        : kr > 235 && kg > 235 && kb > 235
          ? 'pure_white'
          : kr < 20 && kg < 20 && kb < 20
            ? 'pure_black'
            : 'custom'

  return {
    enabled: true,
    keyColorType,
    keyColorHex: chroma.keyColor,
    tolerance: Math.max(1, Math.min(100, Math.round(chroma.similarity * 100))),
    smoothness: Math.max(0, Math.min(30, Math.round(chroma.smoothness * 20))),
    despill: chroma.spill > 0.01,
    defringeStrength: Math.max(0, Math.min(100, Math.round(chroma.spill * 100))),
    shadowRetention: chroma.shadowRetention ?? 68,
    shadowMode: chroma.shadowMode ?? 'off',
    shadowType: chroma.shadowType ?? 'auto',
    shadowSolidThreshold: chroma.shadowSolidThreshold ?? 62,
    shadowUnmixColor: chroma.shadowUnmixColor !== false,
    despeckleSize: 0,
    keepLargestIslandOnly: false,
    edgeChoke: 0,
    edgeSmooth: 1,
    strokeWidth: 0,
    strokeColorHex: '#ffffff',
    // Cùng pipeline tách bóng của Xưởng lắp ráp 2.5D; "Chỉ tách nền ngoài" dùng loang thuần từ mép ảnh
    // để giữ nguyên phần nền nằm kín bên trong viền (ruột vòng tròn)
    isolationMode: resolveLoopIsolationMode(chroma),
    strictOuterIsolation: true,
    cleanupMode: 'all',
    previewMode: 'transparent'
  }
}

/** Phạm vi tách nền hiệu lực; mẫu cũ không có trường này giữ hành vi "Tách toàn bộ" */
export function resolveLoopIsolationMode(chroma: Pick<ChromaKeyConfig, 'isolationMode'>): LoopIsolationMode {
  return chroma.isolationMode === 'outer_only' ? 'outer_only' : 'all'
}

interface SimpleKeyParams {
  kr: number
  kg: number
  kb: number
  lowThresh: number
  highThresh: number
}

function keyDistance(data: Uint8ClampedArray, i: number, k: SimpleKeyParams): number {
  const dr = data[i] - k.kr
  const dg = data[i + 1] - k.kg
  const db = data[i + 2] - k.kb
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * Mặt nạ "nền ngoài" cho chế độ Chỉ tách nền ngoài: loang từ mép ảnh qua các pixel có độ phủ nền
 * >= 50% (tường chắn là viền vật thể), rồi nới thêm 2px vào dải mềm biên để viền ngoài vẫn mịn.
 */
function buildOuterKeyRegion(data: Uint8ClampedArray, w: number, h: number, k: SimpleKeyParams): Uint8Array {
  const total = w * h
  const midThresh = (k.lowThresh + k.highThresh) * 0.5
  const passable = new Uint8Array(total)
  const soft = new Uint8Array(total)
  for (let p = 0; p < total; p++) {
    const i = p * 4
    if (data[i + 3] < 15) {
      passable[p] = 1
      soft[p] = 1
      continue
    }
    const dist = keyDistance(data, i, k)
    if (dist < k.highThresh) {
      soft[p] = 1
      if (dist < midThresh) passable[p] = 1
    }
  }
  const region = floodFromBorder(passable, w, h, transparentSeed(data))
  growMaskWithin(region, soft, w, h, 2)
  return region
}

/**
 * Apply Chroma Key background removal, optional semi-transparent shadow/glow extraction,
 * and spill suppression in-place on ImageData.
 * `isolationMode = 'outer_only'` chỉ xoá nền liên thông với mép ảnh (giữ nền bên trong viền kín).
 */
export function applyChromaKeyToImageData(imageData: ImageData, chroma: ChromaKeyConfig): void {
  if (!chroma.enabled) return

  const shadowMode = chroma.shadowMode ?? 'off'
  if (shadowMode === 'include' || shadowMode === 'only') {
    const settings = buildAdvancedCutterSettings(chroma)
    processAdvancedChromaPixelData(imageData.data, imageData.width, imageData.height, settings)
    return
  }

  const data = imageData.data
  const [kr, kg, kb] = parseHexRgb(chroma.keyColor)
  const sim = Math.max(0.01, chroma.similarity)
  const smooth = Math.max(0.001, chroma.smoothness)
  const spill = Math.max(0, Math.min(1, chroma.spill))

  const maxDist = 441.67295593
  const k: SimpleKeyParams = { kr, kg, kb, lowThresh: sim * maxDist, highThresh: (sim + smooth) * maxDist }
  const range = Math.max(1, k.highThresh - k.lowThresh)
  const region =
    resolveLoopIsolationMode(chroma) === 'outer_only'
      ? buildOuterKeyRegion(data, imageData.width, imageData.height, k)
      : null

  const isGreenDominant = kg > kr + 20 && kg > kb + 20
  const isBlueDominant = kb > kr + 20 && kb > kg + 20
  const isMagentaDominant = kr > kg + 35 && kb > kg + 35

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) continue
    if (region && !region[i >> 2]) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const dist = keyDistance(data, i, k)

    if (dist <= k.lowThresh) {
      data[i + 3] = 0
    } else if (dist < k.highThresh) {
      const factor = (dist - k.lowThresh) / range
      data[i + 3] = Math.round(a * factor)
      if (spill > 0) {
        suppressColorSpill(data, i, r, g, b, spill, isGreenDominant, isBlueDominant, isMagentaDominant)
      }
    } else if (spill > 0 && dist < k.highThresh * 1.35) {
      suppressColorSpill(data, i, r, g, b, spill * 0.5, isGreenDominant, isBlueDominant, isMagentaDominant)
    }
  }
}

function suppressColorSpill(
  data: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  amount: number,
  isGreen: boolean,
  isBlue: boolean,
  isMagenta: boolean
): void {
  if (isGreen) {
    const avgRB = (r + b) * 0.5
    if (g > avgRB) data[i + 1] = Math.round(g - (g - avgRB) * amount)
  } else if (isBlue) {
    const avgRG = (r + g) * 0.5
    if (b > avgRG) data[i + 2] = Math.round(b - (b - avgRG) * amount)
  } else if (isMagenta) {
    if (r > g) data[i] = Math.round(r - (r - g) * amount * 0.75)
    if (b > g) data[i + 2] = Math.round(b - (b - g) * amount * 0.75)
  }
}
