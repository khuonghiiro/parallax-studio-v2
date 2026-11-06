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
 * 2. Làm mịn cả răng cưa bậc thang ở mép trong (giữa vật thể và nét viền) lẫn mép ngoài
 *    bằng trường mật độ biên mượt (`buildSmoothedContourField`) + khoảng cách Euclid sub-pixel,
 *    biến hình tròn bị răng cưa sau khi tách nền thành đường tròn trơn láng với màu viền đã chọn.
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

  // Trường mật độ biên đã làm mịn (2 lượt Gaussian 5x5) để khử răng cưa bậc thang
  const smoothField = buildSmoothedContourField(coreAlpha, w, h, 2, excludeShadowMask)

  const maxR = Math.ceil(strokeWidth) + 2
  const distMap = new Float32Array(totalPixels)
  distMap.fill(999.0)

  for (let p = 0; p < totalPixels; p++) {
    if (coreAlpha[p] >= 200 && smoothField[p] >= 180) {
      distMap[p] = 0
    }
  }

  // Bảng tra offset hình tròn trong bán kính maxR
  const offsetDx: number[] = []
  const offsetDy: number[] = []
  const offsetD: number[] = []
  for (let dy = -maxR; dy <= maxR; dy++) {
    for (let dx = -maxR; dx <= maxR; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= maxR + 0.25) {
        offsetDx.push(dx)
        offsetDy.push(dy)
        offsetD.push(d)
      }
    }
  }
  const numOffsets = offsetDx.length

  // Quét tìm các pixel biên trên trường mượt để lan truyền khoảng cách chính xác
  for (let y = 0; y < h; y++) {
    const row = y * w
    const ym1 = y > 0 ? (y - 1) * w : 0
    const yp1 = y < h - 1 ? (y + 1) * w : (h - 1) * w

    for (let x = 0; x < w; x++) {
      const p = row + x
      const sa = smoothField[p]
      if (sa < 36) continue

      const xm1 = x > 0 ? x - 1 : 0
      const xp1 = x < w - 1 ? x + 1 : w - 1

      // Kiểm tra có tiếp giáp với vùng biên / nền trong suốt không
      const hasBgNeighbor =
        smoothField[row + xm1] < 160 ||
        smoothField[row + xp1] < 160 ||
        smoothField[ym1 + x] < 160 ||
        smoothField[yp1 + x] < 160 ||
        smoothField[ym1 + xm1] < 96 ||
        smoothField[ym1 + xp1] < 96 ||
        smoothField[yp1 + xm1] < 96 ||
        smoothField[yp1 + xp1] < 96

      if (!hasBgNeighbor) continue

      // Độ lệch sub-pixel dựa trên mật độ trường đã làm mịn (0.0 nếu sa = 255, ~0.5 nếu sa = 128)
      const subPixelOffset = Math.max(0, (255 - sa) / 255) * 0.55

      // Lan truyền khoảng cách hình học chuẩn ra xung quanh
      for (let k = 0; k < numOffsets; k++) {
        const nx = x + offsetDx[k]
        const ny = y + offsetDy[k]
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const np = ny * w + nx
        // Chỉ bỏ qua phần lõi sâu hoàn toàn bên trong
        if (coreAlpha[np] >= 250 && smoothField[np] >= 246) continue

        const d = offsetD[k] + subPixelOffset
        if (d < distMap[np]) {
          distMap[np] = d
        }
      }
    }
  }

  const strokeRgb = parseHexRgb(strokeColorHex || '#ffffff')
  const outerFeather = 0.85
  const outerCutoff = strokeWidth + outerFeather

  for (let p = 0; p < totalPixels; p++) {
    const ca = coreAlpha[p]
    const sa = smoothField[p]
    // 100% bảo toàn phần lõi sâu bên trong vật thể
    if (ca >= 250 && sa >= 246) continue

    const d = distMap[p]
    if (d >= outerCutoff) continue

    // Tính độ phủ nét viền (Stroke Coverage 0.0 .. 1.0)
    let strokeCoverage = 1.0
    if (d > strokeWidth - 0.35) {
      const t = Math.max(0, Math.min(1, (d - (strokeWidth - 0.35)) / (outerFeather + 0.35)))
      strokeCoverage = 1.0 - t * t * (3.0 - 2.0 * t)
    }
    if (strokeCoverage <= 0.005) continue

    const idx = p * 4
    // Dùng mật độ biên mượt cho các răng cưa lồi ra ở mép ngoài để hoà trộn trơn tru vào màu viền
    const effectiveFgByte =
      ca >= 180 && sa < ca ? Math.max(0, Math.min(ca, (sa - 96) * 1.6)) : Math.min(ca, sa)
    const fgA = Math.max(0, Math.min(1, effectiveFgByte / 255.0))

    // Stroke nằm dưới Foreground (Porter-Duff Under):
    const strokeWeight = strokeCoverage * (1.0 - fgA)
    const compAlpha = fgA + strokeWeight
    if (compAlpha <= 0.002) continue

    let outR = (data[idx] * fgA + strokeRgb.r * strokeWeight) / compAlpha
    let outG = (data[idx + 1] * fgA + strokeRgb.g * strokeWeight) / compAlpha
    let outB = (data[idx + 2] * fgA + strokeRgb.b * strokeWeight) / compAlpha
    let outA = compAlpha

    // Nếu có bóng mờ bên dưới, giữ bóng mờ dưới đáy nét viền
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
