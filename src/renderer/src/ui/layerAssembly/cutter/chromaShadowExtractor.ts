import type { ChromaKeySettings, ChromaShadowMode } from './types'

/**
 * Lấy mẫu tự động màu nền thực tế quanh viền ảnh để tinh chỉnh chính xác màu khóa (Key Color).
 * Giúp xử lý các ảnh phông xanh/lam/trắng/đen có sắc độ lệch với mã preset mặc định
 * (ví dụ phông xanh đậm #00A42A thay vì #00DB4E) để thuật toán Unmix bóng mờ đạt độ chính xác tuyệt đối.
 */
export function resolveImageEffectiveKeyRgb(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  fallbackKey: { r: number; g: number; b: number }
): { r: number; g: number; b: number } {
  if (w < 4 || h < 4) return fallbackKey
  const keyType = settings.keyColorType || 'custom'
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []

  const stepX = Math.max(1, Math.floor(w / 64))
  const stepY = Math.max(1, Math.floor(h / 64))

  const trySample = (x: number, y: number) => {
    const idx = (y * w + x) * 4
    if (data[idx + 3] < 200) return
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]

    if (keyType === 'chroma_green') {
      if (g > r + 22 && g > b + 14) {
        rs.push(r)
        gs.push(g)
        bs.push(b)
      }
    } else if (keyType === 'chroma_blue') {
      if (b > r + 22 && b > g + 14) {
        rs.push(r)
        gs.push(g)
        bs.push(b)
      }
    } else if (keyType === 'pure_white') {
      if (r > 205 && g > 205 && b > 205) {
        rs.push(r)
        gs.push(g)
        bs.push(b)
      }
    } else if (keyType === 'pure_black') {
      if (r < 50 && g < 50 && b < 50) {
        rs.push(r)
        gs.push(g)
        bs.push(b)
      }
    } else {
      const dr = r - fallbackKey.r
      const dg = g - fallbackKey.g
      const db = b - fallbackKey.b
      if (dr * dr + dg * dg + db * db <= 42 * 42) {
        rs.push(r)
        gs.push(g)
        bs.push(b)
      }
    }
  }

  const insetX = Math.min(2, Math.floor((w - 1) / 2))
  const insetY = Math.min(2, Math.floor((h - 1) / 2))
  for (let x = 0; x < w; x += stepX) {
    trySample(x, insetY)
    trySample(x, h - 1 - insetY)
  }
  for (let y = stepY; y < h - stepY; y += stepY) {
    trySample(insetX, y)
    trySample(w - 1 - insetX, y)
  }

  if (rs.length < 8) return fallbackKey

  // Tính trung vị cắt tỉa (trimmed median 25%..75%) để loại bỏ các pixel mây/nhân vật chạm biên
  const trimmedMean = (arr: number[]) => {
    const sorted = arr.slice().sort((a, b) => a - b)
    const s = Math.floor(sorted.length * 0.25)
    const e = Math.max(s + 1, Math.ceil(sorted.length * 0.75))
    let sum = 0
    for (let i = s; i < e; i++) sum += sorted[i]
    return Math.round(sum / (e - s))
  }

  return {
    r: trimmedMean(rs),
    g: trimmedMean(gs),
    b: trimmedMean(bs)
  }
}

/**
 * Giãn nở mặt nạ nhị phân (Separable Box Dilation O(N) 2 lượt ngang-dọc) không cấp phát mảng con.
 * Dùng để tạo vùng đệm bảo vệ biên anti-alias của nhân vật đặc khi tách riêng bóng mờ.
 */
export function dilateMaskBox(
  mask: Uint8Array,
  w: number,
  h: number,
  radius: number
): Uint8Array {
  const total = w * h
  if (radius <= 0 || total === 0) return new Uint8Array(mask)
  const horiz = new Uint8Array(total)
  const out = new Uint8Array(total)

  for (let y = 0; y < h; y++) {
    const rowOff = y * w
    let dist = radius + 1
    for (let x = 0; x < w; x++) {
      if (mask[rowOff + x]) dist = 0
      else dist++
      if (dist <= radius) horiz[rowOff + x] = 1
    }
    dist = radius + 1
    for (let x = w - 1; x >= 0; x--) {
      if (mask[rowOff + x]) dist = 0
      else dist++
      if (dist <= radius) horiz[rowOff + x] = 1
    }
  }

  for (let x = 0; x < w; x++) {
    let dist = radius + 1
    for (let y = 0; y < h; y++) {
      const idx = y * w + x
      if (horiz[idx]) dist = 0
      else dist++
      if (dist <= radius) out[idx] = 1
    }
    dist = radius + 1
    for (let y = h - 1; y >= 0; y--) {
      const idx = y * w + x
      if (horiz[idx]) dist = 0
      else dist++
      if (dist <= radius) out[idx] = 1
    }
  }

  return out
}

export function resolveEffectiveShadowMode(settings: ChromaKeySettings): ChromaShadowMode {
  if (settings.shadowMode === 'only' || settings.shadowMode === 'include') {
    return settings.shadowMode
  }
  if (settings.shadowMode === 'off') {
    return 'off'
  }
  return (settings.shadowRetention ?? 0) > 0 ? 'include' : 'off'
}

/**
 * Tách và khử ám màu nền cho Bóng mờ / Mây khói / Hào quang bán trong suốt (Color Unmixing & Alpha Matting).
 * Hỗ trợ mọi loại nền (Xanh lá, Xanh dương, Trắng, Đen, Màu tuỳ chỉnh) và 2 chế độ:
 * - 'include': Giữ cả vật thể đặc + bóng mờ/mây khói bán trong suốt
 * - 'only': Chỉ tách riêng vùng bóng mờ/mây khói (loại bỏ cả nền phẳng lẫn nhân vật đặc)
 */
export function applyShadowAndMistExtraction(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  keyRgb: { r: number; g: number; b: number },
  activeBg: Uint8Array,
  shadowAlpha: Uint8Array
): Uint8Array | null {
  const mode = resolveEffectiveShadowMode(settings)
  if (mode === 'off') return null

  const totalPixels = w * h
  const rawRetention = settings.shadowRetention ?? 0
  const strength = Math.max(5, Math.min(100, rawRetention > 0 ? rawRetention : 65)) / 100
  const shadowType = settings.shadowType || 'auto'
  const solidCutoff = Math.max(0.3, Math.min(0.9, (settings.shadowSolidThreshold ?? 62) / 100))
  const unmixColor = settings.shadowUnmixColor !== false

  const noiseFloor = Math.max(0.035, 0.14 - strength * 0.095)
  const opacityGain = 0.75 + strength * 1.65

  const isGreenKey =
    settings.keyColorType === 'chroma_green' ||
    (keyRgb.g > keyRgb.r + 25 && keyRgb.g > keyRgb.b + 15)
  const isBlueKey =
    settings.keyColorType === 'chroma_blue' ||
    (keyRgb.b > keyRgb.r + 25 && keyRgb.b > keyRgb.g + 15)

  const invPosR = 1 / Math.max(85, 255 - keyRgb.r)
  const invPosG = 1 / Math.max(85, 255 - keyRgb.g)
  const invPosB = 1 / Math.max(85, 255 - keyRgb.b)
  const invNeg = 1 / Math.max(85, keyRgb.r, keyRgb.g, keyRgb.b)

  const solidMask = new Uint8Array(totalPixels)
  const dirAlphaArr = new Float32Array(totalPixels)
  const rawAlphaArr = new Float32Array(totalPixels)

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    const a = data[idx + 3]
    if (a < 15) continue

    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]

    const posR = Math.max(0, r - keyRgb.r) * invPosR
    const posG = Math.max(0, g - keyRgb.g) * invPosG
    const posB = Math.max(0, b - keyRgb.b) * invPosB
    const alphaLight = Math.max(posR, posG, posB)

    const negR = Math.max(0, keyRgb.r - r) * invNeg
    const negG = Math.max(0, keyRgb.g - g) * invNeg
    const negB = Math.max(0, keyRgb.b - b) * invNeg
    const alphaDark = Math.max(negR, negG, negB)

    const alphaAll = Math.max(alphaLight, alphaDark)
    rawAlphaArr[p] = alphaAll

    let alphaDir = alphaAll
    if (shadowType === 'light') {
      alphaDir = alphaLight >= alphaDark * 0.85 ? alphaLight : 0
    } else if (shadowType === 'dark') {
      alphaDir = alphaDark > alphaLight ? alphaDark : 0
    }
    dirAlphaArr[p] = alphaDir

    // Xác định pixel thuộc vật thể đặc (Solid Foreground)
    if (!activeBg[p]) {
      solidMask[p] = 1
    } else if (isGreenKey) {
      const dom = g - (r > b ? r : b)
      if (dom <= 15 || alphaAll >= solidCutoff) {
        solidMask[p] = 1
      }
    } else if (isBlueKey) {
      const dom = b - (r > g ? r : g)
      if (dom <= 15 || alphaAll >= solidCutoff) {
        solidMask[p] = 1
      }
    } else if (alphaAll >= solidCutoff) {
      solidMask[p] = 1
    }
  }

  const nearSolid = dilateMaskBox(solidMask, w, h, mode === 'only' ? 4 : 2)
  const isShadowPixel = new Uint8Array(totalPixels)

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    const origA = data[idx + 3]
    if (origA < 15) {
      data[idx + 3] = 0
      shadowAlpha[p] = 0
      continue
    }

    if (mode === 'only') {
      if (nearSolid[p] || dirAlphaArr[p] <= noiseFloor) {
        data[idx + 3] = 0
        activeBg[p] = 1
        shadowAlpha[p] = 0
        continue
      }
    } else {
      // mode === 'include'
      if (solidMask[p]) {
        activeBg[p] = 0
        shadowAlpha[p] = origA
        continue
      }
      if (dirAlphaArr[p] <= noiseFloor) {
        if (activeBg[p]) {
          data[idx + 3] = shadowAlpha[p]
        }
        continue
      }
    }

    // Pixel bóng mờ / mây khói bán trong suốt: tính Alpha & Unmix màu nền
    const alphaDir = dirAlphaArr[p]
    const aNorm = Math.max(0, (alphaDir - noiseFloor) / (1 - noiseFloor))
    const computedShadowA = Math.max(
      0,
      Math.min(255, Math.round((origA / 255) * 255 * Math.min(1, aNorm * opacityGain)))
    )
    const finalA = mode === 'only' ? computedShadowA : Math.max(shadowAlpha[p], computedShadowA)

    if (unmixColor && finalA > 0) {
      const aUnmix = Math.max(0.08, Math.min(1, rawAlphaArr[p]))
      const invA = 1 / aUnmix
      const bgWeight = 1 - aUnmix
      let rf = Math.max(0, Math.min(255, (data[idx] - bgWeight * keyRgb.r) * invA))
      let gf = Math.max(0, Math.min(255, (data[idx + 1] - bgWeight * keyRgb.g) * invA))
      let bf = Math.max(0, Math.min(255, (data[idx + 2] - bgWeight * keyRgb.b) * invA))

      // Khử triệt để ám xanh lá / xanh dương còn sót mà không gây đảo màu hồng/vàng
      if (isGreenKey) {
        const rbAvg = (rf + bf) * 0.5
        const rbMin = rf < bf ? rf : bf
        gf = Math.max(rbMin, Math.min(gf, rbAvg * 1.04 + 4))
      } else if (isBlueKey) {
        const rgAvg = (rf + gf) * 0.5
        const rgMin = rf < gf ? rf : gf
        bf = Math.max(rgMin, Math.min(bf, rgAvg * 1.04 + 4))
      }

      data[idx] = Math.round(rf)
      data[idx + 1] = Math.round(gf)
      data[idx + 2] = Math.round(bf)
    }

    data[idx + 3] = finalA
    shadowAlpha[p] = finalA
    if (mode === 'only' || !nearSolid[p]) {
      isShadowPixel[p] = 1
    }
  }

  return isShadowPixel
}
