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
 * Xây dựng trường mật độ biên đã làm mịn (Smoothed Contour Field 0..255) bằng 2 lượt
 * bộ lọc Gaussian tách biến 5x5 ([1, 4, 6, 4, 1] / 16) kết hợp bảo vệ chi tiết mảnh (sợi tóc, trâm cài).
 * Nhờ làm mịn trường alpha trước khi trích xuất đường đồng mức 127.5, các bậc thang răng cưa
 * (stair-step aliasing) trên đường tròn hoặc nét cong được chuyển thành đường cong liên tục dưới mức pixel.
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
      // Giảm trọng số bóng mờ bán trong suốt để đường viền bám sát hình khối chính của nhân vật
      src[p] = a * 0.35
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

  // Bảo vệ sợi tóc mảnh / chi tiết 1-2px: nếu pixel gốc đặc (>= 185) nhưng vùng 3x3 xung quanh hẹp
  // (không phải bậc thang của mảng đặc lớn), giữ mức tối thiểu trên ngưỡng 127.5 để nét mảnh không bị đứt
  for (let y = 1; y < h - 1; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const p = row + x
      const origA = alphaSnap[p]
      if (origA < 185 || (excludeShadowMask && excludeShadowMask[p])) continue
      if (curr[p] >= 132) continue
      const solidNeighbors =
        (alphaSnap[p - 1] >= 180 ? 1 : 0) +
        (alphaSnap[p + 1] >= 180 ? 1 : 0) +
        (alphaSnap[p - w] >= 180 ? 1 : 0) +
        (alphaSnap[p + w] >= 180 ? 1 : 0)
      if (solidNeighbors <= 2 && curr[p] >= 52) {
        curr[p] = Math.max(curr[p], 134)
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

      // Chỉ lọc răng cưa trên dải biên nơi có biến thiên alpha xung quanh
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
 * Vẽ Viền nét (Smooth Contour Stroke) khử răng cưa chuẩn Sub-Pixel Signed Distance Field:
 * 1. Làm mịn trường biên bằng Gaussian tách biến 5x5 để triệt tiêu răng cưa bậc thang của hình gốc.
 * 2. Nội suy tọa độ đường cong dưới mức pixel (Sub-Pixel Curve Seed cx, cy) từ đạo hàm bậc nhất.
 * 3. Lan truyền khoảng cách Euclid thực (2-Pass 8-Neighbor Danielsson Vector EDT) + làm mượt trường SDF.
 * 4. Phủ nét viền đè nhẹ vào mép trong (~0.8..1.35px) để xóa sạch vết răng cưa giao tiếp và mở rộng
 *    ra ngoài đúng độ dày `strokeWidth` với biên ngoài khử răng cưa smoothstep mượt mà.
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
  for (let p = 0; p < totalPixels; p++) {
    alphaSnap[p] = data[p * 4 + 3]
  }

  const smoothField = buildSmoothedContourField(alphaSnap, w, h, 2, excludeShadowMask)
  const isoLevel = 122.0
  const inf = 1e6
  const nearestCx = new Float32Array(totalPixels)
  const nearestCy = new Float32Array(totalPixels)
  const bestDistSq = new Float32Array(totalPixels)
  bestDistSq.fill(inf)

  // Bước 1: Khởi tạo hạt giống tọa độ đường cong dưới mức pixel (Sub-Pixel Contour Seeds)
  for (let y = 0; y < h; y++) {
    const row = y * w
    const ym1 = (y > 0 ? y - 1 : 0) * w
    const yp1 = (y < h - 1 ? y + 1 : h - 1) * w
    for (let x = 0; x < w; x++) {
      const p = row + x
      const val = smoothField[p]
      const xm1 = x > 0 ? x - 1 : 0
      const xp1 = x < w - 1 ? x + 1 : w - 1

      const vLeft = smoothField[row + xm1]
      const vRight = smoothField[row + xp1]
      const vUp = smoothField[ym1 + x]
      const vDown = smoothField[yp1 + x]

      const isInside = val >= isoLevel
      const crossesContour =
        (val > 14 && val < 242) ||
        vLeft >= isoLevel !== isInside ||
        vRight >= isoLevel !== isInside ||
        vUp >= isoLevel !== isInside ||
        vDown >= isoLevel !== isInside

      if (!crossesContour) continue

      const gx = (vRight - vLeft) * 0.5
      const gy = (vDown - vUp) * 0.5
      const gradMag = Math.max(24, Math.hypot(gx, gy))
      // Khoảng cách có dấu từ tâm pixel (x, y) tới đường đồng mức isoLevel
      const subOffset = Math.max(-1.15, Math.min(1.15, (isoLevel - val) / gradMag))
      const nx = gx / gradMag
      const ny = gy / gradMag

      // Tọa độ thực (cx, cy) của điểm nằm trên đường cong biên đã làm mịn
      nearestCx[p] = x - subOffset * nx
      nearestCy[p] = y - subOffset * ny
      bestDistSq[p] = subOffset * subOffset
    }
  }

  // Bước 2: Lan truyền khoảng cách Euclid thực 2 lượt (8-Neighbor Danielsson Vector EDT)
  const tryCandidate = (p: number, x: number, y: number, np: number): void => {
    if (bestDistSq[np] >= inf) return
    const cx = nearestCx[np]
    const cy = nearestCy[np]
    const dx = x - cx
    const dy = y - cy
    const dSq = dx * dx + dy * dy
    if (dSq < bestDistSq[p]) {
      bestDistSq[p] = dSq
      nearestCx[p] = cx
      nearestCy[p] = cy
    }
  }

  // Lượt xuôi: Trái-trên -> Phải-dưới
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const p = row + x
      if (x > 0) tryCandidate(p, x, y, p - 1)
      if (y > 0) {
        const up = p - w
        tryCandidate(p, x, y, up)
        if (x > 0) tryCandidate(p, x, y, up - 1)
        if (x < w - 1) tryCandidate(p, x, y, up + 1)
      }
    }
  }

  // Lượt ngược: Phải-dưới -> Trái-trên
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w
    for (let x = w - 1; x >= 0; x--) {
      const p = row + x
      if (x < w - 1) tryCandidate(p, x, y, p + 1)
      if (y < h - 1) {
        const down = p + w
        tryCandidate(p, x, y, down)
        if (x < w - 1) tryCandidate(p, x, y, down + 1)
        if (x > 0) tryCandidate(p, x, y, down - 1)
      }
    }
  }

  // Bước 3: Tính trường khoảng cách có dấu (Signed Distance Field) trong băng tần viền nét
  const maxBand = strokeWidth + 3.0
  const maxBandSq = maxBand * maxBand
  const signedDist = new Float32Array(totalPixels)

  for (let p = 0; p < totalPixels; p++) {
    const dSq = bestDistSq[p]
    const sign = smoothField[p] >= isoLevel ? -1 : 1
    if (dSq >= maxBandSq) {
      signedDist[p] = sign * maxBand
    } else {
      signedDist[p] = sign * Math.sqrt(dSq)
    }
  }

  // Bước 4: Làm mượt nhẹ trường SDF bằng nhân Gaussian 3x3 ([1,2,1; 2,4,2; 1,2,1]/16)
  // để cả đường tiếp giáp phía trong lẫn đường biên phía ngoài của nét vẽ đạt độ trơn C1 hoàn hảo
  const smoothDist = new Float32Array(totalPixels)
  smoothDist.set(signedDist)
  for (let y = 1; y < h - 1; y++) {
    const row = y * w
    for (let x = 1; x < w - 1; x++) {
      const p = row + x
      const d0 = signedDist[p]
      if (d0 < -3.0 || d0 > strokeWidth + 1.8) continue
      smoothDist[p] =
        (signedDist[p - w - 1] +
          signedDist[p - w] * 2 +
          signedDist[p - w + 1] +
          signedDist[p - 1] * 2 +
          d0 * 4 +
          signedDist[p + 1] * 2 +
          signedDist[p + w - 1] +
          signedDist[p + w] * 2 +
          signedDist[p + w + 1]) *
        0.0625
    }
  }

  // Bước 5: Tổng hợp màu Viền nét (Inner Seam Anti-Aliasing + Solid Stroke Body + Outer Sub-Pixel AA)
  const strokeRgb = parseHexRgb(strokeColorHex || '#ffffff')
  const innerOverlap = Math.min(1.4, 0.55 + strokeWidth * 0.16)
  const innerFadeStart = -innerOverlap - 0.85
  const innerFadeEnd = -innerOverlap + 0.3
  const innerSpan = Math.max(0.4, innerFadeEnd - innerFadeStart)

  const outerFadeStart = Math.max(-0.1, strokeWidth - 0.55)
  const outerFadeEnd = strokeWidth + 0.65
  const outerSpan = Math.max(0.5, outerFadeEnd - outerFadeStart)

  for (let p = 0; p < totalPixels; p++) {
    const d = smoothDist[p]
    if (d >= outerFadeEnd) continue

    const idx = p * 4
    const origA = alphaSnap[p]

    // Vùng sâu bên trong nhân vật: giữ nguyên 100% màu gốc và làm đặc hoàn toàn
    if (d <= innerFadeStart) {
      if (origA > 140 && origA < 255 && (!excludeShadowMask || !excludeShadowMask[p])) {
        data[idx + 3] = 255
      }
      continue
    }

    // Vùng giao tiếp phía trong (Inner Seam): phủ màu viền đè lên phần mép răng cưa cũ của hình gốc
    if (d < innerFadeEnd) {
      const t = Math.max(0, Math.min(1, (d - innerFadeStart) / innerSpan))
      const smoothT = t * t * (3 - 2 * t)
      // Nếu pixel mép gốc bị hụt alpha (< 245) do răng cưa, ưu tiên lấp đầy bằng màu viền để không hở lỗ
      const missingAlphaWeight = origA < 245 ? 1 - origA / 255 : 0
      const strokeWeight = Math.max(smoothT, missingAlphaWeight)

      data[idx] = Math.round(data[idx] * (1 - strokeWeight) + strokeRgb.r * strokeWeight)
      data[idx + 1] = Math.round(data[idx + 1] * (1 - strokeWeight) + strokeRgb.g * strokeWeight)
      data[idx + 2] = Math.round(data[idx + 2] * (1 - strokeWeight) + strokeRgb.b * strokeWeight)
      data[idx + 3] = 255
      continue
    }

    // Thân nét viền đặc (Solid Stroke Body): d từ innerFadeEnd tới outerFadeStart
    if (d <= outerFadeStart) {
      data[idx] = strokeRgb.r
      data[idx + 1] = strokeRgb.g
      data[idx + 2] = strokeRgb.b
      data[idx + 3] = 255
      continue
    }

    // Biên ngoài của nét viền (Outer Anti-Aliased Edge): d từ outerFadeStart tới outerFadeEnd
    const tOut = Math.max(0, Math.min(1, (d - outerFadeStart) / outerSpan))
    const strokeCoverage = 1 - tOut * tOut * (3 - 2 * tOut)
    const strokeAlpha = Math.round(255 * strokeCoverage)
    if (strokeAlpha <= 0) continue

    // Nếu bên dưới có bóng mờ bán trong suốt (chế độ Lấy cả bóng), hoà trộn Porter-Duff chuẩn
    if (origA > 0 && excludeShadowMask && excludeShadowMask[p]) {
      const bgAlpha = origA / 255
      const outAlpha = strokeCoverage + bgAlpha * (1 - strokeCoverage)
      if (outAlpha > 0.001) {
        data[idx] = Math.round(
          (strokeRgb.r * strokeCoverage + data[idx] * bgAlpha * (1 - strokeCoverage)) / outAlpha
        )
        data[idx + 1] = Math.round(
          (strokeRgb.g * strokeCoverage + data[idx + 1] * bgAlpha * (1 - strokeCoverage)) / outAlpha
        )
        data[idx + 2] = Math.round(
          (strokeRgb.b * strokeCoverage + data[idx + 2] * bgAlpha * (1 - strokeCoverage)) / outAlpha
        )
        data[idx + 3] = Math.min(255, Math.round(outAlpha * 255))
      }
    } else {
      data[idx] = strokeRgb.r
      data[idx + 1] = strokeRgb.g
      data[idx + 2] = strokeRgb.b
      data[idx + 3] = Math.max(origA, strokeAlpha)
    }
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
