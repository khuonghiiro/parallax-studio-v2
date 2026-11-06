import type { ChromaKeySettings, ChromaShadowMode } from './types'
import { resolveOuterWallAlpha } from './chromaOuterIsolation'

/**
 * Lấy mẫu tự động màu nền thực tế quanh viền ảnh để tinh chỉnh chính xác màu khóa (Key Color).
 * Giúp xử lý các ảnh phông xanh/lam/hồng/trắng/đen có sắc độ lệch với mã preset mặc định
 * để thuật toán Unmix bóng mờ / quầng sáng đạt độ chính xác tuyệt đối.
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

  const trySample = (x: number, y: number): void => {
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
      if (dr * dr + dg * dg + db * db <= 48 * 48) {
        rs.push(r)
        gs.push(g)
        bs.push(b)
      }
    }
  }

  const insets = [
    Math.min(Math.floor((w - 1) / 2), Math.max(2, Math.min(14, Math.floor(w * 0.012)))),
    Math.min(Math.floor((w - 1) / 2), Math.max(6, Math.min(44, Math.floor(w * 0.04))))
  ]
  for (const inset of insets) {
    const iy = Math.min(Math.floor((h - 1) / 2), inset)
    for (let x = inset; x < w - inset; x += stepX) {
      trySample(x, iy)
      trySample(x, h - 1 - iy)
    }
    for (let y = iy + stepY; y < h - iy - stepY; y += stepY) {
      trySample(inset, y)
      trySample(w - 1 - inset, y)
    }
    if (rs.length >= 16) break
  }

  if (rs.length < 6) return fallbackKey

  const trimmedMean = (arr: number[]): number => {
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
 * Đo ngưỡng nhiễu nền thực tế (JPEG 8×8 compression noise) quanh biên ảnh để loại bỏ sạch
 * nhiễu nền mà vẫn giữ trọn quầng sáng / bóng mờ bán trong suốt.
 */
function measureBorderNoiseFloor(
  rawAlphaArr: Float32Array,
  data: Uint8ClampedArray,
  w: number,
  h: number
): number {
  if (w < 8 || h < 8) return 0
  const samples: number[] = []
  const stepX = Math.max(1, Math.floor(w / 64))
  const stepY = Math.max(1, Math.floor(h / 64))

  const pushIfBg = (x: number, y: number): void => {
    const p = y * w + x
    if (data[p * 4 + 3] < 200) return
    const a = rawAlphaArr[p]
    if (a < 0.16) samples.push(a)
  }

  const insets = [
    Math.min(Math.floor((w - 1) / 2), Math.max(1, Math.min(12, Math.floor(w * 0.012)))),
    Math.min(Math.floor((w - 1) / 2), Math.max(6, Math.min(44, Math.floor(w * 0.04))))
  ]
  for (const inset of insets) {
    const iy = Math.min(Math.floor((h - 1) / 2), inset)
    for (let x = inset; x < w - inset; x += stepX) {
      pushIfBg(x, iy)
      pushIfBg(x, h - 1 - iy)
    }
    for (let y = iy + stepY; y < h - iy - stepY; y += stepY) {
      pushIfBg(inset, y)
      pushIfBg(w - 1 - inset, y)
    }
    if (samples.length >= 24) break
  }

  if (samples.length < 8) return 0
  samples.sort((a, b) => a - b)
  const p98 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.985))]
  return Math.max(0, Math.min(0.11, p98))
}

/** Kết quả giải pha màu (Color Unmixing) từng pixel so với màu nền: độ phủ thật của vật thể / bóng */
export interface ChromaAlphaAnalysis {
  /** Độ phủ tổng (0 = đúng màu nền, 1 = vật thể đặc) */
  rawAlpha: Float32Array
  /** Độ phủ theo loại bóng đã chọn (sáng / tối / tự động) */
  dirAlpha: Float32Array
  /** 1 nếu pixel sáng hơn nền (hào quang / mây), 0 nếu tối hơn (bóng đổ) */
  isLight: Uint8Array
  /** Nhiễu nền đo được quanh mép ảnh (JPEG) */
  measuredNoise: number
  isGreenKey: boolean
  isBlueKey: boolean
  isMagentaKey: boolean
}

/** Phân tích độ phủ thật của mọi pixel — dùng chung cho tách bóng, xoá quầng và phân vùng nền ngoài / trong */
export function analyzeChromaAlpha(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  keyRgb: { r: number; g: number; b: number }
): ChromaAlphaAnalysis {
  const totalPixels = w * h
  const shadowType = settings.shadowType || 'auto'
  const invPosR = keyRgb.r < 235 ? 1 / Math.max(64, 255 - keyRgb.r) : 1 / 255
  const invPosG = keyRgb.g < 235 ? 1 / Math.max(64, 255 - keyRgb.g) : 1 / 255
  const invPosB = keyRgb.b < 235 ? 1 / Math.max(64, 255 - keyRgb.b) : 1 / 255
  const invNegR = keyRgb.r > 20 ? 1 / Math.max(64, keyRgb.r) : 1 / 255
  const invNegG = keyRgb.g > 20 ? 1 / Math.max(64, keyRgb.g) : 1 / 255
  const invNegB = keyRgb.b > 20 ? 1 / Math.max(64, keyRgb.b) : 1 / 255

  const kMean = (keyRgb.r + keyRgb.g + keyRgb.b) / 3
  const kcr = keyRgb.r - kMean
  const kcg = keyRgb.g - kMean
  const kcb = keyRgb.b - kMean
  const kcLenSq = kcr * kcr + kcg * kcg + kcb * kcb
  const isChromaticKey = kcLenSq > 600

  const dirAlpha = new Float32Array(totalPixels)
  const rawAlpha = new Float32Array(totalPixels)
  const isLight = new Uint8Array(totalPixels)

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    if (data[idx + 3] < 15) continue
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const alphaLight = Math.max(
      Math.max(0, r - keyRgb.r) * invPosR,
      Math.max(0, g - keyRgb.g) * invPosG,
      Math.max(0, b - keyRgb.b) * invPosB
    )
    const alphaDark = Math.max(
      Math.max(0, keyRgb.r - r) * invNegR,
      Math.max(0, keyRgb.g - g) * invNegG,
      Math.max(0, keyRgb.b - b) * invNegB
    )
    const maxAD = Math.max(alphaLight, alphaDark)
    const minAD = Math.min(alphaLight, alphaDark)
    let alphaAll = Math.min(1, maxAD + minAD * 0.5)

    if (isChromaticKey) {
      const cMean = (r + g + b) / 3
      const pChroma = Math.max(
        0,
        Math.min(1, ((r - cMean) * kcr + (g - cMean) * kcg + (b - cMean) * kcb) / kcLenSq)
      )
      const alphaChroma = 1 - pChroma
      if (alphaChroma > alphaAll) {
        alphaAll = alphaChroma
      }
      // Nếu một kênh sáng hơn nền rõ rệt trong khi kênh khác tối hơn nền rõ rệt (đối chiều màu, ví dụ tóc nâu / da trên nền hồng),
      // pixel không phải bóng tối hay mây trắng mà là màu vật thể đặc.
      if (alphaLight > 0.12 && alphaDark > 0.18 && pChroma < 0.25) {
        alphaAll = Math.max(alphaAll, Math.min(1, 1 - pChroma * 0.35))
      }
    }

    rawAlpha[p] = alphaAll
    isLight[p] = alphaLight >= alphaDark ? 1 : 0
    dirAlpha[p] =
      shadowType === 'light'
        ? alphaLight >= alphaDark * 0.5 ? alphaLight : 0
        : shadowType === 'dark'
          ? alphaDark > alphaLight ? alphaDark : 0
          : alphaAll
  }

  return {
    rawAlpha,
    dirAlpha,
    isLight,
    measuredNoise: measureBorderNoiseFloor(rawAlpha, data, w, h),
    isGreenKey:
      settings.keyColorType === 'chroma_green' || (keyRgb.g > keyRgb.r + 25 && keyRgb.g > keyRgb.b + 15),
    isBlueKey:
      settings.keyColorType === 'chroma_blue' || (keyRgb.b > keyRgb.r + 25 && keyRgb.b > keyRgb.g + 15),
    isMagentaKey: keyRgb.r > keyRgb.g + 35 && keyRgb.b > keyRgb.g + 35
  }
}

/**
 * Khử màu nền pha trộn (Color Unmixing) cho một pixel bán trong suốt hoặc viền chuyển tiếp.
 */
export function unmixPixelRgb(
  data: Uint8ClampedArray,
  idx: number,
  keyRgb: { r: number; g: number; b: number },
  aAll: number,
  isLightGlow: boolean,
  isGreenKey: boolean,
  isBlueKey: boolean,
  isMagentaKey: boolean
): void {
  const r = data[idx]
  const g = data[idx + 1]
  const b = data[idx + 2]
  const aUnmix = Math.max(0.07, Math.min(1, aAll))
  const invA = 1 / aUnmix

  let rf = Math.max(0, Math.min(255, keyRgb.r + (r - keyRgb.r) * invA))
  let gf = Math.max(0, Math.min(255, keyRgb.g + (g - keyRgb.g) * invA))
  let bf = Math.max(0, Math.min(255, keyRgb.b + (b - keyRgb.b) * invA))

  if (isGreenKey) {
    const rbMax = rf > bf ? rf : bf
    gf = Math.min(gf, rbMax * 1.02 + 2)
  } else if (isBlueKey) {
    const rgMax = rf > gf ? rf : gf
    bf = Math.min(bf, rgMax * 1.02 + 2)
  } else if (isMagentaKey) {
    if (isLightGlow && r > 180 && b > 180 && g > 40) {
      // Trên phông hồng magenta (#FF00FF), khôi phục chính xác tia sáng / hào quang trắng pha hồng
      const aRb = Math.max(aUnmix, 0.28)
      const rbDiff = r - b - (keyRgb.r - keyRgb.b) * (1 - aUnmix)
      rf = rbDiff >= 0 ? 255 : Math.max(0, Math.min(255, 255 + rbDiff / aRb))
      bf = rbDiff <= 0 ? 255 : Math.max(0, Math.min(255, 255 - rbDiff / aRb))
      gf = Math.min(gf, Math.max(rf, bf))
    } else if (rf > gf + 4 && bf > gf + 4) {
      // Khử phần dư sắc tím/hồng trên mép tối mà không làm biến đổi màu nâu/da ấm (nơi bf <= gf)
      const magExcess = Math.min(rf, bf) - gf
      rf = Math.max(gf, rf - magExcess * 0.65)
      bf = Math.max(gf, bf - magExcess * 0.85)
    }
  }

  data[idx] = Math.round(rf)
  data[idx + 1] = Math.round(gf)
  data[idx + 2] = Math.round(bf)
}

/** Ngưỡng độ phủ phân tách vật thể đặc khỏi bóng mờ / quầng sáng (30..92%, mặc định 62%) */
export function resolveSolidCutoff(settings: ChromaKeySettings): number {
  return Math.max(0.3, Math.min(0.92, (settings.shadowSolidThreshold ?? 62) / 100))
}

/**
 * Tách và khử ám màu nền cho Bóng mờ / Mây khói / Hào quang bán trong suốt (Color Unmixing & Alpha Matting).
 * Chỉ xử lý trong `zone` (vùng nền cần tách); pixel ngoài vùng — phần ruột bên trong đường viền khi chọn
 * "Chỉ nền ngoài" — được giữ nguyên. Chế độ "Chỉ lấy bóng" thì phần ruột cũng bị loại như vật thể đặc.
 */
export function applyShadowAndMistExtraction(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  keyRgb: { r: number; g: number; b: number },
  activeBg: Uint8Array,
  shadowAlpha: Uint8Array,
  analysis: ChromaAlphaAnalysis,
  zone: Uint8Array
): Uint8Array | null {
  const mode = resolveEffectiveShadowMode(settings)
  if (mode === 'off') return null

  const totalPixels = w * h
  const rawRetention = settings.shadowRetention ?? 0
  const strength = Math.max(5, Math.min(100, rawRetention > 0 ? rawRetention : 68)) / 100
  const solidCutoff = resolveSolidCutoff(settings)
  const unmixColor = settings.shadowUnmixColor !== false
  const { rawAlpha, dirAlpha, isLight, isGreenKey, isBlueKey, isMagentaKey } = analysis
  const noiseFloor = Math.max(analysis.measuredNoise + 0.01, Math.max(0.025, 0.13 - strength * 0.085))

  const solidMask = new Uint8Array(totalPixels)
  const nonSolidMask = new Uint8Array(totalPixels)
  for (let p = 0; p < totalPixels; p++) {
    if (mode === 'only' && (!zone[p] || rawAlpha[p] >= solidCutoff)) {
      solidMask[p] = 1
    }
    if (data[p * 4 + 3] < 15 || (zone[p] && rawAlpha[p] < solidCutoff)) {
      nonSolidMask[p] = 1
    }
  }
  const nearSolid = mode === 'only' ? dilateMaskBox(solidMask, w, h, 2) : solidMask
  const nearBoundary = mode === 'include' && unmixColor ? dilateMaskBox(nonSolidMask, w, h, 3) : null
  const isShadowPixel = new Uint8Array(totalPixels)
  const span = Math.max(0.08, solidCutoff - noiseFloor)
  const gamma = 1.35 - strength * 0.65
  const maxShadowScale = 0.55 + strength * 0.45

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    const origA = data[idx + 3]
    if (origA < 15) {
      data[idx + 3] = 0
      shadowAlpha[p] = 0
      continue
    }

    if (mode === 'only') {
      if (nearSolid[p] || dirAlpha[p] <= noiseFloor) {
        data[idx + 3] = 0
        activeBg[p] = 1
        shadowAlpha[p] = 0
        continue
      }
    } else if (!zone[p]) {
      activeBg[p] = 0
      shadowAlpha[p] = origA
      continue
    } else if (rawAlpha[p] < solidCutoff && dirAlpha[p] <= noiseFloor) {
      data[idx + 3] = 0
      activeBg[p] = 1
      shadowAlpha[p] = 0
      continue
    }

    const aAll = rawAlpha[p]
    let finalA: number
    const isSolidForeground = mode === 'include' && aAll >= solidCutoff
    if (isSolidForeground) {
      finalA = origA
      activeBg[p] = 0
    } else {
      const aNorm = Math.max(0, Math.min(1, (dirAlpha[p] - noiseFloor) / span))
      const curved = Math.pow(aNorm, gamma) * maxShadowScale
      finalA = Math.max(0, Math.min(255, Math.round(origA * Math.min(1, curved))))
    }

    // Chỉ unmix các pixel bán trong suốt (bóng/mây/quầng) hoặc pixel nằm sát biên 3px với nền;
    // giữ nguyên 100% màu gốc của phần ruột vật thể đặc bên trong (tóc nâu, da, ngọc, trang phục).
    const shouldUnmix =
      unmixColor &&
      finalA > 0 &&
      (isSolidForeground ? Boolean(nearBoundary && nearBoundary[p]) && aAll < 0.96 : aAll < 0.98)

    if (shouldUnmix) {
      unmixPixelRgb(data, idx, keyRgb, aAll, isLight[p] === 1, isGreenKey, isBlueKey, isMagentaKey)
    }

    data[idx + 3] = finalA
    shadowAlpha[p] = finalA
    if (finalA > 0 && (mode === 'only' || aAll < 0.96)) {
      isShadowPixel[p] = 1
    }
  }

  return isShadowPixel
}

/**
 * "Xoá bóng" sạch cho hiệu ứng ánh sáng (Loop Animate): trong vùng tách, loại bỏ quầng sáng / bóng mờ
 * bán trong suốt có độ phủ dưới ngưỡng (Độ nhạy) và khử ám màu nền trên mép vật thể còn lại,
 * thay vì để quầng sáng biến thành mảng xanh đục.
 */
export function removeSoftHaloPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  keyRgb: { r: number; g: number; b: number },
  analysis: ChromaAlphaAnalysis,
  zone: Uint8Array
): void {
  const { rawAlpha, isLight, isGreenKey, isBlueKey, isMagentaKey } = analysis
  const solid = resolveSolidCutoff(settings)
  const outerOnly = settings.isolationMode === 'outer_only'
  const tol = Math.max(0, Math.min(100, settings.tolerance)) / 100
  // "Chỉ nền ngoài": mép đường viền chuyển mềm từ nửa ngưỡng viền → ngưỡng viền và giữ nguyên màu phần bên trong;
  // "Tách toàn bộ": loại quầng dưới ngưỡng Độ nhạy
  const wall = outerOnly ? resolveOuterWallAlpha(settings, analysis) : 0
  const cut = outerOnly ? wall * 0.5 : Math.max(0.3, Math.min(0.85, 0.25 + tol * 0.9))
  const feather = outerOnly ? wall * 0.5 : 0.06 + (Math.max(0, Math.min(30, settings.smoothness ?? 0)) / 30) * 0.2
  for (let p = 0; p < w * h; p++) {
    if (!zone[p]) continue
    const idx = p * 4
    const a = data[idx + 3]
    if (a === 0) continue
    const ra = rawAlpha[p]
    if (ra < cut) {
      data[idx + 3] = 0
      continue
    }
    if (ra < cut + feather) {
      const t = (ra - cut) / feather
      data[idx + 3] = Math.round(a * t * t * (3 - 2 * t))
    }
    const keepInnerColor = outerOnly && ra < solid
    if (ra < 0.98 && !keepInnerColor) unmixPixelRgb(data, idx, keyRgb, ra, isLight[p] === 1, isGreenKey, isBlueKey, isMagentaKey)
  }
}

/**
 * Làm mềm biên (Feather) mượt mà không răng cưa bằng biến đổi khoảng cách Chamfer 3-4 (O(N))
 * kết hợp lọc mịn đường đồng mức Gaussian 3×3 trên dải biên.
 */
export function applySmoothEdgeFeather(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  feather: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  if (feather <= 0 || w < 3 || h < 3) return
  const total = w * h
  for (let p = 0; p < total; p++) {
    alphaSnap[p] = data[p * 4 + 3]
  }

  const featherRadius = feather <= 2 ? 0.95 : 0.95 + (feather - 2) * 0.19
  const maxDist3 = Math.ceil((featherRadius + 2) * 3)
  const dist3 = new Uint16Array(total)
  dist3.fill(maxDist3)

  for (let p = 0; p < total; p++) {
    if (alphaSnap[p] < 16) dist3[p] = 0
  }

  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const p = row + x
      let d = dist3[p]
      if (d === 0) continue
      if (x > 0 && dist3[p - 1] + 3 < d) d = dist3[p - 1] + 3
      if (y > 0) {
        const up = p - w
        if (dist3[up] + 3 < d) d = dist3[up] + 3
        if (x > 0 && dist3[up - 1] + 4 < d) d = dist3[up - 1] + 4
        if (x < w - 1 && dist3[up + 1] + 4 < d) d = dist3[up + 1] + 4
      }
      dist3[p] = d
    }
  }

  for (let y = h - 1; y >= 0; y--) {
    const row = y * w
    for (let x = w - 1; x >= 0; x--) {
      const p = row + x
      let d = dist3[p]
      if (d === 0) continue
      if (x < w - 1 && dist3[p + 1] + 3 < d) d = dist3[p + 1] + 3
      if (y < h - 1) {
        const dn = p + w
        if (dist3[dn] + 3 < d) d = dist3[dn] + 3
        if (x < w - 1 && dist3[dn + 1] + 4 < d) d = dist3[dn + 1] + 4
        if (x > 0 && dist3[dn - 1] + 4 < d) d = dist3[dn - 1] + 4
      }
      dist3[p] = d
    }
  }

  const invRadius = 1 / featherRadius
  for (let p = 0; p < total; p++) {
    const origA = alphaSnap[p]
    if (origA === 0 || (excludeShadowMask && excludeShadowMask[p])) continue
    const d = dist3[p] / 3
    if (d <= featherRadius) {
      const t = Math.max(0, Math.min(1, d * invRadius))
      const smooth = t * t * (3 - 2 * t)
      data[p * 4 + 3] = Math.min(origA, Math.round(origA * smooth))
    }
  }

  const smoothPasses = feather >= 8 ? 2 : feather >= 2 ? 1 : 0
  const maxBand3 = feather <= 2 ? 3 : Math.ceil((featherRadius + 1.2) * 3)
  for (let pass = 0; pass < smoothPasses; pass++) {
    for (let p = 0; p < total; p++) alphaSnap[p] = data[p * 4 + 3]
    for (let y = 1; y < h - 1; y++) {
      const row = y * w
      for (let x = 1; x < w - 1; x++) {
        const p = row + x
        const d3 = dist3[p]
        if (d3 === 0 || d3 > maxBand3 || (excludeShadowMask && excludeShadowMask[p])) continue
        const up = p - w
        const dn = p + w
        data[p * 4 + 3] =
          (alphaSnap[p] * 4 +
            (alphaSnap[p - 1] + alphaSnap[p + 1] + alphaSnap[up] + alphaSnap[dn]) * 2 +
            alphaSnap[up - 1] +
            alphaSnap[up + 1] +
            alphaSnap[dn - 1] +
            alphaSnap[dn + 1] +
            8) >>
          4
      }
    }
  }
}
