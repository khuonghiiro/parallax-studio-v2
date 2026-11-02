import type { ChromaKeySettings, ChromaShadowMode } from './types'

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

/**
 * Xác định vùng nền và quầng bán trong suốt liên thông với bên ngoài (dùng cho chế độ Giữ ruột BFS).
 * Chỉ những vùng nằm hoàn toàn bên trong đường viền đặc kín (rawAlpha >= 0.94) mới được khoá bảo vệ.
 */
function computeOuterHaloZone(
  rawAlphaArr: Float32Array,
  w: number,
  h: number,
  isolationMode: string | undefined,
  isChromaScreen: boolean,
  noiseFloor: number
): Uint8Array {
  const total = w * h
  const zone = new Uint8Array(total)
  if (isolationMode !== 'outer_only') {
    zone.fill(1)
    return zone
  }

  const solidBarrier = 0.94
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const seed = (p: number): void => {
    if (!zone[p] && rawAlphaArr[p] < solidBarrier) {
      zone[p] = 1
      queue[tail++] = p
    }
  }

  for (let x = 0; x < w; x++) {
    seed(x)
    seed((h - 1) * w + x)
  }
  for (let y = 1; y < h - 1; y++) {
    seed(y * w)
    seed(y * w + (w - 1))
  }

  // Trên phông xanh lá / xanh dương / hồng magenta, các ô nền thuần khiết nằm giữa các tia sáng cũng là hạt giống nền
  if (isChromaScreen) {
    const chromaSeedCeil = Math.max(0.08, noiseFloor * 1.4)
    for (let p = 0; p < total; p++) {
      if (!zone[p] && rawAlphaArr[p] <= chromaSeedCeil) {
        zone[p] = 1
        queue[tail++] = p
      }
    }
  }

  while (head < tail) {
    const curr = queue[head++]
    const cx = curr % w
    const cy = (curr - cx) / w
    if (cx > 0) seed(curr - 1)
    if (cx < w - 1) seed(curr + 1)
    if (cy > 0) seed(curr - w)
    if (cy < h - 1) seed(curr + w)
  }

  return zone
}

/**
 * Khử màu nền pha trộn (Color Unmixing) cho một pixel bán trong suốt hoặc viền chuyển tiếp.
 */
function unmixPixelRgb(
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
  } else if (isMagentaKey && isLightGlow) {
    // Trên phông hồng magenta (#FF00FF), khôi phục chính xác tia vàng, tia xanh cyan và hào quang trắng
    const aRb = Math.max(aUnmix, 0.28)
    const rbDiff = r - b - (keyRgb.r - keyRgb.b) * (1 - aUnmix)
    rf = rbDiff >= 0 ? 255 : Math.max(0, Math.min(255, 255 + rbDiff / aRb))
    bf = rbDiff <= 0 ? 255 : Math.max(0, Math.min(255, 255 - rbDiff / aRb))
    gf = Math.min(gf, Math.max(rf, bf))
  }

  data[idx] = Math.round(rf)
  data[idx + 1] = Math.round(gf)
  data[idx + 2] = Math.round(bf)
}

/**
 * Tách và khử ám màu nền cho Bóng mờ / Mây khói / Hào quang bán trong suốt (Color Unmixing & Alpha Matting).
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
  const strength = Math.max(5, Math.min(100, rawRetention > 0 ? rawRetention : 68)) / 100
  const shadowType = settings.shadowType || 'auto'
  const solidCutoff = Math.max(0.3, Math.min(0.92, (settings.shadowSolidThreshold ?? 62) / 100))
  const unmixColor = settings.shadowUnmixColor !== false

  const isGreenKey =
    settings.keyColorType === 'chroma_green' ||
    (keyRgb.g > keyRgb.r + 25 && keyRgb.g > keyRgb.b + 15)
  const isBlueKey =
    settings.keyColorType === 'chroma_blue' ||
    (keyRgb.b > keyRgb.r + 25 && keyRgb.b > keyRgb.g + 15)
  const isMagentaKey = keyRgb.r > keyRgb.g + 35 && keyRgb.b > keyRgb.g + 35

  const invPosR = keyRgb.r < 235 ? 1 / Math.max(64, 255 - keyRgb.r) : 1 / 255
  const invPosG = keyRgb.g < 235 ? 1 / Math.max(64, 255 - keyRgb.g) : 1 / 255
  const invPosB = keyRgb.b < 235 ? 1 / Math.max(64, 255 - keyRgb.b) : 1 / 255
  const invNegR = keyRgb.r > 20 ? 1 / Math.max(64, keyRgb.r) : 1 / 255
  const invNegG = keyRgb.g > 20 ? 1 / Math.max(64, keyRgb.g) : 1 / 255
  const invNegB = keyRgb.b > 20 ? 1 / Math.max(64, keyRgb.b) : 1 / 255

  const dirAlphaArr = new Float32Array(totalPixels)
  const rawAlphaArr = new Float32Array(totalPixels)
  const isLightArr = new Uint8Array(totalPixels)

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
    const alphaAll = Math.min(1, maxAD + minAD * 0.5)
    rawAlphaArr[p] = alphaAll
    isLightArr[p] = alphaLight >= alphaDark ? 1 : 0

    let alphaDir = alphaAll
    if (shadowType === 'light') {
      alphaDir = alphaLight >= alphaDark * 0.5 ? alphaLight : 0
    } else if (shadowType === 'dark') {
      alphaDir = alphaDark > alphaLight ? alphaDark : 0
    }
    dirAlphaArr[p] = alphaDir
  }

  const measuredNoise = measureBorderNoiseFloor(rawAlphaArr, data, w, h)
  const noiseFloor = Math.max(measuredNoise + 0.01, Math.max(0.025, 0.13 - strength * 0.085))
  const outerZone = computeOuterHaloZone(
    rawAlphaArr,
    w,
    h,
    settings.isolationMode,
    isGreenKey || isBlueKey || isMagentaKey,
    noiseFloor
  )

  const solidMask = new Uint8Array(totalPixels)
  if (mode === 'only') {
    for (let p = 0; p < totalPixels; p++) {
      if (!outerZone[p] || rawAlphaArr[p] >= solidCutoff) solidMask[p] = 1
    }
  }
  const nearSolid = mode === 'only' ? dilateMaskBox(solidMask, w, h, 2) : solidMask
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
      if (nearSolid[p] || dirAlphaArr[p] <= noiseFloor) {
        data[idx + 3] = 0
        activeBg[p] = 1
        shadowAlpha[p] = 0
        continue
      }
    } else if (!outerZone[p]) {
      activeBg[p] = 0
      shadowAlpha[p] = origA
      continue
    } else if (rawAlphaArr[p] < solidCutoff && dirAlphaArr[p] <= noiseFloor) {
      data[idx + 3] = 0
      activeBg[p] = 1
      shadowAlpha[p] = 0
      continue
    }

    const aAll = rawAlphaArr[p]
    let finalA: number
    if (mode === 'include' && aAll >= solidCutoff) {
      finalA = origA
      activeBg[p] = 0
    } else {
      const aNorm = Math.max(0, Math.min(1, (dirAlphaArr[p] - noiseFloor) / span))
      const curved = Math.pow(aNorm, gamma) * maxShadowScale
      finalA = Math.max(0, Math.min(255, Math.round(origA * Math.min(1, curved))))
    }

    if (unmixColor && finalA > 0 && aAll < 0.98) {
      unmixPixelRgb(
        data,
        idx,
        keyRgb,
        aAll,
        isLightArr[p] === 1,
        isGreenKey,
        isBlueKey,
        isMagentaKey
      )
    }

    data[idx + 3] = finalA
    shadowAlpha[p] = finalA
    if (finalA > 0 && (mode === 'only' || aAll < 0.96)) {
      isShadowPixel[p] = 1
    }
  }

  return isShadowPixel
}
