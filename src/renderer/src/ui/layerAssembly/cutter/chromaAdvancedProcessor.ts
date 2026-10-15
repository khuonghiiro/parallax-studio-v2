import type { ChromaKeySettings, DetectedIsland, GridSlicerSettings } from './types'

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

function classifyBackgroundPixels(
  data: Uint8ClampedArray,
  totalPixels: number,
  settings: ChromaKeySettings
): { isBg: Uint8Array; shadowAlpha: Uint8Array } {
  const isBg = new Uint8Array(totalPixels)
  const shadowAlpha = new Uint8Array(totalPixels)
  shadowAlpha.fill(255)

  const keyType = settings.keyColorType || 'custom'
  const tol = Math.max(0, Math.min(100, settings.tolerance)) / 100
  const maxDist = tol * 255
  const shadowRet = Math.max(0, Math.min(100, settings.shadowRetention ?? 0)) / 100
  const targetRgb =
    keyType === 'chroma_green'
      ? { r: 0, g: 255, b: 0 }
      : keyType === 'pure_white'
      ? { r: 255, g: 255, b: 255 }
      : keyType === 'pure_black'
      ? { r: 0, g: 0, b: 0 }
      : parseHexRgb(settings.keyColorHex || settings.keyColor || '#00DB4E')

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    const a = data[idx + 3]
    if (a < 15) {
      isBg[p] = 1
      shadowAlpha[p] = 0
      continue
    }

    if (keyType === 'chroma_green') {
      const greenDiff = g - Math.max(r, b)
      const distToGreen = Math.sqrt(r * r + (255 - g) * (255 - g) + b * b)
      if ((g > 90 && greenDiff > Math.max(12, 85 - maxDist * 0.45)) || distToGreen < maxDist * 1.15) {
        isBg[p] = 1
        shadowAlpha[p] = 0
      }
    } else if (keyType === 'pure_white') {
      const distToWhite = Math.sqrt((255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2)
      const colorSpread = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b))
      if (distToWhite < maxDist) {
        isBg[p] = 1
        shadowAlpha[p] = 0
      } else if (shadowRet > 0 && colorSpread < 30 && distToWhite < maxDist + shadowRet * 180) {
        isBg[p] = 1
        const darkness = Math.min(1, (255 - (r + g + b) / 3) / 180)
        shadowAlpha[p] = Math.round(darkness * shadowRet * 220)
      }
    } else if (keyType === 'pure_black') {
      const distToBlack = Math.sqrt(r * r + g * g + b * b)
      if (distToBlack < maxDist) {
        isBg[p] = 1
        shadowAlpha[p] = 0
      }
    } else {
      const dist = Math.sqrt((r - targetRgb.r) ** 2 + (g - targetRgb.g) ** 2 + (b - targetRgb.b) ** 2)
      const isTargetGreenish = targetRgb.g > targetRgb.r + 35 && targetRgb.g > targetRgb.b + 35
      const greenDominance = isTargetGreenish ? g - Math.max(r, b) : -999
      if (dist < maxDist * 1.25 || (isTargetGreenish && g > 75 && greenDominance > Math.max(12, 80 - maxDist * 0.45))) {
        isBg[p] = 1
        shadowAlpha[p] = 0
      }
    }
  }

  return { isBg, shadowAlpha }
}

function isolateOuterConnectedBg(
  isBg: Uint8Array,
  w: number,
  h: number
): Uint8Array {
  const totalPixels = w * h
  const activeBg = new Uint8Array(totalPixels)
  const queue = new Int32Array(totalPixels)
  let head = 0
  let tail = 0

  for (let x = 0; x < w; x++) {
    const top = x
    const bot = (h - 1) * w + x
    if (isBg[top] && !activeBg[top]) {
      activeBg[top] = 1
      queue[tail++] = top
    }
    if (isBg[bot] && !activeBg[bot]) {
      activeBg[bot] = 1
      queue[tail++] = bot
    }
  }
  for (let y = 1; y < h - 1; y++) {
    const left = y * w
    const right = y * w + (w - 1)
    if (isBg[left] && !activeBg[left]) {
      activeBg[left] = 1
      queue[tail++] = left
    }
    if (isBg[right] && !activeBg[right]) {
      activeBg[right] = 1
      queue[tail++] = right
    }
  }

  while (head < tail) {
    const curr = queue[head++]
    const cx = curr % w
    const cy = (curr - cx) / w
    if (cx > 0) {
      const n = curr - 1
      if (isBg[n] && !activeBg[n]) {
        activeBg[n] = 1
        queue[tail++] = n
      }
    }
    if (cx < w - 1) {
      const n = curr + 1
      if (isBg[n] && !activeBg[n]) {
        activeBg[n] = 1
        queue[tail++] = n
      }
    }
    if (cy > 0) {
      const n = curr - w
      if (isBg[n] && !activeBg[n]) {
        activeBg[n] = 1
        queue[tail++] = n
      }
    }
    if (cy < h - 1) {
      const n = curr + w
      if (isBg[n] && !activeBg[n]) {
        activeBg[n] = 1
        queue[tail++] = n
      }
    }
  }
  return activeBg
}

function applyFeatherAndChoke(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  feather: number,
  edgeChoke: number
): void {
  const totalPixels = w * h
  if (feather > 0) {
    const alphaCopy = new Uint8Array(totalPixels)
    for (let p = 0; p < totalPixels; p++) alphaCopy[p] = data[p * 4 + 3]
    const radius = Math.min(8, Math.ceil(feather / 2))
    for (let y = radius; y < h - radius; y++) {
      for (let x = radius; x < w - radius; x++) {
        const p = y * w + x
        if (alphaCopy[p] === 0) continue
        let hasZeroNeighbor = false
        for (let dy = -radius; dy <= radius && !hasZeroNeighbor; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (alphaCopy[(y + dy) * w + (x + dx)] === 0) {
              hasZeroNeighbor = true
              break
            }
          }
        }
        if (hasZeroNeighbor) {
          data[p * 4 + 3] = Math.round(alphaCopy[p] * Math.max(0.15, 1 - feather / 28))
        }
      }
    }
  }

  if (edgeChoke > 0) {
    const chokeSteps = Math.min(10, Math.round(edgeChoke))
    const alphaBuf = new Uint8Array(totalPixels)
    for (let step = 0; step < chokeSteps; step++) {
      for (let p = 0; p < totalPixels; p++) alphaBuf[p] = data[p * 4 + 3]
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const p = y * w + x
          if (alphaBuf[p] === 0) continue
          if (
            alphaBuf[p - 1] < 20 ||
            alphaBuf[p + 1] < 20 ||
            alphaBuf[p - w] < 20 ||
            alphaBuf[p + w] < 20
          ) {
            data[p * 4 + 3] = 0
          } else if (
            alphaBuf[p - w - 1] < 20 ||
            alphaBuf[p - w + 1] < 20 ||
            alphaBuf[p + w - 1] < 20 ||
            alphaBuf[p + w + 1] < 20
          ) {
            data[p * 4 + 3] = Math.round(alphaBuf[p] * 0.35)
          }
        }
      }
    }
  }
}

function applyDefringeAndDespill(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings
): void {
  const totalPixels = w * h
  const strength = Math.max(0, Math.min(100, settings.defringeStrength ?? (settings.despill ? 50 : 0))) / 100
  if (strength <= 0) return

  const fringeType = settings.fringeColorType || settings.keyColorType || 'custom'
  const fringeRgb =
    fringeType === 'chroma_green'
      ? { r: 0, g: 255, b: 0 }
      : fringeType === 'pure_white'
      ? { r: 255, g: 255, b: 255 }
      : fringeType === 'pure_black'
      ? { r: 0, g: 0, b: 0 }
      : parseHexRgb(settings.fringeColorHex || settings.keyColorHex)

  const snapR = new Uint8Array(totalPixels)
  const snapG = new Uint8Array(totalPixels)
  const snapB = new Uint8Array(totalPixels)
  const snapA = new Uint8Array(totalPixels)
  for (let p = 0; p < totalPixels; p++) {
    const i = p * 4
    snapR[p] = data[i]
    snapG[p] = data[i + 1]
    snapB[p] = data[i + 2]
    snapA[p] = data[i + 3]
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      const a = snapA[p]
      if (a === 0) continue

      let nearTrans = a < 250
      if (!nearTrans) {
        for (let dy = -2; dy <= 2 && !nearTrans; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= h) continue
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= w) continue
            if (snapA[ny * w + nx] < 60) {
              nearTrans = true
              break
            }
          }
        }
      }
      if (!nearTrans) continue

      const idx = p * 4
      const r = snapR[p]
      const g = snapG[p]
      const b = snapB[p]

      if (fringeType === 'chroma_green') {
        const rbMax = Math.max(r, b)
        const rbAvg = (r + b) * 0.5
        if (g > rbAvg) {
          data[idx + 1] = Math.round(g - (g - (rbMax * (1 - strength * 0.45) + rbAvg * (strength * 0.45))) * Math.min(1, strength * 1.25))
          const spill = g - rbMax
          if (spill > 18) {
            data[idx + 3] = Math.max(0, Math.round(a - spill * strength * 1.4))
          }
        }
      }

      const distToFringe = Math.sqrt((r - fringeRgb.r) ** 2 + (g - fringeRgb.g) ** 2 + (b - fringeRgb.b) ** 2)
      const maxFringeDist = 45 + strength * 165
      if (distToFringe < maxFringeDist) {
        let bestR = r
        let bestG = g
        let bestB = b
        let bestScore = -1
        for (let dy = -3; dy <= 3; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= h) continue
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= w) continue
            const np = ny * w + nx
            if (snapA[np] < 210) continue
            const nd = Math.sqrt(
              (snapR[np] - fringeRgb.r) ** 2 +
                (snapG[np] - fringeRgb.g) ** 2 +
                (snapB[np] - fringeRgb.b) ** 2
            )
            if (nd > bestScore) {
              bestScore = nd
              bestR = snapR[np]
              bestG = snapG[np]
              bestB = snapB[np]
            }
          }
        }
        const closeness = 1 - distToFringe / maxFringeDist
        const pull = Math.min(1, closeness * strength * 1.35)
        if (bestScore > distToFringe + 12) {
          data[idx] = Math.round(r + (bestR - r) * pull)
          data[idx + 1] = Math.round(data[idx + 1] + (bestG - data[idx + 1]) * pull)
          data[idx + 2] = Math.round(b + (bestB - b) * pull)
        }
        if (closeness > 0.3) {
          data[idx + 3] = Math.round(data[idx + 3] * Math.max(0, 1 - closeness * strength * 1.2))
        }
      }
    }
  }
}

function applyDespeckleAndWhiteCrumbs(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings
): void {
  const totalPixels = w * h
  const whiteSens = settings.whiteSpeckleSensitivity ?? 0
  if (whiteSens > 0) {
    const sens = whiteSens / 100
    const minLum = Math.max(105, 235 - sens * 115)
    const maxSpread = 16 + sens * 58
    const snapA = new Uint8Array(totalPixels)
    for (let p = 0; p < totalPixels; p++) snapA[p] = data[p * 4 + 3]

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x
        if (snapA[p] === 0) continue
        const idx = p * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        const lum = r * 0.299 + g * 0.587 + b * 0.114
        if (lum < 85) continue
        const spread = Math.max(r, g, b) - Math.min(r, g, b)
        if (lum >= minLum && spread <= maxSpread) {
          const isEdge =
            snapA[p - 1] < 60 || snapA[p + 1] < 60 || snapA[p - w] < 60 || snapA[p + w] < 60
          if (isEdge) data[idx + 3] = 0
        }
      }
    }
  }

  const despeckleSize = settings.despeckleSize ?? 0
  const keepLargest = Boolean(settings.keepLargestIslandOnly)
  if (despeckleSize <= 0 && !keepLargest) return

  const visited = new Uint8Array(totalPixels)
  const queue = new Int32Array(totalPixels)
  const islands: { pixels: number[]; darkCount: number }[] = []
  let maxIslandLen = 0
  let maxIslandIdx = -1

  for (let p = 0; p < totalPixels; p++) {
    if (visited[p] || data[p * 4 + 3] <= 20) continue
    let head = 0
    let tail = 0
    queue[tail++] = p
    visited[p] = 1
    let darkCount = 0

    while (head < tail) {
      const curr = queue[head++]
      const ci = curr * 4
      const lum = data[ci] * 0.299 + data[ci + 1] * 0.587 + data[ci + 2] * 0.114
      if (lum < 95 && data[ci + 3] > 90) darkCount++
      const cx = curr % w
      const cy = (curr - cx) / w
      const neighbors = [
        cx > 0 ? curr - 1 : -1,
        cx < w - 1 ? curr + 1 : -1,
        cy > 0 ? curr - w : -1,
        cy < h - 1 ? curr + w : -1
      ]
      for (const n of neighbors) {
        if (n >= 0 && !visited[n] && data[n * 4 + 3] > 20) {
          visited[n] = 1
          queue[tail++] = n
        }
      }
    }

    const pixels = Array.from(queue.subarray(0, tail))
    const idx = islands.length
    islands.push({ pixels, darkCount })
    if (tail > maxIslandLen) {
      maxIslandLen = tail
      maxIslandIdx = idx
    }
  }

  const minPixelArea = despeckleSize * 4
  for (let i = 0; i < islands.length; i++) {
    const isl = islands[i]
    if (keepLargest && i !== maxIslandIdx) {
      for (const p of isl.pixels) data[p * 4 + 3] = 0
      continue
    }
    if (despeckleSize > 0 && isl.pixels.length <= minPixelArea) {
      const isDarkLine = isl.darkCount >= Math.max(3, isl.pixels.length * 0.25)
      if (!isDarkLine) {
        for (const p of isl.pixels) data[p * 4 + 3] = 0
      }
    }
  }
}

function applyEdgeSmoothAndStroke(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  settings: ChromaKeySettings
): void {
  const totalPixels = w * h
  const edgeSmooth = settings.edgeSmooth ?? 0
  if (edgeSmooth > 0) {
    const smoothStrength = Math.min(1, edgeSmooth / 10)
    const smoothColorType = settings.smoothColorType || 'none'
    const tintRgb =
      smoothColorType === 'black'
        ? { r: 15, g: 15, b: 18 }
        : smoothColorType === 'white'
        ? { r: 255, g: 255, b: 255 }
        : smoothColorType === 'custom'
        ? parseHexRgb(settings.smoothColorHex || '#000000')
        : null

    const snapA = new Uint8Array(totalPixels)
    for (let p = 0; p < totalPixels; p++) snapA[p] = data[p * 4 + 3]

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x
        const a = snapA[p]
        if (a === 0 || a === 255) continue
        const avgA =
          (snapA[p] * 2 +
            snapA[p - 1] +
            snapA[p + 1] +
            snapA[p - w] +
            snapA[p + w]) /
          6
        const idx = p * 4
        data[idx + 3] = Math.round(a * (1 - smoothStrength) + avgA * smoothStrength)
        if (tintRgb) {
          const blend = (1 - data[idx + 3] / 255) * smoothStrength * 0.75
          data[idx] = Math.round(data[idx] * (1 - blend) + tintRgb.r * blend)
          data[idx + 1] = Math.round(data[idx + 1] * (1 - blend) + tintRgb.g * blend)
          data[idx + 2] = Math.round(data[idx + 2] * (1 - blend) + tintRgb.b * blend)
        }
      }
    }
  }

  const strokeWidth = Math.max(0, Math.min(10, Math.round(settings.strokeWidth ?? 0)))
  if (strokeWidth > 0) {
    const strokeRgb = parseHexRgb(settings.strokeColorHex || '#ffffff')
    const origAlpha = new Uint8Array(totalPixels)
    for (let p = 0; p < totalPixels; p++) origAlpha[p] = data[p * 4 + 3]
    const rSq = strokeWidth * strokeWidth

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        if (origAlpha[p] > 200) continue
        let found = false
        for (let dy = -strokeWidth; dy <= strokeWidth && !found; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= h) continue
          for (let dx = -strokeWidth; dx <= strokeWidth; dx++) {
            if (dx * dx + dy * dy > rSq) continue
            const nx = x + dx
            if (nx < 0 || nx >= w) continue
            if (origAlpha[ny * w + nx] > 180) {
              found = true
              break
            }
          }
        }
        if (found) {
          const idx = p * 4
          const oa = origAlpha[p] / 255
          data[idx] = Math.round(data[idx] * oa + strokeRgb.r * (1 - oa))
          data[idx + 1] = Math.round(data[idx + 1] * oa + strokeRgb.g * (1 - oa))
          data[idx + 2] = Math.round(data[idx + 2] * oa + strokeRgb.b * (1 - oa))
          data[idx + 3] = 255
        }
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
  const { isBg, shadowAlpha } = classifyBackgroundPixels(data, totalPixels, settings)

  const isolationMode = settings.isolationMode || 'all'
  const activeBg =
    isolationMode === 'outer_only' ? isolateOuterConnectedBg(isBg, w, h) : isBg

  for (let p = 0; p < totalPixels; p++) {
    if (activeBg[p]) {
      data[p * 4 + 3] = shadowAlpha[p]
    }
  }

  const cleanupMode = settings.cleanupMode || 'all'
  const edgeChoke =
    cleanupMode === 'all' || cleanupMode === 'smooth' ? settings.edgeChoke ?? 0 : 0
  applyFeatherAndChoke(data, w, h, settings.smoothness, edgeChoke)

  if (cleanupMode === 'all' || cleanupMode === 'defringe') {
    applyDefringeAndDespill(data, w, h, settings)
  }

  if (cleanupMode === 'all' || cleanupMode === 'despeckle') {
    applyDespeckleAndWhiteCrumbs(data, w, h, settings)
  }

  if (cleanupMode === 'all' || cleanupMode === 'smooth') {
    applyEdgeSmoothAndStroke(data, w, h, settings)
  } else if ((settings.strokeWidth ?? 0) > 0) {
    applyEdgeSmoothAndStroke(data, w, h, { ...settings, edgeSmooth: 0 })
  }
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
