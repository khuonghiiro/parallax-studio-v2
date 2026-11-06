import { processAdvancedChromaPixelData } from '../layerAssembly/cutter/chromaAdvancedProcessor'
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
    edgeSmooth: 0,
    strokeWidth: 0,
    strokeColorHex: '#ffffff',
    // Cùng pipeline với Xưởng lắp ráp 2.5D; "Chỉ nền ngoài" chỉ loang từ mép ảnh nên giữ nguyên phần ruột
    // (ví dụ ruột vòng tròn / quầng sáng bên trong đường viền)
    isolationMode: resolveLoopIsolationMode(chroma),
    strictOuterIsolation: true,
    // Chỉ loại bỏ mảng màu xanh/lam/hồng đục khi xoá bóng trên phông màu;
    // tuyệt đối không xoá quầng sáng/hào quang trên phông đen/tối
    removeSoftHalo: (chroma.shadowMode ?? 'off') === 'off' && (kr > 30 || kg > 30 || kb > 30),
    cleanupMode: 'all',
    previewMode: 'transparent'
  }
}

/** Phạm vi tách nền hiệu lực; mẫu cũ không có trường này giữ hành vi "Tách toàn bộ" */
export function resolveLoopIsolationMode(chroma: Pick<ChromaKeyConfig, 'isolationMode'>): LoopIsolationMode {
  return chroma.isolationMode === 'outer_only' ? 'outer_only' : 'all'
}

/**
 * Apply Chroma Key background removal, optional semi-transparent shadow/glow extraction,
 * and spill suppression in-place on ImageData.
 * Mọi chế độ dùng chung pipeline giải pha màu của Xưởng lắp ráp 2.5D:
 * - `isolationMode = 'outer_only'` (Chỉ nền ngoài): chỉ tách nền liên thông với mép ảnh, giữ nguyên phần ruột.
 * - `isolationMode = 'all'` (Tách toàn bộ): tách cả nền trong lẫn ngoài đường viền.
 * - "Xoá bóng" loại sạch quầng / bóng bán trong suốt (không để lại mảng xanh đục), "Lấy cả bóng" / "Chỉ lấy bóng"
 *   giải pha màu để bóng mờ / hào quang trong suốt đúng độ đậm và hết ám màu nền.
 */
export function applyChromaKeyToImageData(imageData: ImageData, chroma: ChromaKeyConfig): void {
  if (!chroma.enabled) return
  const settings = buildAdvancedCutterSettings(chroma)
  processAdvancedChromaPixelData(imageData.data, imageData.width, imageData.height, settings)
}
