import type { ChromaKeySettings } from './types'
import { rgbToHex } from './chromaAdvancedProcessor'

export interface DetectedCornerPreset {
  type: ChromaKeySettings['keyColorType']
  hex: string
}

function classifyCornerColor(r: number, g: number, b: number): DetectedCornerPreset {
  const hex = rgbToHex(r, g, b)
  if (g > 110 && g > r + 32 && g > b + 28) return { type: 'chroma_green', hex }
  if (b > 110 && b > r + 28 && b > g + 24) return { type: 'chroma_blue', hex }
  if (r < 30 && g < 30 && b < 30) return { type: 'pure_black', hex: '#000000' }
  if (r > 228 && g > 228 && b > 228) return { type: 'pure_white', hex: '#FFFFFF' }
  return { type: 'custom', hex }
}

/** Tự động phát hiện màu phông bằng cụm màu ổn định nhất trong bốn góc ảnh. */
export function detectCornerBackground(rctx: CanvasRenderingContext2D): DetectedCornerPreset | null {
  const w = Math.max(1, rctx.canvas.width)
  const h = Math.max(1, rctx.canvas.height)
  const size = Math.max(1, Math.min(7, Math.floor(Math.min(w, h) / 12)))
  const inset = Math.max(0, Math.floor(Math.min(w, h) * 0.012))
  const points = [
    [inset, inset],
    [Math.max(0, w - inset - size), inset],
    [inset, Math.max(0, h - inset - size)],
    [Math.max(0, w - inset - size), Math.max(0, h - inset - size)]
  ]
  const samples: Array<{ r: number; g: number; b: number }> = []
  for (const [x, y] of points) {
    const data = rctx.getImageData(x, y, size, size).data
    let rr = 0
    let gg = 0
    let bb = 0
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 30) continue
      rr += data[i]
      gg += data[i + 1]
      bb += data[i + 2]
      count++
    }
    if (count > 0) samples.push({ r: rr / count, g: gg / count, b: bb / count })
  }
  if (samples.length === 0) return null

  const selected = samples.reduce((best, sample) => {
    const distances = samples
      .filter((other) => other !== sample)
      .map((other) => Math.hypot(sample.r - other.r, sample.g - other.g, sample.b - other.b))
      .sort((a, b) => a - b)
    const score = (distances[0] ?? 0) + (distances[1] ?? 0)
    return score < best.score ? { sample, score } : best
  }, { sample: samples[0], score: Number.POSITIVE_INFINITY }).sample

  return classifyCornerColor(Math.round(selected.r), Math.round(selected.g), Math.round(selected.b))
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
