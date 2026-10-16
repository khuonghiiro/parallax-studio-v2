import type { ChromaKeySettings } from './types'
import { rgbToHex } from './chromaAdvancedProcessor'

export interface DetectedCornerPreset {
  type: ChromaKeySettings['keyColorType']
  hex: string
}

/** Tự động phát hiện màu phông nền ở 4 góc ảnh */
export function detectCornerBackground(rctx: CanvasRenderingContext2D): DetectedCornerPreset | null {
  const p = rctx.getImageData(2, 2, 1, 1).data
  const [r, g, b, a] = [p[0], p[1], p[2], p[3]]
  if (a < 30) return null
  const hex = rgbToHex(r, g, b)
  if (g > 130 && g > r + 40 && g > b + 40) {
    return { type: 'chroma_green', hex }
  } else if (b > 130 && b > r + 30 && b > g + 30) {
    return { type: 'chroma_blue', hex }
  } else if (r < 25 && g < 25 && b < 25) {
    return { type: 'pure_black', hex: '#000000' }
  } else if (r > 235 && g > 235 && b > 235) {
    return { type: 'pure_white', hex: '#FFFFFF' }
  }
  return { type: 'custom', hex }
}

export interface CanvasPointerCoords {
  workX: number
  workY: number
  natX: number
  natY: number
  canvasX: number
  canvasY: number
}

/** Tính toạ độ con trỏ chuẩn hoá giữa canvas hiển thị, buffer làm việc và ảnh gốc */
export function computeCanvasPointerCoords(
  e: React.PointerEvent<HTMLCanvasElement>,
  natW: number,
  natH: number
): CanvasPointerCoords {
  const rect = e.currentTarget.getBoundingClientRect()
  const workW = e.currentTarget.width
  const workH = e.currentTarget.height
  const sxWork = workW / Math.max(1, rect.width)
  const syWork = workH / Math.max(1, rect.height)
  const sxNat = natW / Math.max(1, rect.width)
  const syNat = natH / Math.max(1, rect.height)
  return {
    workX: Math.round((e.clientX - rect.left) * sxWork),
    workY: Math.round((e.clientY - rect.top) * syWork),
    natX: Math.round((e.clientX - rect.left) * sxNat),
    natY: Math.round((e.clientY - rect.top) * syNat),
    canvasX: Math.round(e.clientX - rect.left),
    canvasY: Math.round(e.clientY - rect.top)
  }
}
