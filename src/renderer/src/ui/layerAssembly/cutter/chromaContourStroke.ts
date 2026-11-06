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
 * Vẽ Viền nét ngoài (Smooth Outer Stroke - chuẩn Photoshop Layer Style Stroke):
 * 1. Bảo toàn tuyệt đối 100% pixel bên trong nhân vật và nét vẽ gốc (Foreground OVER Stroke),
 *    không bao giờ lem màu viền vào da hay làm nhòe nét vẽ có sẵn.
 * 2. Tính khoảng cách Euclid liên tục dưới mức pixel từ biên alpha đã làm mịn:
 *    D(x, y) = min_{s} ( sqrt((x - xs)^2 + (y - ys)^2) + (1 - a_s / 255) )
 *    giúp khoảng cách trơn tru tuyệt đối, không dùng chia đạo hàm nên không bao giờ bị gai hay loang mực.
 * 3. Làm mượt nhẹ trường khoảng cách bằng nhân Gaussian 3x3 và khử răng cưa smoothstep ở mép ngoài.
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
  const coreAlpha = new Uint8Array(totalPixels)
  for (let p = 0; p < totalPixels; p++) {
    const a = data[p * 4 + 3]
    alphaSnap[p] = a
    coreAlpha[p] = excludeShadowMask && excludeShadowMask[p] && a < 165 ? 0 : a
  }

  // Trường alpha làm mịn nhẹ (1 lượt Gaussian 5x5) để khử bậc thang răng cưa trên đường cong/hình tròn
  const smoothAlpha = buildSmoothedContourField(coreAlpha, w, h, 1, null)

  // Bảng tra khoảng cách hình tròn bán kính maxR = ceil(strokeWidth) + 2
  const maxR = Math.ceil(strokeWidth) + 2
  const offsetDx: number[] = []
  const offsetDy: number[] = []
  const offsetDist: number[] = []
  for (let dy = -maxR; dy <= maxR; dy++) {
    for (let dx = -maxR; dx <= maxR; dx++) {
      const d = Math.hypot(dx, dy)
      if (d <= maxR + 0.25) {
        offsetDx.push(dx)
        offsetDy.push(dy)
        offsetDist.push(d)
      }
    }
  }
  const numOffsets = offsetDx.length

  const inf = 1000.0
  const distMap = new Float32Array(totalPixels)
  distMap.fill(inf)

  // Bước 1: Thu thập các pixel biên và lan truyền khoảng cách Euclid liên tục dưới mức pixel
  for (let y = 0; y < h; y++) {
    const row = y * w
    const ym1 = (y > 0 ? y - 1 : 0) * w
    const yp1 = (y < h - 1 ? y + 1 : h - 1) * w
    for (let x = 0; x < w; x++) {
      const p = row + x
      const ca = coreAlpha[p]
      const sa = smoothAlpha[p]
      const effA = ca > sa ? ca * 0.65 + sa * 0.35 : sa * 0.75 + ca * 0.25
      if (effA < 24) continue

      const xm1 = x > 0 ? x - 1 : 0
      const xp1 = x < w - 1 ? x + 1 : w - 1

      // Kiểm tra pixel nằm trong lõi đặc hoàn toàn (cả 4 hướng đều đặc >= 250)
      if (
        ca >= 250 &&
        coreAlpha[row + xm1] >= 250 &&
        coreAlpha[row + xp1] >= 250 &&
        coreAlpha[ym1 + x] >= 250 &&
        coreAlpha[yp1 + x] >= 250
      ) {
        distMap[p] = 0
        continue
      }

      // Độ dịch chuyển dưới mức pixel (0.0 với pixel đặc 255, tăng tuyến tính tới ~0.9 với pixel biên mờ)
      const subPixelDelta = Math.max(0, 1.0 - effA / 255.0)

      for (let k = 0; k < numOffsets; k++) {
        const nx = x + offsetDx[k]
        const ny = y + offsetDy[k]
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const np = ny * w + nx
        const d = offsetDist[k] + subPixelDelta
        if (d < distMap[np]) {
          distMap[np] = d
        }
      }
    }
  }

  // Bước 2: Làm mượt trường khoảng cách bằng nhân Gaussian 3x3 ([1,2,1; 2,4,2; 1,2,1]/16)
  // giúp đường đồng mức ngoài của nét viền tròn trịa, tuyệt đối không có gai hay bậc thang
  const smoothDist = new Float32Array(totalPixels)
  smoothDist.set(distMap)
  const bandLimit = strokeWidth + 1.85
  for (let y = 1; y < h - 1; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const p = row + x
      const d0 = distMap[p]
      if (d0 <= 0 || d0 > bandLimit) continue
      smoothDist[p] =
        (distMap[p - w - 1] +
          distMap[p - w] * 2 +
          distMap[p - w + 1] +
          distMap[p - 1] * 2 +
          d0 * 4 +
          distMap[p + 1] * 2 +
          distMap[p + w - 1] +
          distMap[p + w] * 2 +
          distMap[p + w + 1]) *
        0.0625
    }
  }

  // Bước 3: Hòa trộn chuẩn Porter-Duff (Foreground OVER Stroke)
  // Giữ nguyên 100% màu sắc & đường nét bên trong nhân vật, chỉ vẽ nét viền đệm phía sau mép và mở rộng ra ngoài
  const strokeRgb = parseHexRgb(strokeColorHex || '#ffffff')
  const outerStart = Math.max(0.15, strokeWidth - 0.35)
  const outerEnd = strokeWidth + 0.75
  const outerSpan = Math.max(0.5, outerEnd - outerStart)

  for (let p = 0; p < totalPixels; p++) {
    const d = smoothDist[p]
    if (d >= outerEnd) continue

    const ca = coreAlpha[p]
    const sa = smoothAlpha[p]
    // Pixel đặc bên trong nhân vật: bảo toàn nguyên vẹn 100% màu gốc
    if (ca >= 250 && sa >= 235) continue

    let strokeCoverage = 1.0
    if (d > outerStart) {
      const t = Math.max(0, Math.min(1, (d - outerStart) / outerSpan))
      strokeCoverage = 1.0 - t * t * (3.0 - 2.0 * t)
    }
    if (strokeCoverage <= 0.004) continue

    const idx = p * 4
    // Tại mép răng cưa ngoài cùng (ca > 0), kết hợp nhẹ với smoothAlpha để làm mịn gai 1px
    // nhưng không bao giờ ăn sâu vào phần ruột bên trong
    const fgAlphaVal = ca >= 245 ? Math.min(ca, ca * 0.65 + sa * 0.35) : ca
    const fgA = fgAlphaVal / 255.0

    const strokeUnderWeight = strokeCoverage * (1.0 - fgA)
    const compAlpha = fgA + strokeUnderWeight
    if (compAlpha <= 0.001) continue

    let outR = (data[idx] * fgA + strokeRgb.r * strokeUnderWeight) / compAlpha
    let outG = (data[idx + 1] * fgA + strokeRgb.g * strokeUnderWeight) / compAlpha
    let outB = (data[idx + 2] * fgA + strokeRgb.b * strokeUnderWeight) / compAlpha
    let outA = compAlpha

    // Nếu bên dưới có lớp bóng mờ bán trong suốt (chế độ Lấy cả bóng), hòa trộn lên trên bóng
    if (excludeShadowMask && excludeShadowMask[p] && alphaSnap[p] > 0) {
      const shA = alphaSnap[p] / 255.0
      const finalA = outA + shA * (1.0 - outA)
      if (finalA > 0.001) {
        outR = (outR * outA + data[idx] * shA * (1.0 - outA)) / finalA
        outG = (outG * outA + data[idx + 1] * shA * (1.0 - outA)) / finalA
        outB = (outB * outA + data[idx + 2] * shA * (1.0 - outA)) / finalA
        outA = finalA
      }
    }

    data[idx] = Math.round(outR)
    data[idx + 1] = Math.round(outG)
    data[idx + 2] = Math.round(outB)
    data[idx + 3] = Math.min(255, Math.round(outA * 255))
  }
}

/**
 * Xử lý tổng hợp Lọc răng cưa biên (Edge Smooth) và Viền nét làm mịn biên (Smooth Contour Stroke).
 */
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
