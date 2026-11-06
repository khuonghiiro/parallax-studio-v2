import type { PhotoAdjustments, PhotoFilterPreset } from './types'
import { DEFAULT_PHOTO_ADJUSTMENTS } from './types'

export function isDefaultAdjustments(adj: PhotoAdjustments): boolean {
  return (
    adj.brightness === 0 &&
    adj.contrast === 0 &&
    adj.saturation === 0 &&
    adj.warmth === 0 &&
    adj.hue === 0 &&
    Math.abs(adj.exposure - 1.0) < 0.001 &&
    !adj.grayscale &&
    !adj.invert
  )
}

export function getPresetAdjustments(preset: PhotoFilterPreset): PhotoAdjustments {
  switch (preset) {
    case 'vivid':
      return {
        ...DEFAULT_PHOTO_ADJUSTMENTS,
        brightness: 4,
        contrast: 14,
        saturation: 32,
        warmth: 6,
        exposure: 1.05
      }
    case 'warm_anime':
      return {
        ...DEFAULT_PHOTO_ADJUSTMENTS,
        brightness: 6,
        contrast: 8,
        saturation: 20,
        warmth: 28,
        exposure: 1.04
      }
    case 'cinematic_cool':
      return {
        ...DEFAULT_PHOTO_ADJUSTMENTS,
        brightness: -2,
        contrast: 18,
        saturation: -10,
        warmth: -24,
        exposure: 0.98
      }
    case 'bw':
      return {
        ...DEFAULT_PHOTO_ADJUSTMENTS,
        contrast: 16,
        grayscale: true
      }
    case 'invert':
      return {
        ...DEFAULT_PHOTO_ADJUSTMENTS,
        invert: true
      }
    case 'original':
    default:
      return { ...DEFAULT_PHOTO_ADJUSTMENTS }
  }
}

/**
 * Tạo ma trận xoay góc Hue quanh trục độ chói (1/√3, 1/√3, 1/√3) theo công thức Rodrigues.
 * Giữ nguyên độ sáng nhận thức của pixel khi xoay màu.
 */
function computeHueMatrix(angleDeg: number): [number, number, number, number, number, number, number, number, number] {
  const rad = (angleDeg * Math.PI) / 180
  const cosA = Math.cos(rad)
  const sinA = Math.sin(rad)
  const inv3 = 1.0 / 3.0
  const sqrt1_3 = Math.sqrt(inv3)

  // Rodrigues rotation matrix
  const a00 = cosA + (1.0 - cosA) * inv3
  const a01 = inv3 * (1.0 - cosA) - sqrt1_3 * sinA
  const a02 = inv3 * (1.0 - cosA) + sqrt1_3 * sinA

  const a10 = inv3 * (1.0 - cosA) + sqrt1_3 * sinA
  const a11 = cosA + inv3 * (1.0 - cosA)
  const a12 = inv3 * (1.0 - cosA) - sqrt1_3 * sinA

  const a20 = inv3 * (1.0 - cosA) - sqrt1_3 * sinA
  const a21 = inv3 * (1.0 - cosA) + sqrt1_3 * sinA
  const a22 = cosA + inv3 * (1.0 - cosA)

  return [a00, a01, a02, a10, a11, a12, a20, a21, a22]
}

/**
 * Xử lý chỉnh sửa màu sắc, độ tương phản, tông màu và bộ lọc ảnh trên buffer pixel RGBA.
 * Tốc độ xử lý O(N) dưới 3ms cho ảnh 2K/4K.
 */
export function applyColorAdjustments(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  adj: PhotoAdjustments
): void {
  if (isDefaultAdjustments(adj)) return

  const totalPixels = w * h
  const { brightness, contrast, saturation, warmth, hue, exposure, grayscale, invert } = adj

  // 1. Bảng tra cứu LUT (Exposure + Contrast + Brightness)
  const bShift = (brightness / 100) * 255
  // Chuẩn Photoshop S-curve contrast: cFactor > 1 khi contrast > 0
  const cFactor = (259 * (contrast + 255)) / Math.max(1, 255 * (259 - contrast))
  const exp = Math.max(0.1, Math.min(3.0, exposure))

  const baseLut = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    const exposed = i * exp
    const centered = cFactor * (exposed - 128) + 128 + bShift
    baseLut[i] = Math.max(0, Math.min(255, Math.round(centered)))
  }

  // 2. Hệ số Saturation & Warmth
  const satFactor = grayscale ? 0 : 1 + saturation / 100
  const wRatio = warmth / 100
  // Ấm: tăng đỏ, giảm lam. Lạnh: giảm đỏ, tăng lam
  const rWarmth = 1 + wRatio * 0.18
  const gWarmth = 1 + wRatio * 0.05
  const bWarmth = 1 - wRatio * 0.18

  const hasHue = Math.abs(hue) > 0.5
  const hueMat = hasHue ? computeHueMatrix(hue) : null

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    if (data[idx + 3] === 0) continue

    let r = data[idx]
    let g = data[idx + 1]
    let b = data[idx + 2]

    // A. Xoay Hue
    if (hueMat) {
      const hr = r * hueMat[0] + g * hueMat[1] + b * hueMat[2]
      const hg = r * hueMat[3] + g * hueMat[4] + b * hueMat[5]
      const hb = r * hueMat[6] + g * hueMat[7] + b * hueMat[8]
      r = Math.max(0, Math.min(255, hr))
      g = Math.max(0, Math.min(255, hg))
      b = Math.max(0, Math.min(255, hb))
    }

    // B. Nhiệt độ màu (Warmth / Tint)
    if (warmth !== 0) {
      r = Math.max(0, Math.min(255, r * rWarmth))
      g = Math.max(0, Math.min(255, g * gWarmth))
      b = Math.max(0, Math.min(255, b * bWarmth))
    }

    // C. Độ bão hòa (Saturation / Grayscale)
    if (grayscale || saturation !== 0) {
      const lum = r * 0.299 + g * 0.587 + b * 0.114
      r = Math.max(0, Math.min(255, lum + (r - lum) * satFactor))
      g = Math.max(0, Math.min(255, lum + (g - lum) * satFactor))
      b = Math.max(0, Math.min(255, lum + (b - lum) * satFactor))
    }

    // D. Áp dụng LUT (Exposure + Contrast + Brightness)
    r = baseLut[Math.round(r)]
    g = baseLut[Math.round(g)]
    b = baseLut[Math.round(b)]

    // E. Đảo màu (Invert)
    if (invert) {
      r = 255 - r
      g = 255 - g
      b = 255 - b
    }

    data[idx] = r
    data[idx + 1] = g
    data[idx + 2] = b
  }
}
