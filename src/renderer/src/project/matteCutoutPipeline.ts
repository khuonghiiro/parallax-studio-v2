/**
 * Pipeline tách nền Alpha-Matte chuyên nghiệp cho tranh vẽ mỹ thuật 2D (Quốc phong / Donghua):
 * 1. Tự nhận diện màu phông nền chủ đạo ở 4 cạnh ảnh (`#00FF00` xanh lá hoặc `#FF00FF` cánh sen).
 * 2. Tính Alpha Matte mượt theo khoảng cách sắc độ + độ trội kênh màu phông (bảo toàn chi tiết đặc).
 * 3. Khử ám viền màu phông (Despill) + bù sắc biên bán trong suốt để ghép lên mọi nền tối/mờ.
 * 4. Loại bỏ đốm nhiễu rời rạc ngoài biên bằng cụm liên thông 4 hướng.
 * 5. Cắt sát khung bao Alpha (`autoCrop`) kèm đệm an toàn, trả về plate RGBA sẵn sàng cho Parallax 2.5D.
 */

export interface ChromaKeyColor {
  r: number
  g: number
  b: number
  kind: 'green' | 'magenta' | 'custom'
}

export interface CutoutCropBox {
  x: number
  y: number
  width: number
  height: number
}

export interface CutoutMatteOptions {
  keyColor?: ChromaKeyColor
  /** Ngưỡng trong (0..1): điểm có độ lệch nhỏ hơn ngưỡng này bị xoá hoàn toàn (`alpha = 0`). */
  innerTolerance?: number
  /** Ngưỡng ngoài (0..1): điểm có độ lệch lớn hơn ngưỡng này được giữ đặc 100% (`alpha = 255`). */
  outerTolerance?: number
  /** Trọng số phạt khi pixel không trội kênh màu phông (bảo vệ nét mực, da, trắng, đỏ). */
  keyDominanceWeight?: number
  /** Cường độ khử ám màu phông ở vùng biên bán trong suốt (0..1). */
  despillStrength?: number
  /** Cụm đốm rời nhỏ hơn số pixel này sẽ bị xoá khỏi alpha matte (0 = tắt). */
  minSpecklePixels?: number
  /** Lề đệm quanh khung bao khi auto-crop (px). */
  cropPadPx?: number
}

export interface CutoutExtractionResult {
  rgba: Uint8ClampedArray
  width: number
  height: number
  keyColor: ChromaKeyColor
  cropBox: CutoutCropBox
  originalSize: { width: number; height: number }
  opaquePixels: number
  coverageRatio: number
}

const MAX_RGB_DIST = 441.6729559300637

const clampByte = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function classifyChromaKeyKind(r: number, g: number, b: number): ChromaKeyColor['kind'] {
  if (g - Math.max(r, b) >= 40) return 'green'
  if (Math.min(r, b) - g >= 40) return 'magenta'
  return 'custom'
}

function keyDominance(r: number, g: number, b: number, kind: ChromaKeyColor['kind']): number {
  if (kind === 'green') return (g - Math.max(r, b)) / 255
  if (kind === 'magenta') return (Math.min(r, b) - g) / 255
  return 0
}

/** Lấy mẫu dải viền 4 cạnh ảnh để nhận diện màu phông nền chủ đạo mà không bị nhiễu nén làm lệch. */
export function detectDominantBorderKeyColor(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  borderPx = 8
): ChromaKeyColor {
  const pad = Math.max(1, Math.min(borderPx, Math.floor(Math.min(width, height) / 4) || 1))
  const bins = new Map<number, { count: number; sumR: number; sumG: number; sumB: number }>()
  const stride = Math.max(1, Math.floor(Math.max(width, height) / 240))

  const pushPixel = (idx: number): void => {
    if (rgba[idx + 3] < 16) return
    const r = rgba[idx]
    const g = rgba[idx + 1]
    const b = rgba[idx + 2]
    const binKey = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const entry = bins.get(binKey) ?? { count: 0, sumR: 0, sumG: 0, sumB: 0 }
    entry.count++
    entry.sumR += r
    entry.sumG += g
    entry.sumB += b
    bins.set(binKey, entry)
  }

  for (let y = 0; y < height; y += stride) {
    const isTopBottom = y < pad || y >= height - pad
    if (isTopBottom) {
      for (let x = 0; x < width; x += stride) pushPixel((y * width + x) * 4)
    } else {
      for (let x = 0; x < pad; x += stride) pushPixel((y * width + x) * 4)
      for (let x = Math.max(pad, width - pad); x < width; x += stride) pushPixel((y * width + x) * 4)
    }
  }

  let best: { count: number; sumR: number; sumG: number; sumB: number } | null = null
  for (const entry of bins.values()) {
    if (!best || entry.count > best.count) best = entry
  }
  if (!best || best.count === 0) return { r: 0, g: 255, b: 0, kind: 'green' }
  const r = Math.round(best.sumR / best.count)
  const g = Math.round(best.sumG / best.count)
  const b = Math.round(best.sumB / best.count)
  return { r, g, b, kind: classifyChromaKeyKind(r, g, b) }
}

/** Tính kênh Alpha mịn dựa trên khoảng cách RGB và độ trội màu phông nền. */
export function computeChromaAlphaMatte(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  opts: CutoutMatteOptions = {}
): Uint8ClampedArray {
  const key = opts.keyColor ?? detectDominantBorderKeyColor(rgba, width, height)
  const inner = opts.innerTolerance ?? 0.24
  const outer = opts.outerTolerance ?? 0.56
  const weight = opts.keyDominanceWeight ?? (key.kind === 'custom' ? 0 : 0.25)
  const out = new Uint8ClampedArray(rgba)
  const total = width * height

  for (let i = 0; i < total; i++) {
    const idx = i * 4
    const origA = out[idx + 3]
    if (origA === 0) continue
    const r = out[idx]
    const g = out[idx + 1]
    const b = out[idx + 2]
    const dist = Math.hypot(r - key.r, g - key.g, b - key.b) / MAX_RGB_DIST
    const dom = Math.max(0, keyDominance(r, g, b, key.kind))
    const dominancePenalty = Math.max(0, 1 - dom * 1.15) * weight
    const matte = smoothstep(inner, outer, dist + dominancePenalty)
    out[idx + 3] = Math.round((origA * matte))
  }
  return out
}

/** Khử ám sắc phông (`green` hoặc `magenta`) ở vùng biên bán trong suốt mà không làm xỉn vùng đặc bên trong. */
export function despillChromaFringe(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  keyColor: ChromaKeyColor,
  strength = 0.85
): void {
  if (keyColor.kind === 'custom' || strength <= 0) return
  const total = width * height
  for (let i = 0; i < total; i++) {
    const idx = i * 4
    const a = rgba[idx + 3]
    if (a === 0) continue
    const r = rgba[idx]
    const g = rgba[idx + 1]
    const b = rgba[idx + 2]
    // Áp mạnh nhất tại vùng biên bán trong suốt; vùng lõi vẫn khử mạnh khi strength cao để xoá ám hào quang
    const coreFactor = Math.min(1, strength * 0.92)
    const edgeFactor = a < 248 ? Math.min(1, strength) : coreFactor
    if (keyColor.kind === 'green') {
      const cap = Math.max(r, b)
      if (g > cap) rgba[idx + 1] = clampByte(g - (g - cap) * edgeFactor)
    } else if (keyColor.kind === 'magenta') {
      const floorRB = Math.min(r, b)
      if (floorRB > g) {
        const cap = a < 235 ? g + 2 : Math.max(g + 6, Math.round((r + b) * 0.45) - (floorRB - g) * 0.8)
        if (r > cap) rgba[idx] = clampByte(r - (r - cap) * edgeFactor)
        if (b > cap) rgba[idx + 2] = clampByte(b - (b - cap) * edgeFactor)
      }
    }
  }
}

/** Loại bỏ các đảo pixel rời rạc quá nhỏ ngoài rìa sau tách phông (BFS phi đệ quy an toàn bộ nhớ). */
export function pruneAlphaSpeckles(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  minClusterPixels = 24
): number {
  if (minClusterPixels <= 1) return 0
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  const cluster = new Int32Array(total)
  let removed = 0

  for (let start = 0; start < total; start++) {
    if (visited[start] || rgba[start * 4 + 3] < 16) continue
    let head = 0
    let tail = 0
    let count = 0
    visited[start] = 1
    queue[tail++] = start

    while (head < tail) {
      const cur = queue[head++]
      cluster[count++] = cur
      const x = cur % width
      const y = (cur - x) / width
      if (x > 0 && !visited[cur - 1] && rgba[(cur - 1) * 4 + 3] >= 16) {
        visited[cur - 1] = 1; queue[tail++] = cur - 1
      }
      if (x + 1 < width && !visited[cur + 1] && rgba[(cur + 1) * 4 + 3] >= 16) {
        visited[cur + 1] = 1; queue[tail++] = cur + 1
      }
      if (y > 0 && !visited[cur - width] && rgba[(cur - width) * 4 + 3] >= 16) {
        visited[cur - width] = 1; queue[tail++] = cur - width
      }
      if (y + 1 < height && !visited[cur + width] && rgba[(cur + width) * 4 + 3] >= 16) {
        visited[cur + width] = 1; queue[tail++] = cur + width
      }
    }

    if (count < minClusterPixels) {
      for (let k = 0; k < count; k++) {
        rgba[cluster[k] * 4 + 3] = 0
        removed++
      }
    }
  }
  return removed
}

/** Cắt sát khung bao chứa nội dung thực (`alpha > 8`) kèm đệm lề an toàn. */
export function autoCropTightAlphaBounds(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  padPx = 12
): { rgba: Uint8ClampedArray; width: number; height: number; cropBox: CutoutCropBox } {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    const empty = new Uint8ClampedArray(4)
    return { rgba: empty, width: 1, height: 1, cropBox: { x: 0, y: 0, width: 1, height: 1 } }
  }
  const pad = Math.max(0, Math.round(padPx))
  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const cw = Math.min(width - 1, maxX + pad) - x0 + 1
  const ch = Math.min(height - 1, maxY + pad) - y0 + 1
  const cropped = new Uint8ClampedArray(cw * ch * 4)
  for (let row = 0; row < ch; row++) {
    const srcStart = ((y0 + row) * width + x0) * 4
    cropped.set(rgba.subarray(srcStart, srcStart + cw * 4), row * cw * 4)
  }
  return { rgba: cropped, width: cw, height: ch, cropBox: { x: x0, y: y0, width: cw, height: ch } }
}

/** Chạy trọn vẹn pipeline tách nền 5 bước và trả về plate PNG RGBA sạch sẵn dùng cho Parallax 2.5D. */
export function extractForegroundPlate(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  opts: CutoutMatteOptions = {}
): CutoutExtractionResult {
  const keyColor = opts.keyColor ?? detectDominantBorderKeyColor(rgba, width, height)
  const matte = computeChromaAlphaMatte(rgba, width, height, { ...opts, keyColor })
  despillChromaFringe(matte, width, height, keyColor, opts.despillStrength ?? 0.85)
  pruneAlphaSpeckles(matte, width, height, opts.minSpecklePixels ?? 24)
  const cropped = autoCropTightAlphaBounds(matte, width, height, opts.cropPadPx ?? 12)
  let opaquePixels = 0
  for (let i = 3; i < cropped.rgba.length; i += 4) if (cropped.rgba[i] > 128) opaquePixels++
  return {
    rgba: cropped.rgba,
    width: cropped.width,
    height: cropped.height,
    keyColor,
    cropBox: cropped.cropBox,
    originalSize: { width, height },
    opaquePixels,
    coverageRatio: Math.round((opaquePixels / Math.max(1, cropped.width * cropped.height)) * 1000) / 1000
  }
}
