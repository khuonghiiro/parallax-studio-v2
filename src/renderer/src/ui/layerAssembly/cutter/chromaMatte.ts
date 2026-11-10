import type { ChromaKeySettings } from './types'

export interface RgbColor {
  r: number
  g: number
  b: number
}

export function parseHexRgb(hex: string): RgbColor {
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

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}

export function resolveEffectiveKeyRgb(settings: ChromaKeySettings): RgbColor {
  const keyType = settings.keyColorType || 'custom'
  const parsed = parseHexRgb(settings.keyColorHex || settings.keyColor || '#00DB4E')
  if (keyType === 'chroma_green') {
    if (parsed.g > parsed.r + 25 && parsed.g > parsed.b + 15) {
      return parsed
    }
    return { r: 0, g: 219, b: 78 }
  }
  if (keyType === 'chroma_blue') {
    if (parsed.b > parsed.r + 25 && parsed.b > parsed.g + 15) return parsed
    return { r: 0, g: 92, b: 230 }
  }
  if (keyType === 'pure_white') {
    if (parsed.r > 240 && parsed.g > 240 && parsed.b > 240) return parsed
    return { r: 255, g: 255, b: 255 }
  }
  if (keyType === 'pure_black') {
    if (parsed.r < 35 && parsed.g < 35 && parsed.b < 35) return parsed
    return { r: 0, g: 0, b: 0 }
  }
  return parsed
}

/**
 * Hằng số của matte tách nền đã tính sẵn một lần cho cả ảnh (thay vì tính lại ở từng pixel).
 * Dùng chung cho đường CPU (`evalChromaMatte`) và uniform của kernel GPU (`chromaGpuKernel`).
 */
export interface ChromaMatteParams {
  /** 0 = khoảng cách RGB thường, 1 = phông xanh lá, 2 = phông xanh dương */
  mode: 0 | 1 | 2
  kr: number
  kg: number
  kb: number
  /** Độ trội kênh khoá của chính màu nền (chỉ dùng cho mode 1 / 2) */
  keyDominance: number
  kMean: number
  kcr: number
  kcg: number
  kcb: number
  kcLenSq: number
  /** Màu nền bão hoà cao (kcLenSq > 600) → dùng chiếu vector sắc độ */
  chromatic: boolean
  tolFactor: number
  /** 0..1 */
  detailProtection: number
  hardThreshold: number
  transitionWidth: number
  hardEnd: number
}

export function buildChromaMatteParams(settings: ChromaKeySettings, key: RgbColor): ChromaMatteParams {
  const keyType = settings.keyColorType || 'custom'
  const tolerance = Math.max(0, Math.min(100, settings.tolerance))
  const feather = Math.max(0, Math.min(30, settings.smoothness ?? 0))
  const mode = keyType === 'chroma_green' ? 1 : keyType === 'chroma_blue' ? 2 : 0
  const keyChannel = mode === 1 ? key.g : key.b
  const keyOtherB = mode === 1 ? key.b : key.g
  const kMean = (key.r + key.g + key.b) / 3
  const kcr = key.r - kMean
  const kcg = key.g - kMean
  const kcb = key.b - kMean
  const kcLenSq = kcr * kcr + kcg * kcg + kcb * kcb
  const cb = Math.max(0, Math.min(100, settings.contourBarrier ?? 70)) / 100
  const barrierScale = kcLenSq <= 600 ? Math.max(0.65, Math.min(1.25, 1 - (cb - 0.5) * 0.4)) : 1
  const highTolBoost = tolerance > 45 ? (tolerance - 45) * 1.25 : 0
  const hardThreshold = (5 + tolerance * 1.12 + highTolBoost) * barrierScale
  const effectiveFeather = Math.min(10, feather)
  const transitionWidth = 8 + effectiveFeather * 1.6 + tolerance * 0.18
  return {
    mode,
    kr: key.r,
    kg: key.g,
    kb: key.b,
    keyDominance: keyChannel - Math.max(key.r, keyOtherB),
    kMean,
    kcr,
    kcg,
    kcb,
    kcLenSq,
    chromatic: kcLenSq > 600,
    tolFactor: tolerance > 45 ? 1.0 + (tolerance - 45) * 0.016 : 1.0,
    detailProtection: Math.max(0, Math.min(100, settings.detailProtection ?? 75)) / 100,
    hardThreshold,
    transitionWidth,
    hardEnd: hardThreshold + transitionWidth
  }
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

/** Khoảng cách màu tới nền theo kiểu phông (xanh lá / xanh dương / RGB thường). */
function keyDistance(P: ChromaMatteParams, r: number, g: number, b: number): number {
  if (P.mode === 0) {
    const dr = r - P.kr
    const dg = g - P.kg
    const db = b - P.kb
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }
  const green = P.mode === 1
  const keyed = green ? g : b
  const otherB = green ? b : g
  const channelDelta = keyed - (green ? P.kg : P.kb)
  const otherDeltaA = r - P.kr
  const otherDeltaB = otherB - (green ? P.kb : P.kg)
  const rawDistance = Math.sqrt(
    channelDelta * channelDelta * 0.48 + otherDeltaA * otherDeltaA * 0.28 + otherDeltaB * otherDeltaB * 0.24
  )
  const dominance = keyed - Math.max(r, otherB)
  const dominanceMatch = Math.max(0, Math.min(dominance, P.keyDominance) - 8)
  return Math.max(0, rawDistance - dominanceMatch * 0.22)
}

/** Bảo vệ chi tiết có sắc độ trên phông trung tính (xám / trắng / kem / đen). */
function neutralDetailBoost(P: ChromaMatteParams, r: number, g: number, b: number): number {
  const dr = r - P.kr
  const dg = g - P.kg
  const db = b - P.kb
  const meanD = (dr + dg + db) / 3
  const cdR = dr - meanD
  const cdG = dg - meanD
  const cdB = db - meanD
  const chromaVec = Math.sqrt(cdR * cdR + cdG * cdG + cdB * cdB)
  const effChroma = Math.max(0, chromaVec - 2.2)
  const maxPos = Math.max(0, dr, dg, db)
  const maxNeg = Math.max(0, -dr, -dg, -db)
  const oppPol = maxPos > 1.5 && maxNeg > 1.5 ? Math.min(maxPos, maxNeg) : 0
  let headroomBoost = 0
  if (P.kMean >= 185 && P.kMean <= 238 && meanD > 5) {
    headroomBoost = ((meanD - 5) / Math.max(18, 255 - P.kMean)) * 45
  } else if (P.kMean >= 17 && P.kMean <= 70 && -meanD > 5) {
    headroomBoost = ((-meanD - 5) / Math.max(18, P.kMean)) * 45
  }
  return (effChroma * 4.2 + oppPol * 2.8 + headroomBoost) * P.detailProtection
}

/**
 * Matte alpha liên tục cho 1 pixel với hằng số đã tính sẵn. Cho kết quả giống hệt
 * `computeChromaMatteAlpha` nhưng không tính lại cấu hình ở mỗi pixel.
 */
export function evalChromaMatte(P: ChromaMatteParams, r: number, g: number, b: number, sourceAlpha: number): number {
  if (sourceAlpha <= 0) return 0
  let distance = keyDistance(P, r, g, b)

  // Phông bão hoà cao: chiếu vector sắc độ để nhận diện pixel viền tối bị pha màu nền (anti-aliased dark fringe).
  if (P.chromatic) {
    const cMean = (r + g + b) / 3
    const pChroma = Math.max(
      0,
      Math.min(1, ((r - cMean) * P.kcr + (g - cMean) * P.kcg + (b - cMean) * P.kcb) / P.kcLenSq)
    )
    if (pChroma > 0.08) {
      const chromaDistance = Math.max(0, (1 - pChroma * P.tolFactor) * 200)
      if (chromaDistance < distance) distance = chromaDistance
    }
  } else if (P.detailProtection > 0) {
    distance += neutralDetailBoost(P, r, g, b)
  }

  if (distance <= P.hardThreshold) return 0
  if (distance >= P.hardEnd) return sourceAlpha
  return Math.round(sourceAlpha * smoothstep((distance - P.hardThreshold) / P.transitionWidth))
}

/**
 * Tạo matte alpha liên tục thay vì quyết định nhị phân. Khoảng chuyển tiếp mềm giúp giữ
 * tóc, lông và pixel anti-alias trong khi ngưỡng cứng vẫn xoá sạch phông đồng màu.
 */
export function computeChromaMatteAlpha(
  r: number,
  g: number,
  b: number,
  sourceAlpha: number,
  settings: ChromaKeySettings,
  overrideKeyRgb?: RgbColor
): number {
  if (sourceAlpha <= 0) return 0
  const params = buildChromaMatteParams(settings, overrideKeyRgb || resolveEffectiveKeyRgb(settings))
  return evalChromaMatte(params, r, g, b, sourceAlpha)
}
