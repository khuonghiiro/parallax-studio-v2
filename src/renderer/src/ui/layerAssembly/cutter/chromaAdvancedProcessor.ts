import type { ChromaKeySettings } from './types'
import {
  analyzeChromaAlpha,
  applyShadowAndMistExtraction,
  applySmoothEdgeFeather,
  applySmoothEdgeFeatherJs,
  removeSoftHaloPixels,
  resolveImageEffectiveKeyRgb,
  unmixPixelRgb,
  type ChromaAlphaAnalysis
} from './chromaShadowExtractor'
import { computeChromaZone } from './chromaOuterIsolation'
import { runChromaGpuAnalysis } from './chromaGpuKernel'
import { applyEdgeSmoothAndStroke } from './chromaContourStroke'
import { wasmChromaDespill } from '../../../engine/wasmAccel'
import {
  wasmApplyDefringeAndDespill,
  wasmApplyDespeckleAndWhiteCrumbs,
  wasmApplyFeatherAndChoke,
  wasmBatchUnmixPixels,
  wasmClassifyBgPixels,
  wasmCollectBoundaryIndices
} from '../../../engine/wasm/wasmChromaBridge'

import {
  buildChromaMatteParams,
  computeChromaMatteAlpha,
  evalChromaMatte,
  parseHexRgb,
  resolveEffectiveKeyRgb,
  rgbToHex
} from './chromaMatte'

// Giữ các export cũ để những module đang import từ đây không phải đổi
export { computeChromaMatteAlpha, parseHexRgb, rgbToHex }
export { getChromaGpuStatus, isChromaGpuAvailable, setChromaGpuEnabled } from './chromaGpuKernel'
export { applyMagicWandFlood, computeGridIslands } from './chromaWandAndGrid'

export function applyFastGreenDespillJs(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  greenFactor: number
): void {
  const len = width * height * 4
  const keep = Math.max(0, Math.min(1, 1 - greenFactor))
  for (let i = 0; i < len; i += 4) {
    if (data[i + 3] === 0) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const maxRb = r > b ? r : b
    if (g > maxRb) {
      data[i + 1] = Math.round(maxRb + (g - maxRb) * keep)
    }
  }
}

/**
 * Khử ám xanh lá tốc độ cao toàn ảnh (ưu tiên Rust WASM SIMD, tự động fallback JS).
 */
export function applyFastGreenDespill(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  greenFactor = 0.75
): void {
  if (wasmChromaDespill(data, width, height, greenFactor)) return
  applyFastGreenDespillJs(data, width, height, greenFactor)
}

/**
 * Đánh dấu pixel nền và alpha matte tương ứng. `precomputedMatte` (từ kernel GPU) nếu có sẽ được
 * dùng thay cho việc tính matte trên CPU ở từng pixel.
 */
export function classifyBackgroundPixels(
  data: Uint8ClampedArray,
  totalPixels: number,
  settings: ChromaKeySettings,
  effectiveKeyRgb: { r: number; g: number; b: number },
  precomputedMatte?: Uint8Array | null
): { isBg: Uint8Array; shadowAlpha: Uint8Array } {
  const wasmResult = wasmClassifyBgPixels(
    data,
    totalPixels,
    settings,
    effectiveKeyRgb,
    precomputedMatte
  )
  if (wasmResult) return wasmResult
  return classifyBackgroundPixelsJs(data, totalPixels, settings, effectiveKeyRgb, precomputedMatte)
}

export function classifyBackgroundPixelsJs(
  data: Uint8ClampedArray,
  totalPixels: number,
  settings: ChromaKeySettings,
  effectiveKeyRgb: { r: number; g: number; b: number },
  precomputedMatte?: Uint8Array | null
): { isBg: Uint8Array; shadowAlpha: Uint8Array } {
  const isBg = new Uint8Array(totalPixels)
  const shadowAlpha = new Uint8Array(totalPixels)
  shadowAlpha.fill(255)
  const params = buildChromaMatteParams(settings, effectiveKeyRgb)

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    const a = data[idx + 3]
    if (a < 15) {
      isBg[p] = 1
      shadowAlpha[p] = 0
      continue
    }

    const matteAlpha = precomputedMatte
      ? precomputedMatte[p]
      : evalChromaMatte(params, data[idx], data[idx + 1], data[idx + 2], a)
    if (matteAlpha < a) {
      isBg[p] = 1
      shadowAlpha[p] = matteAlpha
    }
  }

  return { isBg, shadowAlpha }
}

export function batchUnmixPixels(
  data: Uint8ClampedArray,
  analysis: ChromaAlphaAnalysis,
  zone: Uint8Array,
  totalPixels: number,
  effectiveKeyRgb: { r: number; g: number; b: number }
): void {
  if (wasmBatchUnmixPixels(data, analysis, zone, totalPixels, effectiveKeyRgb)) return
  batchUnmixPixelsJs(data, analysis, zone, totalPixels, effectiveKeyRgb)
}

export function batchUnmixPixelsJs(
  data: Uint8ClampedArray,
  analysis: ChromaAlphaAnalysis,
  zone: Uint8Array,
  totalPixels: number,
  effectiveKeyRgb: { r: number; g: number; b: number }
): void {
  const isChromaticKey = analysis.isGreenKey || analysis.isBlueKey || analysis.isMagentaKey
  for (let p = 0; p < totalPixels; p++) {
    const outA = data[p * 4 + 3]
    if (zone[p] && analysis.rawAlpha[p] < 0.98 && outA > 0 && (isChromaticKey || outA < 250)) {
      unmixPixelRgb(
        data,
        p * 4,
        effectiveKeyRgb,
        analysis.rawAlpha[p],
        analysis.isLight[p] === 1,
        analysis.isGreenKey,
        analysis.isBlueKey,
        analysis.isMagentaKey,
        outA / 255
      )
    }
  }
}

/**
 * Thu thập nhanh danh sách chỉ số các pixel nằm sát biên trong suốt (O(N) 1 lượt),
 * giúp Feather, Choke, Defringe và Smooth chỉ chạy trên ~2% pixel viền thay vì toàn bộ ảnh 4K/8K.
 */
export function collectBoundaryIndices(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): Int32Array {
  const wasmBoundary = wasmCollectBoundaryIndices(data, w, h, alphaSnap, excludeShadowMask)
  if (wasmBoundary) return wasmBoundary
  return collectBoundaryIndicesJs(data, w, h, alphaSnap, excludeShadowMask)
}

export function collectBoundaryIndicesJs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): Int32Array {
  const totalPixels = w * h
  for (let p = 0; p < totalPixels; p++) {
    alphaSnap[p] = data[p * 4 + 3]
  }
  const boundary = new Int32Array(Math.min(totalPixels, Math.max(4096, (w + h) * 32)))
  let count = 0
  let buf = boundary

  for (let y = 1; y < h - 1; y++) {
    const rowOff = y * w
    for (let x = 1; x < w - 1; x++) {
      const p = rowOff + x
      const a = alphaSnap[p]
      if (a === 0 || (excludeShadowMask && excludeShadowMask[p])) continue
      if (
        a < 250 ||
        alphaSnap[p - 1] < 185 ||
        alphaSnap[p + 1] < 185 ||
        alphaSnap[p - w] < 185 ||
        alphaSnap[p + w] < 185 ||
        (excludeShadowMask &&
          (excludeShadowMask[p - 1] ||
            excludeShadowMask[p + 1] ||
            excludeShadowMask[p - w] ||
            excludeShadowMask[p + w]))
      ) {
        if (count >= buf.length) {
          const next = new Int32Array(buf.length * 2)
          next.set(buf)
          buf = next
        }
        buf[count++] = p
      }
    }
  }
  return buf.subarray(0, count)
}

export function applyFeatherAndChoke(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  feather: number,
  edgeChoke: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  if (wasmApplyFeatherAndChoke(data, w, h, feather, edgeChoke, alphaSnap, excludeShadowMask)) return
  applyFeatherAndChokeJs(data, w, h, feather, edgeChoke, alphaSnap, excludeShadowMask)
}

export function applyFeatherAndChokeJs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  feather: number,
  edgeChoke: number,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  if (edgeChoke > 0) {
    const chokeSteps = Math.min(8, Math.round(edgeChoke))
    for (let step = 0; step < chokeSteps; step++) {
      const boundary = collectBoundaryIndicesJs(data, w, h, alphaSnap, excludeShadowMask)
      for (let i = 0; i < boundary.length; i++) {
        const p = boundary[i]
        if (
          alphaSnap[p - 1] < 20 ||
          alphaSnap[p + 1] < 20 ||
          alphaSnap[p - w] < 20 ||
          alphaSnap[p + w] < 20
        ) {
          data[p * 4 + 3] = 0
        } else if (
          alphaSnap[p - w - 1] < 20 ||
          alphaSnap[p - w + 1] < 20 ||
          alphaSnap[p + w - 1] < 20 ||
          alphaSnap[p + w + 1] < 20
        ) {
          data[p * 4 + 3] = Math.round(alphaSnap[p] * 0.35)
        }
      }
    }
  }

  if (feather > 0) {
    applySmoothEdgeFeatherJs(data, w, h, feather, alphaSnap, excludeShadowMask)
  }
}

function resolveDefringeOptions(
  settings: ChromaKeySettings,
  effectiveKeyRgb?: { r: number; g: number; b: number }
) {
  const rawStrength = settings.defringeStrength ?? (settings.despill ? 65 : 55)
  const strength = Math.max(0.1, Math.min(100, rawStrength)) / 100
  const fringeType = settings.fringeColorType || settings.keyColorType || 'custom'
  const fringeRgb =
    fringeType === 'chroma_green'
      ? resolveEffectiveKeyRgb({ ...settings, keyColorType: 'chroma_green' })
      : fringeType === 'chroma_blue'
      ? resolveEffectiveKeyRgb({ ...settings, keyColorType: 'chroma_blue' })
      : fringeType === 'pure_white'
      ? { r: 255, g: 255, b: 255 }
      : fringeType === 'pure_black'
      ? { r: 0, g: 0, b: 0 }
      : effectiveKeyRgb || parseHexRgb(settings.fringeColorHex || settings.keyColorHex)

  const isGreenFringe =
    fringeType === 'chroma_green' || (fringeRgb.g > fringeRgb.r + 25 && fringeRgb.g > fringeRgb.b + 15)
  const isBlueFringe =
    fringeType === 'chroma_blue' || (fringeRgb.b > fringeRgb.r + 25 && fringeRgb.b > fringeRgb.g + 15)
  return { strength, fringeRgb, isGreenFringe, isBlueFringe }
}

function pullBoundaryNeighborColor(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: number,
  alphaSnap: Uint8Array,
  fringeRgb: { r: number; g: number; b: number },
  strength: number,
  maxFringeDistSq: number
): void {
  const idx = p * 4
  const r = data[idx]
  const g = data[idx + 1]
  const b = data[idx + 2]
  const a = data[idx + 3]
  const dr = r - fringeRgb.r
  const dg = g - fringeRgb.g
  const db = b - fringeRgb.b
  const distSq = dr * dr + dg * dg + db * db
  if (distSq >= maxFringeDistSq) return

  const cx = p % w
  const cy = (p - cx) / w
  let bestR = r
  let bestG = g
  let bestB = b
  let bestScore = distSq

  const y0 = Math.max(0, cy - 3)
  const y1 = Math.min(h - 1, cy + 3)
  const x0 = Math.max(0, cx - 3)
  const x1 = Math.min(w - 1, cx + 3)
  for (let ny = y0; ny <= y1; ny++) {
    const row = ny * w
    for (let nx = x0; nx <= x1; nx++) {
      const np = row + nx
      if (alphaSnap[np] < 215) continue
      const nIdx = np * 4
      const nr = data[nIdx]
      const ng = data[nIdx + 1]
      const nb = data[nIdx + 2]
      const ndSq = (nr - fringeRgb.r) ** 2 + (ng - fringeRgb.g) ** 2 + (nb - fringeRgb.b) ** 2
      if (ndSq > bestScore) {
        bestScore = ndSq
        bestR = nr
        bestG = ng
        bestB = nb
      }
    }
  }

  const closeness = 1 - Math.sqrt(distSq / maxFringeDistSq)
  const pull = Math.min(1, closeness * strength * 1.35)
  if (bestScore > distSq + 200) {
    data[idx] = Math.round(r + (bestR - r) * pull)
    data[idx + 1] = Math.round(g + (bestG - g) * pull)
    data[idx + 2] = Math.round(b + (bestB - b) * pull)
  }
  if (closeness > 0.45) {
    data[idx + 3] = Math.round(a * Math.max(0, 1 - closeness * strength * 1.15))
  }
}

export function applyDefringeAndDespill(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null,
  analysis?: ChromaAlphaAnalysis,
  effectiveKeyRgb?: { r: number; g: number; b: number },
  zone?: Uint8Array
): void {
  const { strength, fringeRgb, isGreenFringe, isBlueFringe } = resolveDefringeOptions(
    settings,
    effectiveKeyRgb
  )
  if (
    wasmApplyDefringeAndDespill(
      data,
      w,
      h,
      strength,
      fringeRgb,
      isGreenFringe,
      isBlueFringe,
      alphaSnap,
      excludeShadowMask,
      analysis,
      effectiveKeyRgb,
      zone
    )
  ) {
    return
  }
  applyDefringeAndDespillJs(
    data,
    w,
    h,
    settings,
    alphaSnap,
    excludeShadowMask,
    analysis,
    effectiveKeyRgb,
    zone
  )
}

export function applyDefringeAndDespillJs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null,
  analysis?: ChromaAlphaAnalysis,
  effectiveKeyRgb?: { r: number; g: number; b: number },
  zone?: Uint8Array
): void {
  const { strength, fringeRgb, isGreenFringe, isBlueFringe } = resolveDefringeOptions(
    settings,
    effectiveKeyRgb
  )
  const boundary = collectBoundaryIndicesJs(data, w, h, alphaSnap, excludeShadowMask)
  const maxFringeDistSq = (55 + strength * 175) ** 2
  const isChromatic = Boolean(
    analysis && (analysis.isGreenKey || analysis.isBlueKey || analysis.isMagentaKey)
  )

  for (let i = 0; i < boundary.length; i++) {
    const p = boundary[i]
    if (zone && !zone[p]) continue
    const idx = p * 4
    let a = data[idx + 3]
    if (a === 0) continue

    if (analysis && effectiveKeyRgb && analysis.rawAlpha[p] < 0.96 && (isChromatic || a < 250)) {
      unmixPixelRgb(
        data,
        idx,
        effectiveKeyRgb,
        analysis.rawAlpha[p],
        analysis.isLight[p] === 1,
        analysis.isGreenKey,
        analysis.isBlueKey,
        analysis.isMagentaKey,
        a / 255
      )
    }

    const r = data[idx]
    let g = data[idx + 1]
    let b = data[idx + 2]

    if (isGreenFringe) {
      const rbMax = r > b ? r : b
      const rbAvg = (r + b) * 0.5
      if (g > rbAvg) {
        const targetG = rbMax * (1 - strength * 0.45) + rbAvg * (strength * 0.45)
        g = Math.round(g - (g - targetG) * Math.min(1, strength * 1.3))
        data[idx + 1] = g
        const spill = g - rbMax
        if (spill > 10) {
          a = Math.max(0, Math.round(a - spill * strength * 1.6))
          data[idx + 3] = a
        }
      }
    } else if (isBlueFringe) {
      const rgMax = r > g ? r : g
      const rgAvg = (r + g) * 0.5
      if (b > rgAvg) {
        const targetB = rgMax * (1 - strength * 0.45) + rgAvg * (strength * 0.45)
        b = Math.round(b - (b - targetB) * Math.min(1, strength * 1.3))
        data[idx + 2] = b
        const spill = b - rgMax
        if (spill > 10) {
          a = Math.max(0, Math.round(a - spill * strength * 1.6))
          data[idx + 3] = a
        }
      }
    }

    if (a > 0) {
      pullBoundaryNeighborColor(data, w, h, p, alphaSnap, fringeRgb, strength, maxFringeDistSq)
    }
  }
}

function filterSmallChromaIslandsJs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  despeckleSize: number,
  keepLargest: boolean,
  hasShadowMask: boolean
): void {
  const totalPixels = w * h
  const minAlpha = hasShadowMask ? 10 : 20
  const visited = new Uint8Array(totalPixels)
  const queue = new Int32Array(totalPixels)
  const starts: number[] = []
  const ends: number[] = []
  const darkCounts: number[] = []
  let globalWrite = 0
  let maxIslandLen = 0
  let maxIslandIdx = -1

  for (let p = 0; p < totalPixels; p++) {
    if (visited[p] || data[p * 4 + 3] <= minAlpha) continue
    const startIdx = globalWrite
    let head = startIdx
    queue[globalWrite++] = p
    visited[p] = 1
    let darkCount = 0

    while (head < globalWrite) {
      const curr = queue[head++]
      const ci = curr * 4
      const lum = data[ci] * 0.299 + data[ci + 1] * 0.587 + data[ci + 2] * 0.114
      if (lum < 95 && data[ci + 3] > 90) darkCount++
      const cx = curr % w
      const cy = (curr - cx) / w
      const neighbors = [cx > 0 ? curr - 1 : -1, cx < w - 1 ? curr + 1 : -1, cy > 0 ? curr - w : -1, cy < h - 1 ? curr + w : -1]
      for (let ni = 0; ni < 4; ni++) {
        const n = neighbors[ni]
        if (n >= 0 && !visited[n] && data[n * 4 + 3] > minAlpha) {
          visited[n] = 1
          queue[globalWrite++] = n
        }
      }
    }

    const endIdx = globalWrite
    const len = endIdx - startIdx
    const islandIdx = starts.length
    starts.push(startIdx)
    ends.push(endIdx)
    darkCounts.push(darkCount)
    if (len > maxIslandLen) {
      maxIslandLen = len
      maxIslandIdx = islandIdx
    }
  }

  const minPixelArea = despeckleSize * 4
  const allowDespeckleWithShadow = !hasShadowMask || totalPixels >= 4096
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]
    const e = ends[i]
    const len = e - s
    if (keepLargest && i !== maxIslandIdx) {
      for (let k = s; k < e; k++) data[queue[k] * 4 + 3] = 0
      continue
    }
    if (despeckleSize > 0 && len <= minPixelArea && allowDespeckleWithShadow) {
      const isDarkLine = darkCounts[i] >= Math.max(3, len * 0.25)
      if (!isDarkLine) {
        for (let k = s; k < e; k++) data[queue[k] * 4 + 3] = 0
      }
    }
  }
}

export function applyDespeckleAndWhiteCrumbs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  const whiteSens = settings.whiteSpeckleSensitivity ?? 0
  const despeckleSize = settings.despeckleSize ?? 0
  const keepLargest = Boolean(settings.keepLargestIslandOnly)
  if (
    wasmApplyDespeckleAndWhiteCrumbs(
      data,
      w,
      h,
      whiteSens,
      despeckleSize,
      keepLargest,
      alphaSnap,
      excludeShadowMask
    )
  ) {
    return
  }
  applyDespeckleAndWhiteCrumbsJs(data, w, h, settings, alphaSnap, excludeShadowMask)
}

export function applyDespeckleAndWhiteCrumbsJs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  const whiteSens = settings.whiteSpeckleSensitivity ?? 0
  if (whiteSens > 0) {
    const sens = whiteSens / 100
    const minLum = Math.max(105, 235 - sens * 115)
    const maxSpread = 16 + sens * 58
    const boundary = collectBoundaryIndicesJs(data, w, h, alphaSnap, excludeShadowMask)
    for (let i = 0; i < boundary.length; i++) {
      const p = boundary[i]
      const idx = p * 4
      const r = data[idx]
      const g = data[idx + 1]
      const b = data[idx + 2]
      const lum = r * 0.299 + g * 0.587 + b * 0.114
      if (lum < 85) continue
      const maxC = r > g ? (r > b ? r : b) : g > b ? g : b
      const minC = r < g ? (r < b ? r : b) : g < b ? g : b
      if (lum >= minLum && maxC - minC <= maxSpread) {
        data[idx + 3] = 0
      }
    }
  }

  const despeckleSize = settings.despeckleSize ?? 0
  const keepLargest = Boolean(settings.keepLargestIslandOnly)
  if (despeckleSize <= 0 && !keepLargest) return
  filterSmallChromaIslandsJs(data, w, h, despeckleSize, keepLargest, Boolean(excludeShadowMask))
}

export function processAdvancedChromaPixelData(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings
): void {
  if (!settings.enabled || settings.previewMode === 'original') return
  const totalPixels = w * h
  const baseKeyRgb = resolveEffectiveKeyRgb(settings)
  const effectiveKeyRgb = resolveImageEffectiveKeyRgb(data, w, h, settings, baseKeyRgb)

  // Giải pha màu một lần cho cả ảnh: dùng chung cho phân vùng nền ngoài / trong, tách bóng và xoá quầng.
  // Ảnh lớn chạy bước từng-pixel này trên GPU (kèm matte); không có GPU thì chạy CPU như cũ.
  const gpu = runChromaGpuAnalysis(data, w, h, settings, effectiveKeyRgb)
  const analysis = gpu ? gpu.analysis : analyzeChromaAlpha(data, w, h, settings, effectiveKeyRgb)
  const zone = computeChromaZone(analysis, data, w, h, settings)

  const { isBg: activeBg, shadowAlpha } = classifyBackgroundPixels(
    data,
    totalPixels,
    settings,
    effectiveKeyRgb,
    gpu?.matte
  )
  // "Chỉ nền ngoài": chỉ khoá màu trong vùng nền liên thông với mép ảnh, phần ruột giữ nguyên
  for (let p = 0; p < totalPixels; p++) {
    if (!zone[p]) activeBg[p] = 0
  }

  const isShadowPixel = applyShadowAndMistExtraction(
    data,
    w,
    h,
    settings,
    effectiveKeyRgb,
    activeBg,
    shadowAlpha,
    analysis,
    zone
  )

  if (!isShadowPixel) {
    for (let p = 0; p < totalPixels; p++) {
      if (activeBg[p]) {
        data[p * 4 + 3] = shadowAlpha[p]
      }
    }
    if (settings.removeSoftHalo) {
      removeSoftHaloPixels(data, w, h, settings, effectiveKeyRgb, analysis, zone)
    }
    // Tự động unmix màu nền khỏi các pixel mép biên để khử triệt để viền tím/xanh ám vào tóc
    batchUnmixPixels(data, analysis, zone, totalPixels, effectiveKeyRgb)
  }

  const alphaSnap = new Uint8Array(totalPixels)
  const cleanupMode = settings.cleanupMode || 'all'
  const edgeChoke =
    cleanupMode === 'all' || cleanupMode === 'smooth' ? settings.edgeChoke ?? 0 : 0

  // Bước 1: Gọt viền (nếu có) và Khử ám màu mép (Defringe & Color Unmixing) trước khi làm mềm biên.
  // Khi người dùng chủ động kéo Gọt viền (edgeChoke > 0), tác động trực tiếp lên biên ngoài thực tế (không bị lớp bóng mờ chặn).
  if (edgeChoke > 0) {
    applyFeatherAndChoke(data, w, h, 0, edgeChoke, alphaSnap, null)
  }
  if (cleanupMode === 'all' || cleanupMode === 'defringe') {
    applyDefringeAndDespill(
      data,
      w,
      h,
      settings,
      alphaSnap,
      isShadowPixel,
      analysis,
      effectiveKeyRgb,
      zone
    )
  }

  // Bước 2: Làm mềm biên không răng cưa (Chamfer Euclidean + Gaussian 3x3)
  if (settings.smoothness > 0) {
    const featherExclude = settings.smoothness > 2 ? null : isShadowPixel
    applyFeatherAndChoke(data, w, h, settings.smoothness, 0, alphaSnap, featherExclude)
  }

  if (cleanupMode === 'all' || cleanupMode === 'despeckle') {
    applyDespeckleAndWhiteCrumbs(data, w, h, settings, alphaSnap, isShadowPixel)
  }

  if (cleanupMode === 'all' || cleanupMode === 'smooth') {
    applyEdgeSmoothAndStroke(data, w, h, settings, alphaSnap, isShadowPixel)
  } else if ((settings.strokeWidth ?? 0) > 0) {
    applyEdgeSmoothAndStroke(
      data,
      w,
      h,
      { ...settings, edgeSmooth: 0 },
      alphaSnap,
      isShadowPixel
    )
  }
}

