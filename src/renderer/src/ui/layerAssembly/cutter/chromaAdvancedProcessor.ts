import type { ChromaKeySettings, DetectedIsland, GridSlicerSettings } from './types'
import {
  analyzeChromaAlpha,
  applyShadowAndMistExtraction,
  applySmoothEdgeFeather,
  removeSoftHaloPixels,
  resolveImageEffectiveKeyRgb,
  unmixPixelRgb,
  type ChromaAlphaAnalysis
} from './chromaShadowExtractor'
import { computeChromaZone } from './chromaOuterIsolation'
import { applyEdgeSmoothAndStroke } from './chromaContourStroke'

export function parseHexRgb(hex: string): { r: number; g: number; b: number } {
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

function resolveEffectiveKeyRgb(settings: ChromaKeySettings): { r: number; g: number; b: number } {
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
  if (keyType === 'pure_white') return { r: 255, g: 255, b: 255 }
  if (keyType === 'pure_black') return { r: 0, g: 0, b: 0 }
  return parsed
}

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
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
  overrideKeyRgb?: { r: number; g: number; b: number }
): number {
  if (sourceAlpha <= 0) return 0
  const keyType = settings.keyColorType || 'custom'
  const key = overrideKeyRgb || resolveEffectiveKeyRgb(settings)
  const tolerance = Math.max(0, Math.min(100, settings.tolerance))
  const feather = Math.max(0, Math.min(30, settings.smoothness ?? 0))
  let distance: number

  if (keyType === 'chroma_green' || keyType === 'chroma_blue') {
    const keyed = keyType === 'chroma_green' ? g : b
    const keyChannel = keyType === 'chroma_green' ? key.g : key.b
    const otherA = r
    const otherB = keyType === 'chroma_green' ? b : g
    const keyOtherA = key.r
    const keyOtherB = keyType === 'chroma_green' ? key.b : key.g
    const channelDelta = keyed - keyChannel
    const otherDeltaA = otherA - keyOtherA
    const otherDeltaB = otherB - keyOtherB
    const rawDistance = Math.sqrt(
      channelDelta * channelDelta * 0.48 +
        otherDeltaA * otherDeltaA * 0.28 +
        otherDeltaB * otherDeltaB * 0.24
    )
    const dominance = keyed - Math.max(otherA, otherB)
    const keyDominance = keyChannel - Math.max(keyOtherA, keyOtherB)
    const dominanceMatch = Math.max(0, Math.min(dominance, keyDominance) - 8)
    distance = Math.max(0, rawDistance - dominanceMatch * 0.22)
  } else {
    const dr = r - key.r
    const dg = g - key.g
    const db = b - key.b
    distance = Math.sqrt(dr * dr + dg * dg + db * db)
  }

  // Đối với màu phông có độ bão hoà cao (xanh, lam, hồng magenta, đỏ, vàng, cyan...),
  // chiếu vector sắc độ để nhận diện chính xác các pixel viền tối bị pha màu nền (anti-aliased dark fringe).
  const kMean = (key.r + key.g + key.b) / 3
  const kcr = key.r - kMean
  const kcg = key.g - kMean
  const kcb = key.b - kMean
  const kcLenSq = kcr * kcr + kcg * kcg + kcb * kcb
  if (kcLenSq > 600) {
    const cMean = (r + g + b) / 3
    const pChroma = Math.max(
      0,
      Math.min(1, ((r - cMean) * kcr + (g - cMean) * kcg + (b - cMean) * kcb) / kcLenSq)
    )
    if (pChroma > 0.08) {
      const tolFactor = tolerance > 45 ? 1.0 + (tolerance - 45) * 0.016 : 1.0
      const chromaDistance = Math.max(0, (1 - pChroma * tolFactor) * 200)
      if (chromaDistance < distance) {
        distance = chromaDistance
      }
    }
  }

  const highTolBoost = tolerance > 45 ? (tolerance - 45) * 1.25 : 0
  const hardThreshold = 5 + tolerance * 1.12 + highTolBoost
  const effectiveFeather = Math.min(10, feather)
  const transitionWidth = 8 + effectiveFeather * 1.6 + tolerance * 0.18
  if (distance <= hardThreshold) return 0
  if (distance >= hardThreshold + transitionWidth) return sourceAlpha
  return Math.round(sourceAlpha * smoothstep((distance - hardThreshold) / transitionWidth))
}

function classifyBackgroundPixels(
  data: Uint8ClampedArray,
  totalPixels: number,
  settings: ChromaKeySettings,
  effectiveKeyRgb: { r: number; g: number; b: number }
): { isBg: Uint8Array; shadowAlpha: Uint8Array } {
  const isBg = new Uint8Array(totalPixels)
  const shadowAlpha = new Uint8Array(totalPixels)
  shadowAlpha.fill(255)

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    const a = data[idx + 3]
    if (a < 15) {
      isBg[p] = 1
      shadowAlpha[p] = 0
      continue
    }

    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]

    const matteAlpha = computeChromaMatteAlpha(r, g, b, a, settings, effectiveKeyRgb)
    if (matteAlpha < a) {
      isBg[p] = 1
      shadowAlpha[p] = matteAlpha
    }
  }

  return { isBg, shadowAlpha }
}

/**
 * Thu thập nhanh danh sách chỉ số các pixel nằm sát biên trong suốt (O(N) 1 lượt),
 * giúp Feather, Choke, Defringe và Smooth chỉ chạy trên ~2% pixel viền thay vì toàn bộ ảnh 4K/8K.
 */
function collectBoundaryIndices(
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

function applyFeatherAndChoke(
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
      const boundary = collectBoundaryIndices(data, w, h, alphaSnap, excludeShadowMask)
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
    applySmoothEdgeFeather(data, w, h, feather, alphaSnap, excludeShadowMask)
  }
}

function applyDefringeAndDespill(
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

  const boundary = collectBoundaryIndices(data, w, h, alphaSnap, excludeShadowMask)
  const maxFringeDistSq = (55 + strength * 175) ** 2

  for (let i = 0; i < boundary.length; i++) {
    const p = boundary[i]
    if (zone && !zone[p]) continue
    const idx = p * 4
    let a = data[idx + 3]
    if (a === 0) continue

    // 0. Giải pha màu (Color Unmixing) trực tiếp trên pixel mép bị ám màu nền (hồng, xanh, lam, tuỳ chỉnh...)
    if (analysis && effectiveKeyRgb && analysis.rawAlpha[p] < 0.96) {
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

    let r = data[idx]
    let g = data[idx + 1]
    let b = data[idx + 2]

    // 1. Khử ám xanh lá / xanh dương trực tiếp (Green / Blue Clamp O(1))
    if (isGreenFringe) {
      const rbMax = r > b ? r : b
      const rbAvg = (r + b) * 0.5
      if (g > rbAvg) {
        const targetG = rbMax * (1 - strength * 0.45) + rbAvg * (strength * 0.45)
        g = Math.round(g - (g - targetG) * Math.min(1, strength * 1.3))
        data[idx + 1] = g
        const spill = data[idx + 1] - rbMax
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
        const spill = data[idx + 2] - rgMax
        if (spill > 10) {
          a = Math.max(0, Math.round(a - spill * strength * 1.6))
          data[idx + 3] = a
        }
      }
    }

    if (a === 0) continue

    // 2. Kéo màu từ pixel đặc bên trong ra viền để xoá halo trắng/đen/xanh/hồng
    const dr = r - fringeRgb.r
    const dg = g - fringeRgb.g
    const db = b - fringeRgb.b
    const distSq = dr * dr + dg * dg + db * db
    if (distSq < maxFringeDistSq) {
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
          const ndSq =
            (nr - fringeRgb.r) ** 2 + (ng - fringeRgb.g) ** 2 + (nb - fringeRgb.b) ** 2
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
  }
}

function applyDespeckleAndWhiteCrumbs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings,
  alphaSnap: Uint8Array,
  excludeShadowMask?: Uint8Array | null
): void {
  const totalPixels = w * h
  const whiteSens = settings.whiteSpeckleSensitivity ?? 0
  if (whiteSens > 0) {
    const sens = whiteSens / 100
    const minLum = Math.max(105, 235 - sens * 115)
    const maxSpread = 16 + sens * 58
    const boundary = collectBoundaryIndices(data, w, h, alphaSnap, excludeShadowMask)
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

  const minAlpha = excludeShadowMask ? 10 : 20
  // Sử dụng mảng phẳng Int32Array không cấp phát Array JS con (nhanh gấp 50 lần trên ảnh 4K)
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
      if (cx > 0) {
        const n = curr - 1
        if (!visited[n] && data[n * 4 + 3] > minAlpha) {
          visited[n] = 1
          queue[globalWrite++] = n
        }
      }
      if (cx < w - 1) {
        const n = curr + 1
        if (!visited[n] && data[n * 4 + 3] > minAlpha) {
          visited[n] = 1
          queue[globalWrite++] = n
        }
      }
      if (cy > 0) {
        const n = curr - w
        if (!visited[n] && data[n * 4 + 3] > minAlpha) {
          visited[n] = 1
          queue[globalWrite++] = n
        }
      }
      if (cy < h - 1) {
        const n = curr + w
        if (!visited[n] && data[n * 4 + 3] > minAlpha) {
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
  const allowDespeckleWithShadow = !excludeShadowMask || totalPixels >= 4096
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

  // Giải pha màu một lần cho cả ảnh: dùng chung cho phân vùng nền ngoài / trong, tách bóng và xoá quầng
  const analysis = analyzeChromaAlpha(data, w, h, settings, effectiveKeyRgb)
  const zone = computeChromaZone(analysis, data, w, h, settings)

  const { isBg: activeBg, shadowAlpha } = classifyBackgroundPixels(
    data,
    totalPixels,
    settings,
    effectiveKeyRgb
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
    for (let p = 0; p < totalPixels; p++) {
      if (zone[p] && analysis.rawAlpha[p] < 0.98 && data[p * 4 + 3] > 0) {
        unmixPixelRgb(
          data,
          p * 4,
          effectiveKeyRgb,
          analysis.rawAlpha[p],
          analysis.isLight[p] === 1,
          analysis.isGreenKey,
          analysis.isBlueKey,
          analysis.isMagentaKey,
          data[p * 4 + 3] / 255
        )
      }
    }
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

/**
 * Công cụ Đũa thần (Magic Wand): Click 1 điểm để xoá (hoặc khôi phục) vùng màu liên thông đồng nhất.
 */
function queueWandNeighbor(
  pixel: number,
  visited: Uint8Array,
  queue: Int32Array,
  tail: number,
  refData: Uint8ClampedArray,
  targetData: Uint8ClampedArray,
  seed: { r: number; g: number; b: number },
  maxDistSq: number,
  isRestore: boolean
): number {
  if (visited[pixel]) return tail
  visited[pixel] = 1
  const i = pixel * 4
  if (!isRestore && targetData[i + 3] === 0) return tail
  const dr = refData[i] - seed.r
  const dg = refData[i + 1] - seed.g
  const db = refData[i + 2] - seed.b
  if (dr * dr + dg * dg + db * db <= maxDistSq) queue[tail++] = pixel
  return tail
}

export function applyMagicWandFlood(
  targetData: Uint8ClampedArray,
  rawData: Uint8ClampedArray | null,
  w: number,
  h: number,
  startX: number,
  startY: number,
  tolerance = 32,
  mode: 'erase' | 'restore' | boolean = false,
  userAlphaOverride?: Int16Array | null
): number {
  const isRestore = mode === 'restore' || mode === true
  const sx = Math.max(0, Math.min(w - 1, Math.round(startX)))
  const sy = Math.max(0, Math.min(h - 1, Math.round(startY)))
  const totalPixels = w * h
  const seedIdx = (sy * w + sx) * 4
  const refData = isRestore && rawData ? rawData : targetData
  const sr = refData[seedIdx]
  const sg = refData[seedIdx + 1]
  const sb = refData[seedIdx + 2]
  const seed = { r: sr, g: sg, b: sb }

  const maxDistSq = Math.max(8, (tolerance / 100) * 255 * 1.45) ** 2
  const visited = new Uint8Array(totalPixels)
  const queue = new Int32Array(totalPixels)
  let head = 0
  let tail = 0
  const startP = sy * w + sx
  visited[startP] = 1
  queue[tail++] = startP

  let changedCount = 0

  while (head < tail) {
    const p = queue[head++]
    const cx = p % w
    const cy = (p - cx) / w
    const idx = p * 4

    if (isRestore && rawData) {
      targetData[idx] = rawData[idx]
      targetData[idx + 1] = rawData[idx + 1]
      targetData[idx + 2] = rawData[idx + 2]
      targetData[idx + 3] = rawData[idx + 3]
      if (userAlphaOverride) userAlphaOverride[p] = -1
      changedCount++
    } else if (targetData[idx + 3] > 0) {
      targetData[idx + 3] = 0
      if (userAlphaOverride) userAlphaOverride[p] = 0
      changedCount++
    }

    if (cx > 0) {
      tail = queueWandNeighbor(
        p - 1, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore
      )
    }
    if (cx < w - 1) {
      tail = queueWandNeighbor(
        p + 1, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore
      )
    }
    if (cy > 0) {
      tail = queueWandNeighbor(
        p - w, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore
      )
    }
    if (cy < h - 1) {
      tail = queueWandNeighbor(
        p + w, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore
      )
    }
  }

  return changedCount
}


export function computeGridIslands(
  w: number,
  h: number,
  grid: GridSlicerSettings
): DetectedIsland[] {
  const rows = Math.max(1, Math.min(12, Math.round(grid.rows || 2)))
  const cols = Math.max(1, Math.min(12, Math.round(grid.cols || 2)))
  const pad = Math.max(0, Math.min(40, Math.round(grid.paddingInset || 0)))
  const cellW = w / cols
  const cellH = h / rows
  const result: DetectedIsland[] = []

  let idx = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(c * cellW + pad)
      const y = Math.round(r * cellH + pad)
      const bw = Math.max(4, Math.round(cellW - pad * 2))
      const bh = Math.max(4, Math.round(cellH - pad * 2))
      result.push({
        id: `grid_${r + 1}_${c + 1}`,
        x,
        y,
        width: bw,
        height: bh,
        area: bw * bh,
        label: `Ô H${r + 1}-C${c + 1} (#${idx})`
      })
      idx++
    }
  }
  return result
}
