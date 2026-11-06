import type { ChromaKeySettings } from './types'

function parseHexRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#ffffff').replace('#', '').trim()
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0
    }
  }
  const num = parseInt(clean, 16)
  if (Number.isNaN(num)) return { r: 255, g: 255, b: 255 }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

/**
 * Xây dựng trường mật độ biên đã làm mịn (Smoothed Contour Field 0..255) bằng bộ lọc
 * Gaussian tách biến 5x5 ([1, 4, 6, 4, 1] / 16) kết hợp bảo vệ chi tiết mảnh.
 */
function buildSmoothedContourField(
  alphaSnap: Uint8Array,
  w: number,
  h: number,
  passes: number,
  excludeShadowMask?: Uint8Array | null
): Float32Array {
  const totalPixels = w * h
  const src = new Float32Array(totalPixels)
  const tmp = new Float32Array(totalPixels)

  for (let p = 0; p < totalPixels; p++) {
    const a = alphaSnap[p]
    if (excludeShadowMask && excludeShadowMask[p] && a < 165) {
      src[p] = 0
    } else {
      src[p] = a
    }
  }

  let curr = src
  let scratch = tmp
  const numPasses = Math.max(1, Math.min(3, passes))

  for (let pass = 0; pass < numPasses; pass++) {
    // Lượt ngang (Horizontal 1D [1, 4, 6, 4, 1] / 16)
    for (let y = 0; y < h; y++) {
      const row = y * w
      for (let x = 0; x < w; x++) {
        const xm2 = x > 1 ? x - 2 : x > 0 ? x - 1 : 0
        const xm1 = x > 0 ? x - 1 : 0
        const xp1 = x < w - 1 ? x + 1 : w - 1
        const xp2 = x < w - 2 ? x + 2 : x < w - 1 ? x + 1 : w - 1
        scratch[row + x] =
          (curr[row + xm2] +
            curr[row + xm1] * 4 +
            curr[row + x] * 6 +
            curr[row + xp1] * 4 +
            curr[row + xp2]) *
          0.0625
      }
    }

    // Lượt dọc (Vertical 1D [1, 4, 6, 4, 1] / 16)
    for (let y = 0; y < h; y++) {
      const ym2 = (y > 1 ? y - 2 : y > 0 ? y - 1 : 0) * w
      const ym1 = (y > 0 ? y - 1 : 0) * w
      const y0 = y * w
      const yp1 = (y < h - 1 ? y + 1 : h - 1) * w
      const yp2 = (y < h - 2 ? y + 2 : y < h - 1 ? y + 1 : h - 1) * w
      for (let x = 0; x < w; x++) {
        curr[y0 + x] =
          (scratch[ym2 + x] +
            scratch[ym1 + x] * 4 +
            scratch[y0 + x] * 6 +
            scratch[yp1 + x] * 4 +
            scratch[yp2 + x]) *
          0.0625
      }
    }
  }

  // Bảo vệ sợi tóc mảnh / chi tiết 1-2px
  for (let p = 0; p < totalPixels; p++) {
    const origA = alphaSnap[p]
    if (origA >= 180 && (!excludeShadowMask || !excludeShadowMask[p])) {
      if (curr[p] < origA * 0.72) {
        curr[p] = origA * 0.72
      }
    }
  }

  return curr
}

/**
 * Lọc răng cưa đường viền (Contour Anti-Aliasing) cho cả biên nhị phân sắc cạnh (255) lẫn biên mềm,
 * không hồi sinh các pixel nền đã tách (origA === 0).
 */
function applyContourEdgeSmooth(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  const edgeSmooth = settings.edgeSmooth ?? 0
  if (edgeSmooth <= 0) return

  const passes = edgeSmooth >= 6 ? 2 : 1
  const smoothField = buildSmoothedContourField(alphaSnap, w, h, passes, excludeShadowMask)
  const smoothStrength = Math.min(1, edgeSmooth / 8)
  const smoothColorType = settings.smoothColorType || 'none'
  const tintRgb =
    smoothColorType === 'black'
      ? { r: 15, g: 15, b: 18 }
      : smoothColorType === 'white'
      ? { r: 255, g: 255, b: 255 }
      : smoothColorType === 'custom'
      ? parseHexRgb(settings.smoothColorHex || '#000000')
      : null

  for (let y = 1; y < h - 1; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const p = row + x
      if (excludeShadowMask && excludeShadowMask[p]) continue
      const origA = alphaSnap[p]
      if (origA === 0) continue
      if (origA === 255) {
        if (edgeSmooth < 3) continue
        const lowCount =
          (alphaSnap[p - 1] < 120 ? 1 : 0) +
          (alphaSnap[p + 1] < 120 ? 1 : 0) +
          (alphaSnap[p - w] < 120 ? 1 : 0) +
          (alphaSnap[p + w] < 120 ? 1 : 0)
        if (lowCount < 2) continue
      }
      const targetA = smoothField[p]

      const minN = Math.min(
        alphaSnap[p - 1],
        alphaSnap[p + 1],
        alphaSnap[p - w],
        alphaSnap[p + w]
      )
      const maxN = Math.max(
        alphaSnap[p - 1],
        alphaSnap[p + 1],
        alphaSnap[p - w],
        alphaSnap[p + w]
      )
      if (maxN - minN < 12) continue

      const newA = Math.max(
        0,
        Math.min(255, Math.round(origA * (1 - smoothStrength) + targetA * smoothStrength))
      )
      const idx = p * 4
      data[idx + 3] = newA

      if (tintRgb && newA > 0 && newA < 250) {
        const blend = (1 - newA / 255) * smoothStrength * 0.78
        data[idx] = Math.round(data[idx] * (1 - blend) + tintRgb.r * blend)
        data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + tintRgb.g * blend)
        data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + tintRgb.b * blend)
      }
    }
  }
}

/**
 * Vẽ Viền nét ngoài (Smooth Outer Contour Stroke - chuẩn Adobe Photoshop Layer Style Stroke):
 * 1. Bảo toàn tuyệt đối 100% pixel bên trong nhân vật và nét vẽ gốc (Foreground OVER Stroke),
 *    không bao giờ lem màu viền vào da hay làm tối màu nét vẽ có sẵn.
 * 2. Lan truyền khoảng cách Euclid chuẩn xác từ toàn bộ các pixel mầm biên của vật thể,
 *    tạo đường viền ngoài trơn láng, tròn đều, sắc sảo và chống răng cưa sub-pixel.
 */
function applySmoothContourStroke(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  strokeWidth: number,
  strokeColorHex: string,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  const totalPixels = w * h
  if (totalPixels === 0 || strokeWidth <= 0) return

  const coreAlpha = new Uint8Array(totalPixels)
  for (let p = 0; p < totalPixels; p++) {
    const a = data[p * 4 + 3]
    alphaSnap[p] = a
    // Nếu là bóng mờ bán trong suốt thì không coi là lõi vật thể để vẽ viền ngoài
    coreAlpha[p] = excludeShadowMask && excludeShadowMask[p] && a < 165 ? 0 : a
  }

  const maxR = Math.ceil(strokeWidth) + 1
  const outerCutoff = strokeWidth + 0.65
  const distMap = new Float32Array(totalPixels)
  distMap.fill(999.0)

  // Bảng tra offset hình tròn trong bán kính maxR
  const offsetDx: number[] = []
  const offsetDy: number[] = []
  const offsetD: number[] = []
  for (let dy = -maxR; dy <= maxR; dy++) {
    for (let dx = -maxR; dx <= maxR; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= outerCutoff) {
        offsetDx.push(dx)
        offsetDy.push(dy)
        offsetD.push(d)
      }
    }
  }
  const numOffsets = offsetDx.length

  // Quét tìm các pixel mầm biên (Edge Seeds: coreAlpha >= 160 tiếp giáp với pixel nền hoặc biên trong suốt)
  for (let y = 0; y < h; y++) {
    const row = y * w
    const ym1 = y > 0 ? (y - 1) * w : 0
    const yp1 = y < h - 1 ? (y + 1) * w : (h - 1) * w

    for (let x = 0; x < w; x++) {
      const p = row + x
      const ca = coreAlpha[p]
      if (ca < 160) continue

      const xm1 = x > 0 ? x - 1 : 0
      const xp1 = x < w - 1 ? x + 1 : w - 1

      // Kiểm tra có tiếp giáp với vùng nền hoặc mép ảnh không
      const isEdgeSeed =
        x === 0 ||
        x === w - 1 ||
        y === 0 ||
        y === h - 1 ||
        coreAlpha[row + xm1] < 160 ||
        coreAlpha[row + xp1] < 160 ||
        coreAlpha[ym1 + x] < 160 ||
        coreAlpha[yp1 + x] < 160 ||
        coreAlpha[ym1 + xm1] < 100 ||
        coreAlpha[ym1 + xp1] < 100 ||
        coreAlpha[yp1 + xm1] < 100 ||
        coreAlpha[yp1 + xp1] < 100

      if (!isEdgeSeed) continue

      // Lan truyền khoảng cách Euclid chuẩn ra xung quanh
      for (let k = 0; k < numOffsets; k++) {
        const nx = x + offsetDx[k]
        const ny = y + offsetDy[k]
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const np = ny * w + nx
        // Không ghi đè khoảng cách vào lõi sâu của vật thể
        if (coreAlpha[np] >= 180) continue

        const d = offsetD[k]
        if (d < distMap[np]) {
          distMap[np] = d
        }
      }
    }
  }

  const strokeRgb = parseHexRgb(strokeColorHex || '#ffffff')

  for (let p = 0; p < totalPixels; p++) {
    const ca = coreAlpha[p]
    // 100% BẢO TOÀN VÙNG VẬT THỂ GỐC: Tuyệt đối không thay đổi màu hoặc alpha của nhân vật
    if (ca >= 180) continue

    const d = distMap[p]
    if (d >= outerCutoff) continue

    // Tính độ phủ nét viền (Stroke Coverage 0.0 .. 1.0) với anti-aliasing mượt 1px ở rìa ngoài
    let strokeCoverage = 1.0
    if (d > strokeWidth - 0.5) {
      strokeCoverage = Math.max(0, Math.min(1, strokeWidth + 0.5 - d))
    }
    if (strokeCoverage <= 0.005) continue

    const idx = p * 4
    const fgA = ca / 255.0

    // Stroke nằm DƯỚI Foreground (Porter-Duff Under):
    const strokeA = strokeCoverage * (1.0 - fgA)
    const compAlpha = fgA + strokeA
    if (compAlpha <= 0.002) continue

    let outR = (data[idx] * fgA + strokeRgb.r * strokeA) / compAlpha
    let outG = (data[idx + 1] * fgA + strokeRgb.g * strokeA) / compAlpha
    let outB = (data[idx + 2] * fgA + strokeRgb.b * strokeA) / compAlpha
    let outA = compAlpha

    // Nếu có bóng mờ bên dưới, hoà trộn bóng mờ dưới đáy nét viền
    if (excludeShadowMask && excludeShadowMask[p] && alphaSnap[p] > 0) {
      const shA = alphaSnap[p] / 255.0
      const finalA = outA + shA * (1.0 - outA)
      if (finalA > 0.002) {
        outR = (outR * outA + data[idx] * shA * (1.0 - outA)) / finalA
        outG = (outG * outA + data[idx + 1] * shA * (1.0 - outA)) / finalA
        outB = (outB * outA + data[idx + 2] * shA * (1.0 - outA)) / finalA
        outA = finalA
      }
    }

    data[idx] = Math.max(0, Math.min(255, Math.round(outR)))
    data[idx + 1] = Math.max(0, Math.min(255, Math.round(outG)))
    data[idx + 2] = Math.max(0, Math.min(255, Math.round(outB)))
    data[idx + 3] = Math.max(0, Math.min(255, Math.round(outA * 255)))
  }
}

export function applyEdgeSmoothAndStroke(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  const strokeWidth = Math.max(0, Math.min(10, Number(settings.strokeWidth ?? 0)))

  for (let p = 0; p < w * h; p++) {
    alphaSnap[p] = data[p * 4 + 3]
  }

  if ((settings.edgeSmooth ?? 0) > 0 && strokeWidth <= 0) {
    applyContourEdgeSmooth(data, w, h, settings, alphaSnap, excludeShadowMask)
  }

  if (strokeWidth > 0) {
    applySmoothContourStroke(
      data,
      w,
      h,
      strokeWidth,
      settings.strokeColorHex || '#ffffff',
      alphaSnap,
      excludeShadowMask
    )
  }
}
