/**
 * Image Contract Validation Module
 *
 * Validates real images (or binary alpha masks) against ImageMeshSlotContract rules:
 * - Aspect ratio conformance with tolerance
 * - Minimum/maximum dimension bounds
 * - True alpha transparency (cutout vs solid)
 * - Fake checkerboard pattern heuristic detection
 * - Root attachment coverage (prevents detached petals/leaves)
 * - Pure functions testable without DOM / WebGL
 */

import {
  type ImageMeshSlotContract,
  imageBoundsToUvBounds
} from '@shared/imageMeshContract'

export interface PixelBuffer {
  width: number
  height: number
  /** RGBA pixel buffer (4 bytes per pixel) or binary mask (1 byte per pixel: 1=opaque, 0=transparent) */
  data: Uint8Array | Uint8ClampedArray
  /** 'rgba' (4 bytes per pixel) or 'binary' (1 byte per pixel) */
  format: 'rgba' | 'binary'
}

export interface ImageValidationMetrics {
  width: number
  height: number
  aspectRatio: number
  aspectError: number
  totalPixelCount: number
  opaquePixelCount: number
  alphaCoverageRatio: number
  contentBounds: [number, number, number, number] // [uMin, vMin, uMax, vMax] in UV space
  rootBandCoverageRatio: number
  borderOpaqueRatio: {
    top: number
    bottom: number
    left: number
    right: number
  }
  cornerTransparentRatio: number
  isCheckerboardSuspected: boolean
}

export interface ImageValidationResult {
  valid: boolean
  status: 'pass' | 'warning' | 'fail'
  metrics: ImageValidationMetrics
  errors: string[]
  warnings: string[]
  errors_en: string[]
  warnings_en: string[]
}

const ALPHA_CUTOUT_THRESHOLD = 16
const MIN_DIMENSION_PX = 32
const MAX_DIMENSION_PX = 8192

/**
 * Heuristic detector for fake checkerboard pattern (e.g. user saved screenshot with gray/white squares).
 * Checks if alternating blocks of ~8x8 to 16x16 pixels have mean color around #ffffff and #cccccc/#cccccc.
 */
function detectFakeCheckerboard(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): boolean {
  if (w < 32 || h < 32) return false
  const sampleY = Math.min(16, Math.floor(h / 4))
  const sampleH = Math.min(32, Math.floor(h / 4))
  let matches = 0
  let tests = 0

  for (let y = sampleY; y < sampleY + sampleH; y += 4) {
    for (let x = 4; x < Math.min(w - 4, 64); x += 8) {
      const idx = (y * w + x) * 4
      const r = rgba[idx]
      const g = rgba[idx + 1]
      const b = rgba[idx + 2]
      const a = rgba[idx + 3]
      if (a > 200) {
        tests++
        // Check if neutral gray or white
        const isNeutral = Math.abs(r - g) <= 5 && Math.abs(g - b) <= 5
        const isWhite = r >= 240
        const isLightGray = r >= 190 && r <= 220
        if (isNeutral && (isWhite || isLightGray)) {
          matches++
        }
      }
    }
  }
  return tests >= 12 && matches / tests >= 0.85
}

/**
 * Pure validation logic operating directly on pixel buffer data.
 */
export function validateImageBuffer(
  buffer: PixelBuffer,
  slot: Partial<ImageMeshSlotContract> & {
    aspect: [number, number]
    alphaMode?: 'cutout' | 'opaque'
  }
): ImageValidationResult {
  const { width: w, height: h, data, format } = buffer
  const errors: string[] = []
  const warnings: string[] = []
  const errors_en: string[] = []
  const warnings_en: string[] = []

  // 1. Dimensions check
  if (w < MIN_DIMENSION_PX || h < MIN_DIMENSION_PX) {
    errors.push(`Kích thước ảnh quá nhỏ (${w}x${h}px, tối thiểu ${MIN_DIMENSION_PX}px).`)
    errors_en.push(`Image resolution too low (${w}x${h}px, minimum ${MIN_DIMENSION_PX}px).`)
  }
  if (w > MAX_DIMENSION_PX || h > MAX_DIMENSION_PX) {
    errors.push(`Kích thước ảnh vượt quá giới hạn (${w}x${h}px, tối đa ${MAX_DIMENSION_PX}px).`)
    errors_en.push(`Image resolution exceeds limit (${w}x${h}px, maximum ${MAX_DIMENSION_PX}px).`)
  }

  // 2. Aspect ratio check
  const targetAspect = slot.aspect[0] / slot.aspect[1]
  const actualAspect = w / h
  const aspectError = Math.abs(actualAspect - targetAspect) / targetAspect

  if (aspectError > 0.08) {
    errors.push(`Tỉ lệ ảnh (${w}:${h} = ${actualAspect.toFixed(2)}) lệch nhiều so với tỉ lệ yêu cầu (${slot.aspect.join(':')} = ${targetAspect.toFixed(2)}).`)
    errors_en.push(`Aspect ratio (${actualAspect.toFixed(2)}) deviates significantly from expected (${targetAspect.toFixed(2)}).`)
  } else if (aspectError > 0.03) {
    warnings.push(`Tỉ lệ ảnh chênh lệch nhẹ (~${Math.round(aspectError * 100)}%). Khung mesh sẽ tự căn chỉnh khớp tỉ lệ.`)
    warnings_en.push(`Minor aspect ratio deviation (~${Math.round(aspectError * 100)}%). Frame will adjust.`)
  }

  // 3. Scan pixel alpha & bounds
  let opaqueCount = 0
  let minX = w
  let maxX = -1
  let minY = h
  let maxY = -1

  const isOpaque = (idx: number): boolean => {
    return format === 'rgba' ? data[idx * 4 + 3] > ALPHA_CUTOUT_THRESHOLD : data[idx] > 0
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (isOpaque(idx)) {
        opaqueCount++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const totalPixelCount = w * h
  const alphaCoverageRatio = totalPixelCount > 0 ? opaqueCount / totalPixelCount : 0
  const normalizedBounds: [number, number, number, number] = opaqueCount > 0
    ? [minX / w, minY / h, (maxX + 1) / w, (maxY + 1) / h]
    : [0, 0, 1, 1]
  const contentBounds = imageBoundsToUvBounds(normalizedBounds)

  // 4. Border opacity check (for opaque surfaces)
  let topOpaque = 0, bottomOpaque = 0, leftOpaque = 0, rightOpaque = 0
  for (let x = 0; x < w; x++) {
    if (isOpaque(x)) topOpaque++
    if (isOpaque((h - 1) * w + x)) bottomOpaque++
  }
  for (let y = 0; y < h; y++) {
    if (isOpaque(y * w)) leftOpaque++
    if (isOpaque(y * w + (w - 1))) rightOpaque++
  }
  const borderOpaqueRatio = {
    top: topOpaque / Math.max(1, w),
    bottom: bottomOpaque / Math.max(1, w),
    left: leftOpaque / Math.max(1, h),
    right: rightOpaque / Math.max(1, h)
  }

  // 5. Corner transparency check (for cutouts)
  const cornerRadius = Math.max(2, Math.floor(Math.min(w, h) * 0.05))
  let cornerOpaque = 0
  let cornerTotal = 0
  const checkCorner = (startX: number, startY: number) => {
    for (let y = startY; y < startY + cornerRadius; y++) {
      for (let x = startX; x < startX + cornerRadius; x++) {
        cornerTotal++
        if (isOpaque(y * w + x)) cornerOpaque++
      }
    }
  }
  checkCorner(0, 0)
  checkCorner(w - cornerRadius, 0)
  checkCorner(0, h - cornerRadius)
  checkCorner(w - cornerRadius, h - cornerRadius)
  const cornerTransparentRatio = cornerTotal > 0 ? 1 - (cornerOpaque / cornerTotal) : 1

  // 6. Root attachment band coverage check
  let rootBandCoverageRatio = 1.0
  if (slot.attachmentBand) {
    const vMin = slot.attachmentBand.vMin
    const vMax = slot.attachmentBand.vMax
    const uMin = slot.attachmentBand.uMin ?? 0
    const uMax = slot.attachmentBand.uMax ?? 1

    const y0 = Math.floor((1 - vMax) * h)
    const y1 = Math.ceil((1 - vMin) * h)
    const x0 = Math.floor(uMin * w)
    const x1 = Math.ceil(uMax * w)

    let bandOpaque = 0
    let bandTotal = 0
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
        bandTotal++
        if (isOpaque(y * w + x)) bandOpaque++
      }
    }
    rootBandCoverageRatio = bandTotal > 0 ? bandOpaque / bandTotal : 0
  }

  // 7. Checkerboard heuristic check
  let isCheckerboardSuspected = false
  if (format === 'rgba') {
    isCheckerboardSuspected = detectFakeCheckerboard(data, w, h)
    if (isCheckerboardSuspected) {
      warnings.push('Phát hiện dấu hiệu nền caro giả lập (vẽ pixel thay vì alpha trong suốt thật). Hãy kiểm tra lại file PNG.')
      warnings_en.push('Suspected fake painted checkerboard background instead of true transparent alpha. Verify PNG alpha channel.')
    }
  }

  // 8. Mode-specific rules
  const alphaMode = slot.alphaMode ?? 'cutout'
  if (alphaMode === 'cutout') {
    if (alphaCoverageRatio > 0.985) {
      errors.push('Ảnh là hình đục hoàn toàn (không có vùng alpha trong suốt). Slot yêu cầu PNG cắt viền (cutout).')
      errors_en.push('Image is completely opaque. This slot requires a transparent cutout PNG.')
    } else if (alphaCoverageRatio < 0.01) {
      errors.push('Ảnh gần như hoàn toàn trong suốt hoặc không có pixel hợp lệ.')
      errors_en.push('Image is almost completely transparent or empty.')
    }

    if (slot.attachmentBand && rootBandCoverageRatio < 0.10) {
      errors.push('Phần cuống / gốc không chạm mép chân nối. Cánh hoặc lá sẽ bị lơ lửng tách rời khỏi thân.')
      errors_en.push('Root attachment band has insufficient coverage. Petal/leaf will be detached from stem.')
    }
  } else if (alphaMode === 'opaque') {
    const minBorder = Math.min(borderOpaqueRatio.top, borderOpaqueRatio.bottom, borderOpaqueRatio.left, borderOpaqueRatio.right)
    if (minBorder < 0.95 || alphaCoverageRatio < 0.95) {
      warnings.push('Mặt phẳng yêu cầu phủ kín hoàn toàn (opaque) nhưng có vùng trong suốt ở mép hoặc thân.')
      warnings_en.push('Slot expects a solid opaque surface but transparent pixels were found.')
    }
  }

  const metrics: ImageValidationMetrics = {
    width: w,
    height: h,
    aspectRatio: actualAspect,
    aspectError,
    totalPixelCount,
    opaquePixelCount: opaqueCount,
    alphaCoverageRatio,
    contentBounds,
    rootBandCoverageRatio,
    borderOpaqueRatio,
    cornerTransparentRatio,
    isCheckerboardSuspected
  }

  const valid = errors.length === 0
  const status: 'pass' | 'warning' | 'fail' = errors.length > 0 ? 'fail' : warnings.length > 0 ? 'warning' : 'pass'

  return {
    valid,
    status,
    metrics,
    errors,
    warnings,
    errors_en,
    warnings_en
  }
}

/**
 * Validates an HTMLImageElement or HTMLCanvasElement directly in browser environment.
 */
export function validateImageElement(
  image: HTMLImageElement | HTMLCanvasElement,
  slot: Partial<ImageMeshSlotContract> & {
    aspect: [number, number]
    alphaMode?: 'cutout' | 'opaque'
  }
): ImageValidationResult {
  const w = 'naturalWidth' in image ? image.naturalWidth : image.width
  const h = 'naturalHeight' in image ? image.naturalHeight : image.height

  if (!w || !h) {
    return {
      valid: false,
      status: 'fail',
      metrics: {
        width: 0, height: 0, aspectRatio: 1, aspectError: 1,
        totalPixelCount: 0, opaquePixelCount: 0, alphaCoverageRatio: 0,
        contentBounds: [0, 0, 1, 1], rootBandCoverageRatio: 0,
        borderOpaqueRatio: { top: 0, bottom: 0, left: 0, right: 0 },
        cornerTransparentRatio: 0, isCheckerboardSuspected: false
      },
      errors: ['Không thể đọc kích thước ảnh.'],
      warnings: [],
      errors_en: ['Unable to read image dimensions.'],
      warnings_en: []
    }
  }

  // Downsample to max 512px for rapid validation
  const scale = Math.min(1, 512 / Math.max(w, h))
  const sw = Math.max(1, Math.round(w * scale))
  const sh = Math.max(1, Math.round(h * scale))

  try {
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('No 2D context')

    ctx.drawImage(image, 0, 0, sw, sh)
    const imgData = ctx.getImageData(0, 0, sw, sh)

    return validateImageBuffer(
      { width: sw, height: sh, data: imgData.data, format: 'rgba' },
      slot
    )
  } catch (err) {
    return {
      valid: false,
      status: 'fail',
      metrics: {
        width: w, height: h, aspectRatio: w / h, aspectError: 0,
        totalPixelCount: w * h, opaquePixelCount: 0, alphaCoverageRatio: 0,
        contentBounds: [0, 0, 1, 1], rootBandCoverageRatio: 0,
        borderOpaqueRatio: { top: 0, bottom: 0, left: 0, right: 0 },
        cornerTransparentRatio: 0, isCheckerboardSuspected: false
      },
      errors: [`Không thể trích xuất pixel ảnh (${(err as Error).message}).`],
      warnings: [],
      errors_en: [`Unable to extract image pixels: ${(err as Error).message}`],
      warnings_en: []
    }
  }
}
