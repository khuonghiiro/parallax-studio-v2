import type {
  GridSlicerConfig,
  ContourSlicerConfig,
  LoopChromaConfig,
  LoopFrame
} from './types'

export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0
    }
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0
  }
}

export function resolveKeyRgb(chroma: LoopChromaConfig): { r: number; g: number; b: number } {
  switch (chroma.keyColorType) {
    case 'chroma_magenta':
      return { r: 255, g: 0, b: 255 }
    case 'chroma_green':
      return { r: 0, g: 255, b: 0 }
    case 'chroma_blue':
      return { r: 0, g: 0, b: 255 }
    case 'white':
      return { r: 255, g: 255, b: 255 }
    case 'black':
      return { r: 0, g: 0, b: 0 }
    case 'custom':
    default:
      return parseHexRgb(chroma.customHex || '#ff00ff')
  }
}

/**
 * Tách lưới khung hình tuần hoàn theo số hàng và số cột.
 * Hỗ trợ thứ tự hàng trước (Row-first: Trái qua phải, Trên xuống dưới) hoặc cột trước.
 */
export function computeLoopGridFrames(
  imageWidth: number,
  imageHeight: number,
  config: GridSlicerConfig
): LoopFrame[] {
  const rows = Math.max(1, Math.min(32, Math.round(config.rows || 4)))
  const cols = Math.max(1, Math.min(32, Math.round(config.cols || 4)))
  const pad = Math.max(0, Math.min(80, Math.round(config.paddingInset || 0)))

  const cellW = imageWidth / cols
  const cellH = imageHeight / rows
  const frames: LoopFrame[] = []

  let idx = 0

  if (config.order === 'col_first') {
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = Math.round(c * cellW + pad)
        const y = Math.round(r * cellH + pad)
        const bw = Math.max(4, Math.round(cellW - pad * 2))
        const bh = Math.max(4, Math.round(cellH - pad * 2))
        frames.push({
          id: `frame_${idx + 1}`,
          index: idx,
          x,
          y,
          width: bw,
          height: bh,
          enabled: true,
          durationMultiplier: 1,
          offsetX: 0,
          offsetY: 0,
          label: `Frame #${idx + 1} (H${r + 1}-C${c + 1})`
        })
        idx++
      }
    }
  } else {
    // row_first: mặc định từ trái sang phải, từ trên xuống dưới
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.round(c * cellW + pad)
        const y = Math.round(r * cellH + pad)
        const bw = Math.max(4, Math.round(cellW - pad * 2))
        const bh = Math.max(4, Math.round(cellH - pad * 2))
        frames.push({
          id: `frame_${idx + 1}`,
          index: idx,
          x,
          y,
          width: bw,
          height: bh,
          enabled: true,
          durationMultiplier: 1,
          offsetX: 0,
          offsetY: 0,
          label: `Frame #${idx + 1} (H${r + 1}-C${c + 1})`
        })
        idx++
      }
    }
  }

  return frames
}

/**
 * Áp dụng bộ lọc Chroma Key trực tiếp lên ImageData.
 */
export function applyLoopChromaKeyToImageData(
  data: ImageData,
  chroma: LoopChromaConfig
): void {
  if (!chroma.enabled) return

  const { r: kr, g: kg, b: kb } = resolveKeyRgb(chroma)
  const tol = Math.max(1, chroma.tolerance) * 2.55
  const smooth = Math.max(0, chroma.smoothness) * 2.55
  const despill = Math.max(0, Math.min(100, chroma.despill)) / 100

  const pixels = data.data
  const len = pixels.length

  for (let i = 0; i < len; i += 4) {
    const a = pixels[i + 3]
    if (a === 0) continue

    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]

    // Khoảng cách màu Euclidean trong không gian RGB
    const dr = r - kr
    const dg = g - kg
    const db = b - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)

    if (dist < tol) {
      if (smooth > 0 && dist > tol - smooth) {
        const ratio = (dist - (tol - smooth)) / smooth
        pixels[i + 3] = Math.round(a * ratio)
      } else {
        pixels[i + 3] = 0
      }
    } else if (despill > 0 && dist < tol + smooth * 2) {
      // Khử lem viền màu nền
      if (chroma.keyColorType === 'chroma_magenta') {
        const avg = (r + b) / 2
        if (avg > g) {
          const delta = (avg - g) * despill
          pixels[i] = Math.max(0, Math.round(r - delta * 0.5))
          pixels[i + 2] = Math.max(0, Math.round(b - delta * 0.5))
        }
      } else if (chroma.keyColorType === 'chroma_green') {
        const otherMax = Math.max(r, b)
        if (g > otherMax) {
          pixels[i + 1] = Math.round(g - (g - otherMax) * despill)
        }
      }
    }
  }
}

/**
 * Tự động tìm khung bao giới hạn loại bỏ các dải pixel trong suốt quanh frame.
 */
export function autoTrimLoopFrameBounds(
  ctx: CanvasRenderingContext2D,
  frame: LoopFrame
): { x: number; y: number; width: number; height: number } {
  try {
    const imgData = ctx.getImageData(frame.x, frame.y, frame.width, frame.height)
    const { data, width, height } = imgData

    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0
    let hasOpaque = false

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3]
        if (alpha > 15) {
          hasOpaque = true
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }

    if (!hasOpaque || minX > maxX || minY > maxY) {
      return { x: frame.x, y: frame.y, width: frame.width, height: frame.height }
    }

    const pad = 2
    const trimmedX = Math.max(0, minX - pad)
    const trimmedY = Math.max(0, minY - pad)
    const trimmedW = Math.min(width - trimmedX, maxX - minX + 1 + pad * 2)
    const trimmedH = Math.min(height - trimmedY, maxY - minY + 1 + pad * 2)

    return {
      x: frame.x + trimmedX,
      y: frame.y + trimmedY,
      width: Math.max(4, trimmedW),
      height: Math.max(4, trimmedH)
    }
  } catch {
    return { x: frame.x, y: frame.y, width: frame.width, height: frame.height }
  }
}

/**
 * Trích xuất ảnh thumbnail của 1 frame thành DataURL.
 */
export function extractFrameDataUrl(
  sourceCanvas: HTMLCanvasElement,
  frame: LoopFrame
): string {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, frame.width)
  canvas.height = Math.max(1, frame.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.drawImage(
    sourceCanvas,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    0,
    0,
    frame.width,
    frame.height
  )

  return canvas.toDataURL('image/png')
}
