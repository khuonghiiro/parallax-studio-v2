import { resolveLoopAssetUrl } from './sampleLoops'
import type {
  ChromaKeyConfig,
  ContourSlicerConfig,
  GridSlicerConfig,
  LoopAnimationTemplate,
  LoopFrameBox
} from './types'

/**
 * Generate a list of LoopFrameBox rectangles from a uniform grid configuration.
 */
export function buildGridFrames(
  imageWidth: number,
  imageHeight: number,
  grid: GridSlicerConfig
): LoopFrameBox[] {
  const cols = Math.max(1, Math.min(32, Math.round(grid.cols)))
  const rows = Math.max(1, Math.min(32, Math.round(grid.rows)))
  const usableW = Math.max(1, imageWidth - grid.marginX * 2 - grid.paddingX * (cols - 1))
  const usableH = Math.max(1, imageHeight - grid.marginY * 2 - grid.paddingY * (rows - 1))
  const cellW = Math.max(1, Math.floor(usableW / cols))
  const cellH = Math.max(1, Math.floor(usableH / rows))

  const frames: LoopFrameBox[] = []
  let index = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = Math.round(grid.marginX + c * (cellW + grid.paddingX))
      const y = Math.round(grid.marginY + r * (cellH + grid.paddingY))
      frames.push({
        id: `frame_${index}`,
        index,
        x: Math.max(0, Math.min(imageWidth - 1, x)),
        y: Math.max(0, Math.min(imageHeight - 1, y)),
        width: Math.max(1, Math.min(imageWidth - x, cellW)),
        height: Math.max(1, Math.min(imageHeight - y, cellH)),
        offsetX: 0,
        offsetY: 0,
        enabled: true,
        durationRatio: 1
      })
      index++
    }
  }
  return frames
}

/**
 * Parse a hex color string (#rrggbb) into [r, g, b] in 0..255.
 */
export function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0
    const g = parseInt(clean[1] + clean[1], 16) || 0
    const b = parseInt(clean[2] + clean[2], 16) || 0
    return [r, g, b]
  }
  const num = parseInt(clean, 16)
  if (Number.isNaN(num)) return [0, 255, 0]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

/**
 * Sample the dominant corner pixel color of an image to auto-detect background key color.
 */
export function detectCornerKeyColor(ctx: CanvasRenderingContext2D, width: number, height: number): string {
  const pts: [number, number][] = [
    [2, 2],
    [Math.max(0, width - 3), 2],
    [2, Math.max(0, height - 3)],
    [Math.max(0, width - 3), Math.max(0, height - 3)]
  ]
  let rSum = 0
  let gSum = 0
  let bSum = 0
  for (const [x, y] of pts) {
    const d = ctx.getImageData(x, y, 1, 1).data
    rSum += d[0]
    gSum += d[1]
    bSum += d[2]
  }
  const r = Math.round(rSum / pts.length)
  const g = Math.round(gSum / pts.length)
  const b = Math.round(bSum / pts.length)
  const toHex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Apply Chroma Key background removal and green-spill suppression in-place on ImageData.
 */
export function applyChromaKeyToImageData(imageData: ImageData, chroma: ChromaKeyConfig): void {
  if (!chroma.enabled) return
  const data = imageData.data
  const [kr, kg, kb] = parseHexRgb(chroma.keyColor)
  const sim = Math.max(0.01, chroma.similarity)
  const smooth = Math.max(0.001, chroma.smoothness)
  const spill = Math.max(0, Math.min(1, chroma.spill))

  const maxDist = 441.67295593
  const lowThresh = sim * maxDist
  const highThresh = (sim + smooth) * maxDist
  const range = Math.max(1, highThresh - lowThresh)

  const isGreenDominant = kg > kr + 20 && kg > kb + 20

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a === 0) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const dr = r - kr
    const dg = g - kg
    const db = b - kb
    const dist = Math.sqrt(dr * dr + dg * dg + db * db)

    if (dist <= lowThresh) {
      data[i + 3] = 0
    } else if (dist < highThresh) {
      const factor = (dist - lowThresh) / range
      data[i + 3] = Math.round(a * factor)

      if (spill > 0 && isGreenDominant) {
        const avgRB = (r + b) * 0.5
        if (g > avgRB) {
          data[i + 1] = Math.round(g - (g - avgRB) * spill)
        }
      }
    } else if (spill > 0 && isGreenDominant && dist < highThresh * 1.35) {
      const avgRB = (r + b) * 0.5
      if (g > avgRB) {
        data[i + 1] = Math.round(g - (g - avgRB) * spill * 0.5)
      }
    }
  }
}

/**
 * Automatic Island / Contour Slicer:
 * Finds connected non-transparent regions on the processed source canvas, merges nearby islands
 * within `mergeGap`, filters out specks smaller than `minArea`, and sorts frames in reading order.
 */
export function detectContourFrames(
  sourceCanvas: HTMLCanvasElement,
  config: ContourSlicerConfig
): LoopFrameBox[] {
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  if (w <= 0 || h <= 0) return []
  const ctx = sourceCanvas.getContext('2d')
  if (!ctx) return []

  const imgData = ctx.getImageData(0, 0, w, h).data
  const alphaThresh = Math.max(1, Math.min(254, config.alphaThreshold || 24))
  const minArea = Math.max(16, config.minArea || 180)
  const mergeGap = Math.max(0, config.mergeGap ?? 8)

  // Downsample by step=2 for fast connected-components flood fill (< 5ms on 1024x1024)
  const step = w > 512 || h > 512 ? 2 : 1
  const gw = Math.ceil(w / step)
  const gh = Math.ceil(h / step)
  const visited = new Uint8Array(gw * gh)

  interface RawBox {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  const boxes: RawBox[] = []
  const queueX = new Int32Array(gw * gh)
  const queueY = new Int32Array(gw * gh)

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const idx = gy * gw + gx
      if (visited[idx]) continue
      const px = Math.min(w - 1, gx * step)
      const py = Math.min(h - 1, gy * step)
      const alpha = imgData[(py * w + px) * 4 + 3]
      if (alpha < alphaThresh) {
        visited[idx] = 1
        continue
      }

      // Flood fill 8-connected component
      let head = 0
      let tail = 0
      queueX[tail] = gx
      queueY[tail] = gy
      tail++
      visited[idx] = 1

      let minX = px
      let minY = py
      let maxX = px + step
      let maxY = py + step

      while (head < tail) {
        const cx = queueX[head]
        const cy = queueY[head]
        head++

        const realX = Math.min(w - 1, cx * step)
        const realY = Math.min(h - 1, cy * step)
        if (realX < minX) minX = realX
        if (realY < minY) minY = realY
        if (realX + step > maxX) maxX = Math.min(w, realX + step)
        if (realY + step > maxY) maxY = Math.min(h, realY + step)

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy
          if (ny < 0 || ny >= gh) continue
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = cx + dx
            if (nx < 0 || nx >= gw) continue
            const nIdx = ny * gw + nx
            if (visited[nIdx]) continue
            const npx = Math.min(w - 1, nx * step)
            const npy = Math.min(h - 1, ny * step)
            if (imgData[(npy * w + npx) * 4 + 3] >= alphaThresh) {
              visited[nIdx] = 1
              queueX[tail] = nx
              queueY[tail] = ny
              tail++
            } else {
              visited[nIdx] = 1
            }
          }
        }
      }

      boxes.push({ minX, minY, maxX, maxY })
    }
  }

  // Iteratively merge boxes that overlap or are within `mergeGap` pixels
  let merged = true
  while (merged) {
    merged = false
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const separated =
          a.maxX + mergeGap < b.minX ||
          b.maxX + mergeGap < a.minX ||
          a.maxY + mergeGap < b.minY ||
          b.maxY + mergeGap < a.minY
        if (!separated) {
          a.minX = Math.min(a.minX, b.minX)
          a.minY = Math.min(a.minY, b.minY)
          a.maxX = Math.max(a.maxX, b.maxX)
          a.maxY = Math.max(a.maxY, b.maxY)
          boxes.splice(j, 1)
          merged = true
          break
        }
      }
      if (merged) break
    }
  }

  // Filter by minimum area and add a small 2px safety margin
  const valid = boxes.filter((b) => (b.maxX - b.minX) * (b.maxY - b.minY) >= minArea)
  if (valid.length === 0) return []

  // Sort in reading order (group into rows by vertical overlap / average height)
  const avgH = valid.reduce((acc, b) => acc + (b.maxY - b.minY), 0) / valid.length
  const rowTolerance = Math.max(12, avgH * 0.55)
  valid.sort((a, b) => {
    const cyA = (a.minY + a.maxY) * 0.5
    const cyB = (b.minY + b.maxY) * 0.5
    if (Math.abs(cyA - cyB) > rowTolerance) return cyA - cyB
    return a.minX - b.minX
  })

  // Normalize to uniform max width/height if desired, or keep tight bounds with centered offset
  return valid.map((b, index) => {
    const pad = 2
    const x = Math.max(0, b.minX - pad)
    const y = Math.max(0, b.minY - pad)
    const width = Math.max(1, Math.min(w - x, b.maxX - b.minX + pad * 2))
    const height = Math.max(1, Math.min(h - y, b.maxY - b.minY + pad * 2))
    return {
      id: `frame_${index}`,
      index,
      x,
      y,
      width,
      height,
      offsetX: 0,
      offsetY: 0,
      enabled: true,
      durationRatio: 1
    }
  })
}

/**
 * Auto-calculates per-frame `offsetX` and `offsetY` so that the alpha centroid / tight bounding box
 * of every frame aligns to a common center, eliminating sprite sheet jitter.
 */
export function autoCenterLoopFrames(
  sourceCanvas: HTMLCanvasElement,
  frames: LoopFrameBox[],
  alphaThreshold = 24
): LoopFrameBox[] {
  const ctx = sourceCanvas.getContext('2d')
  if (!ctx || frames.length === 0) return frames
  const w = sourceCanvas.width
  const h = sourceCanvas.height
  const data = ctx.getImageData(0, 0, w, h).data

  return frames.map((frame) => {
    let minX = frame.width
    let minY = frame.height
    let maxX = 0
    let maxY = 0
    let found = false

    for (let fy = 0; fy < frame.height; fy++) {
      const py = frame.y + fy
      if (py < 0 || py >= h) continue
      for (let fx = 0; fx < frame.width; fx++) {
        const px = frame.x + fx
        if (px < 0 || px >= w) continue
        const a = data[(py * w + px) * 4 + 3]
        if (a >= alphaThreshold) {
          if (fx < minX) minX = fx
          if (fy < minY) minY = fy
          if (fx > maxX) maxX = fx
          if (fy > maxY) maxY = fy
          found = true
        }
      }
    }

    if (!found) return { ...frame, offsetX: 0, offsetY: 0 }
    const contentCenterX = (minX + maxX) * 0.5
    const contentCenterY = (minY + maxY) * 0.5
    const boxCenterX = frame.width * 0.5
    const boxCenterY = frame.height * 0.5
    return {
      ...frame,
      offsetX: Math.round(boxCenterX - contentCenterX),
      offsetY: Math.round(boxCenterY - contentCenterY)
    }
  })
}

/**
 * Render a single cropped frame from a processed source canvas into a new canvas.
 */
export function extractFrameCanvas(
  sourceCanvas: HTMLCanvasElement,
  frame: LoopFrameBox,
  targetWidth?: number,
  targetHeight?: number
): HTMLCanvasElement {
  const outW = targetWidth ?? frame.width
  const outH = targetHeight ?? frame.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(outW))
  canvas.height = Math.max(1, Math.round(outH))
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const drawX = Math.round((canvas.width - frame.width) * 0.5 + frame.offsetX)
  const drawY = Math.round((canvas.height - frame.height) * 0.5 + frame.offsetY)

  ctx.drawImage(
    sourceCanvas,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    drawX,
    drawY,
    frame.width,
    frame.height
  )
  return canvas
}

/**
 * Extract the cropped First Frame (Frame #1) as a compact PNG DataURL for library thumbnails.
 */
export function extractFirstFramePreviewUrl(
  sourceCanvas: HTMLCanvasElement,
  frames: LoopFrameBox[],
  maxSize = 256
): string {
  const firstFrame = frames.find((f) => f.enabled) ?? frames[0]
  if (!firstFrame) return sourceCanvas.toDataURL('image/png')
  const rawCanvas = extractFrameCanvas(sourceCanvas, firstFrame, firstFrame.width, firstFrame.height)
  const scale = Math.min(1, maxSize / Math.max(1, rawCanvas.width, rawCanvas.height))
  if (scale >= 0.99) return rawCanvas.toDataURL('image/png')

  const thumb = document.createElement('canvas')
  thumb.width = Math.max(1, Math.round(rawCanvas.width * scale))
  thumb.height = Math.max(1, Math.round(rawCanvas.height * scale))
  const tctx = thumb.getContext('2d')
  if (tctx) {
    tctx.drawImage(rawCanvas, 0, 0, thumb.width, thumb.height)
  }
  return thumb.toDataURL('image/png')
}

export interface CachedLoopSpriteSheet {
  canvas: HTMLCanvasElement
  frames: LoopFrameBox[]
  frameW: number
  frameH: number
}

const _spriteSheetCache = new Map<string, Promise<CachedLoopSpriteSheet | null>>()

/**
 * Loads and caches a processed (Chroma-Key removed) sprite sheet canvas + frame list for a LoopAnimationTemplate,
 * so library cards and the 2.5D Workshop can render Frame #1 or play all frames at 60fps without re-decoding.
 */
export function getCachedLoopTemplateSheet(
  template: Pick<
    LoopAnimationTemplate,
    'id' | 'imageUrl' | 'gridConfig' | 'chromaKey' | 'frames' | 'updatedAt'
  >
): Promise<CachedLoopSpriteSheet | null> {
  const cacheKey = `${template.id}:${template.updatedAt ?? 0}:${template.imageUrl.slice(0, 64)}:${template.chromaKey.enabled}:${template.chromaKey.keyColor}:${template.chromaKey.similarity}`
  const existing = _spriteSheetCache.get(cacheKey)
  if (existing) return existing

  const promise = new Promise<CachedLoopSpriteSheet | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth || img.width || 512
      const h = img.naturalHeight || img.height || 512
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      if (template.chromaKey?.enabled) {
        const imgData = ctx.getImageData(0, 0, w, h)
        applyChromaKeyToImageData(imgData, template.chromaKey)
        ctx.putImageData(imgData, 0, 0)
      }
      const allFrames =
        template.frames && template.frames.length > 0
          ? template.frames
          : buildGridFrames(w, h, template.gridConfig)
      const enabledFrames = allFrames.filter((f) => f.enabled)
      const activeFrames = enabledFrames.length > 0 ? enabledFrames : allFrames
      const frameW = Math.max(1, ...activeFrames.map((f) => f.width))
      const frameH = Math.max(1, ...activeFrames.map((f) => f.height))
      resolve({ canvas, frames: activeFrames, frameW, frameH })
    }
    img.onerror = () => {
      _spriteSheetCache.delete(cacheKey)
      resolve(null)
    }
    void resolveLoopAssetUrl(template.imageUrl).then((resolved) => {
      img.src = resolved || template.imageUrl
    })
  })

  _spriteSheetCache.set(cacheKey, promise)
  return promise
}
