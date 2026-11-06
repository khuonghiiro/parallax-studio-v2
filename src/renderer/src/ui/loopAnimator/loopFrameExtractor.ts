import {
  applyChromaKeyToImageData,
  clearGridBorderPadding,
  detectCornerKeyColor,
  parseHexRgb
} from './loopChromaProcessor'
import {
  extractHighResFrameFromProxy,
  getLoopSourceCanvasMeta,
  getLoopSourceLogicalSize,
  prepareDownsampledScanContext,
  scaleGridConfigForWorkCanvas
} from './loopSourceProxy'
import { applyLoopColorFilterToSource } from '../../project/gifHelper'
import { resolveLoopAssetUrl } from './sampleLoops'
import type { LoopAnimationPackageJson, LoopColorConfig } from '@shared/types'
import type {
  ChromaKeyConfig,
  ContourSlicerConfig,
  GridSlicerConfig,
  LoopAnimationTemplate,
  LoopFrameBox
} from './types'

export {
  applyChromaKeyToImageData,
  clearGridBorderPadding,
  detectCornerKeyColor,
  parseHexRgb
}

/**
 * Generate a list of LoopFrameBox rectangles from a uniform grid configuration.
 * Supports `borderPadding` to inset each cell inward and strip out grid border lines.
 */
export function buildGridFrames(
  imageWidth: number,
  imageHeight: number,
  grid: GridSlicerConfig
): LoopFrameBox[] {
  const cols = Math.max(1, Math.min(32, Math.round(grid.cols)))
  const rows = Math.max(1, Math.min(32, Math.round(grid.rows)))
  const borderPad = Math.max(0, Math.round(grid.borderPadding ?? 0))
  const usableW = Math.max(1, imageWidth - grid.marginX * 2 - grid.paddingX * (cols - 1))
  const usableH = Math.max(1, imageHeight - grid.marginY * 2 - grid.paddingY * (rows - 1))
  const cellW = Math.max(1, Math.floor(usableW / cols))
  const cellH = Math.max(1, Math.floor(usableH / rows))

  const frames: LoopFrameBox[] = []
  let index = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseX = Math.round(grid.marginX + c * (cellW + grid.paddingX))
      const baseY = Math.round(grid.marginY + r * (cellH + grid.paddingY))
      const x = Math.max(0, Math.min(imageWidth - 1, baseX + borderPad))
      const y = Math.max(0, Math.min(imageHeight - 1, baseY + borderPad))
      const innerW = Math.max(1, cellW - borderPad * 2)
      const innerH = Math.max(1, cellH - borderPad * 2)
      frames.push({
        id: `frame_${index}`,
        index,
        x,
        y,
        width: Math.max(1, Math.min(imageWidth - x, innerW)),
        height: Math.max(1, Math.min(imageHeight - y, innerH)),
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
 * Automatic Island / Contour Slicer:
 * Finds connected non-transparent regions on the processed source canvas, merges nearby islands
 * within `mergeGap`, filters out specks smaller than `minArea`, and sorts frames in reading order.
 */
export function detectContourFrames(
  sourceCanvas: HTMLCanvasElement,
  config: ContourSlicerConfig
): LoopFrameBox[] {
  const scan = prepareDownsampledScanContext(sourceCanvas, 1024)
  if (!scan) return []
  const { ctx, scanW: w, scanH: h, logicalW, logicalH, sx, sy } = scan
  const sUniform = (sx + sy) * 0.5
  const sArea = sx * sy

  const imgData = ctx.getImageData(0, 0, w, h).data
  const alphaThresh = Math.max(1, Math.min(254, config.alphaThreshold || 24))
  const minArea = Math.max(8, Math.round((config.minArea || 180) * sArea))
  const mergeGap = Math.max(0, Math.round((config.mergeGap ?? 8) * sUniform))

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

  // Pass 2: Merge subordinate fragments (floating embers, sparks, particles, limbs)
  // into adjacent major parent sprites if they are spatially aligned and nearby.
  if (boxes.length > 1) {
    const sortedAreas = boxes
      .map((b) => (b.maxX - b.minX) * (b.maxY - b.minY))
      .sort((a, b) => b - a)
    // Reference area based on top quartile of detected boxes
    const medianMajorArea = sortedAreas[Math.floor(sortedAreas.length * 0.25)] || sortedAreas[0] || 1000

    let fragMerged = true
    while (fragMerged) {
      fragMerged = false
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i]
        const areaB = (b.maxX - b.minX) * (b.maxY - b.minY)
        // Only treat as subordinate fragment if area is less than 15% of dominant sprites
        if (areaB >= medianMajorArea * 0.15) continue

        let bestMajor = -1
        let minDist = Infinity
        for (let j = 0; j < boxes.length; j++) {
          if (i === j) continue
          const a = boxes[j]
          const areaA = (a.maxX - a.minX) * (a.maxY - a.minY)
          if (areaA < medianMajorArea * 0.3) continue // Target must be a major sprite

          const hOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
          const vOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
          const vDist = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY))
          const hDist = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX))

          // Reach threshold: up to 48px or 25% of major box dimension
          const maxReach = Math.min(48, Math.max(a.maxX - a.minX, a.maxY - a.minY) * 0.25)

          // Subordinate fragment belongs to this sprite if column-aligned or row-aligned within reach
          if (
            (hOverlap > 0 && vDist <= maxReach) ||
            (vOverlap > 0 && hDist <= maxReach) ||
            (hDist <= maxReach && vDist <= maxReach)
          ) {
            const totalDist = vDist + hDist
            if (totalDist < minDist) {
              minDist = totalDist
              bestMajor = j
            }
          }
        }

        if (bestMajor !== -1) {
          const target = boxes[bestMajor]
          target.minX = Math.min(target.minX, b.minX)
          target.minY = Math.min(target.minY, b.minY)
          target.maxX = Math.max(target.maxX, b.maxX)
          target.maxY = Math.max(target.maxY, b.maxY)
          boxes.splice(i, 1)
          fragMerged = true
          break
        }
      }
    }
    // Also cluster nearby small particle fragments (e.g. fading sparks or star dust in a cell)
    const maxCellSpan = Math.max(64, Math.min(w, h) * 0.23)
    const particleGap = Math.max(mergeGap, 28)
    // Chỉ gom hạt bụi / tia lửa nhỏ: 2 sprite đủ lớn đứng gần nhau (ô lưới sát nhau) không bao giờ bị gộp làm 1
    const particleArea = Math.max(minArea, medianMajorArea * 0.15)
    const isParticle = (bx: RawBox): boolean => (bx.maxX - bx.minX) * (bx.maxY - bx.minY) < particleArea
    let sparkMerged = true
    while (sparkMerged) {
      sparkMerged = false
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          const hDist = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX))
          const vDist = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY))
          if (hDist > particleGap || vDist > particleGap) continue
          if (!isParticle(a) && !isParticle(b)) continue
          const combW = Math.max(a.maxX, b.maxX) - Math.min(a.minX, b.minX)
          const combH = Math.max(a.maxY, b.maxY) - Math.min(a.minY, b.minY)
          if (combW <= maxCellSpan && combH <= maxCellSpan) {
            a.minX = Math.min(a.minX, b.minX)
            a.minY = Math.min(a.minY, b.minY)
            a.maxX = Math.max(a.maxX, b.maxX)
            a.maxY = Math.max(a.maxY, b.maxY)
            boxes.splice(j, 1)
            sparkMerged = true
            break
          }
        }
        if (sparkMerged) break
      }
    }
  }

  // Pass 3: Post-merge dedup — eliminate boxes that significantly overlap with others.
  // Chroma key artifacts can split a single sprite into fragments that are
  // separated beyond mergeGap but still spatially overlapping with adjacent cells.
  let overlapMerged = true
  while (overlapMerged) {
    overlapMerged = false
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const interX = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX))
        const interY = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY))
        const interArea = interX * interY
        const areaA = (a.maxX - a.minX) * (a.maxY - a.minY)
        const areaB = (b.maxX - b.minX) * (b.maxY - b.minY)
        const smallerArea = Math.min(areaA, areaB)
        // If overlap covers >30% of the smaller box, merge them
        if (smallerArea > 0 && interArea / smallerArea > 0.3) {
          a.minX = Math.min(a.minX, b.minX)
          a.minY = Math.min(a.minY, b.minY)
          a.maxX = Math.max(a.maxX, b.maxX)
          a.maxY = Math.max(a.maxY, b.maxY)
          boxes.splice(j, 1)
          overlapMerged = true
          break
        }
      }
      if (overlapMerged) break
    }
  }

  // Filter by minimum area while preserving small opening/closing frames in the animation cycle
  const valid = boxes.filter((b) => {
    const area = (b.maxX - b.minX) * (b.maxY - b.minY)
    return area >= minArea
  })
  if (valid.length === 0) return []

  // Deterministic 2-pass row & column clustering to eliminate intransitive sort anomalies
  const sortedBoxes = clusterAndSortBoxes(valid, config.readingOrder ?? 'row_first')

  const pad = 2
  const uniformSize = config.uniformSize ?? true
  const alignAnchor = config.alignAnchor ?? 'bottom'

  let targetW = 0
  let targetH = 0
  if (uniformSize) {
    targetW = Math.max(...sortedBoxes.map((b) => b.maxX - b.minX + pad * 2))
    targetH = Math.max(...sortedBoxes.map((b) => b.maxY - b.minY + pad * 2))
  }

  return sortedBoxes.map((b, index) => {
    let x: number
    let y: number
    let width: number
    let height: number

    if (uniformSize && targetW > 0 && targetH > 0) {
      width = Math.min(w, targetW)
      height = Math.min(h, targetH)
      const centerX = (b.minX + b.maxX) * 0.5
      x = Math.max(0, Math.min(w - width, Math.round(centerX - width * 0.5)))

      if (alignAnchor === 'bottom') {
        const bottomY = b.maxY + pad
        y = Math.max(0, Math.min(h - height, Math.round(bottomY - height)))
      } else {
        const centerY = (b.minY + b.maxY) * 0.5
        y = Math.max(0, Math.min(h - height, Math.round(centerY - height * 0.5)))
      }

      // Chống tràn sang vùng nội dung của frame hàng/cột kế cận khi mở rộng khung đồng cỡ
      let minXLimit = 0
      let maxXLimit = w
      let minYLimit = 0
      let maxYLimit = h
      for (let j = 0; j < sortedBoxes.length; j++) {
        if (j === index) continue
        const other = sortedBoxes[j]
        const hOverlap = Math.min(x + width, other.maxX) - Math.max(x, other.minX)
        if (hOverlap > 0) {
          if (other.maxY <= b.minY) minYLimit = Math.max(minYLimit, other.maxY + 2)
          if (other.minY >= b.maxY) maxYLimit = Math.min(maxYLimit, other.minY - 2)
        }
        const vOverlap = Math.min(y + height, other.maxY) - Math.max(y, other.minY)
        if (vOverlap > 0) {
          if (other.maxX <= b.minX) minXLimit = Math.max(minXLimit, other.maxX + 2)
          if (other.minX >= b.maxX) maxXLimit = Math.min(maxXLimit, other.minX - 2)
        }
      }
      if (y < minYLimit) y = minYLimit
      if (y + height > maxYLimit) y = Math.max(minYLimit, maxYLimit - height)
      if (y + height > maxYLimit) height = Math.max(1, maxYLimit - y)
      if (x < minXLimit) x = minXLimit
      if (x + width > maxXLimit) x = Math.max(minXLimit, maxXLimit - width)
      if (x + width > maxXLimit) width = Math.max(1, maxXLimit - x)
    } else {
      x = Math.max(0, b.minX - pad)
      y = Math.max(0, b.minY - pad)
      width = Math.max(1, Math.min(w - x, b.maxX - b.minX + pad * 2))
      height = Math.max(1, Math.min(h - y, b.maxY - b.minY + pad * 2))
    }

    const invX = sx > 0 ? 1 / sx : 1
    const invY = sy > 0 ? 1 / sy : 1
    const needsScale = Math.abs(invX - 1) > 1e-4 || Math.abs(invY - 1) > 1e-4
    const finalX = needsScale ? Math.max(0, Math.min(logicalW - 1, Math.round(x * invX))) : x
    const finalY = needsScale ? Math.max(0, Math.min(logicalH - 1, Math.round(y * invY))) : y
    const finalW = needsScale ? Math.max(1, Math.min(logicalW - finalX, Math.round(width * invX))) : width
    const finalH = needsScale ? Math.max(1, Math.min(logicalH - finalY, Math.round(height * invY))) : height

    return {
      id: `frame_${index}`,
      index,
      x: finalX,
      y: finalY,
      width: finalW,
      height: finalH,
      offsetX: 0,
      offsetY: 0,
      enabled: true,
      durationRatio: 1
    }
  })
}

interface RawBoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Robust 2-pass cluster and sort algorithm:
 * Partitions boxes into discrete spatial rows or columns using vertical/horizontal overlap
 * and sorts elements strictly within each row/column. Prevents random frame-order inversions.
 */
export function clusterAndSortBoxes(
  boxes: RawBoundingBox[],
  readingOrder: 'row_first' | 'col_first' | 'snake' = 'row_first'
): RawBoundingBox[] {
  if (boxes.length <= 1) return [...boxes]

  if (readingOrder === 'col_first') {
    const avgW = boxes.reduce((acc, b) => acc + (b.maxX - b.minX), 0) / boxes.length
    const colThresh = Math.max(12, avgW * 0.45)
    const sortedByX = [...boxes].sort((a, b) => a.minX - b.minX)
    interface BoxCol {
      minX: number
      maxX: number
      cx: number
      boxes: RawBoundingBox[]
    }
    const cols: BoxCol[] = []
    for (const b of sortedByX) {
      const cx = (b.minX + b.maxX) * 0.5
      let best: BoxCol | null = null
      let bestDist = Infinity
      for (const c of cols) {
        const overlap = Math.min(b.maxX, c.maxX) - Math.max(b.minX, c.minX)
        const dist = Math.abs(cx - c.cx)
        if (overlap > 0 || dist <= colThresh) {
          if (dist < bestDist) {
            bestDist = dist
            best = c
          }
        }
      }
      if (best) {
        best.boxes.push(b)
        best.minX = Math.min(best.minX, b.minX)
        best.maxX = Math.max(best.maxX, b.maxX)
        best.cx = (best.minX + best.maxX) * 0.5
      } else {
        cols.push({ minX: b.minX, maxX: b.maxX, cx, boxes: [b] })
      }
    }
    cols.sort((a, b) => a.cx - b.cx)
    const res: RawBoundingBox[] = []
    cols.forEach((col) => {
      col.boxes.sort((a, b) => a.minY - b.minY)
      res.push(...col.boxes)
    })
    return res
  }

  const avgH = boxes.reduce((acc, b) => acc + (b.maxY - b.minY), 0) / boxes.length
  const rowThresh = Math.max(12, avgH * 0.45)
  const sortedByY = [...boxes].sort((a, b) => a.minY - b.minY)

  interface BoxRow {
    minY: number
    maxY: number
    cy: number
    boxes: RawBoundingBox[]
  }
  const rows: BoxRow[] = []

  for (const b of sortedByY) {
    const cy = (b.minY + b.maxY) * 0.5
    let best: BoxRow | null = null
    let bestDist = Infinity
    for (const r of rows) {
      const overlap = Math.min(b.maxY, r.maxY) - Math.max(b.minY, r.minY)
      const dist = Math.abs(cy - r.cy)
      if (overlap > 0 || dist <= rowThresh) {
        if (dist < bestDist) {
          bestDist = dist
          best = r
        }
      }
    }
    if (best) {
      best.boxes.push(b)
      best.minY = Math.min(best.minY, b.minY)
      best.maxY = Math.max(best.maxY, b.maxY)
      best.cy = (best.minY + best.maxY) * 0.5
    } else {
      rows.push({ minY: b.minY, maxY: b.maxY, cy, boxes: [b] })
    }
  }

  rows.sort((a, b) => a.cy - b.cy)
  const result: RawBoundingBox[] = []
  rows.forEach((row, rIdx) => {
    if (readingOrder === 'snake' && rIdx % 2 === 1) {
      row.boxes.sort((a, b) => b.minX - a.minX)
    } else {
      row.boxes.sort((a, b) => a.minX - b.minX)
    }
    result.push(...row.boxes)
  })
  return result
}

/**
 * Auto-calculates per-frame `offsetX` and `offsetY` so that the alpha centroid / tight bounding box
 * of every frame aligns to a common ground or center, eliminating sprite sheet jitter.
 */
export function autoCenterLoopFrames(
  sourceCanvas: HTMLCanvasElement,
  frames: LoopFrameBox[],
  alphaThreshold = 24,
  anchor: 'bottom' | 'center' | 'top' | 'left' | 'right' = 'bottom'
): LoopFrameBox[] {
  if (frames.length === 0) return frames
  const scan = prepareDownsampledScanContext(sourceCanvas, 1024)
  if (!scan) return frames
  const { ctx, scanW: w, scanH: h, sx, sy } = scan
  const data = ctx.getImageData(0, 0, w, h).data
  const invX = sx > 0 ? 1 / sx : 1
  const invY = sy > 0 ? 1 / sy : 1

  return frames.map((frame) => {
    const sfX = Math.round(frame.x * sx)
    const sfY = Math.round(frame.y * sy)
    const sfW = Math.max(1, Math.round(frame.width * sx))
    const sfH = Math.max(1, Math.round(frame.height * sy))

    let minX = sfW
    let minY = sfH
    let maxX = 0
    let maxY = 0
    let found = false

    for (let fy = 0; fy < sfH; fy++) {
      const py = sfY + fy
      if (py < 0 || py >= h) continue
      for (let fx = 0; fx < sfW; fx++) {
        const px = sfX + fx
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
    let offsetX: number
    if (anchor === 'left') {
      offsetX = Math.round(2 - minX * invX)
    } else if (anchor === 'right') {
      offsetX = Math.round(frame.width - 2 - maxX * invX)
    } else {
      const contentCenterX = (minX + maxX) * 0.5 * invX
      const boxCenterX = frame.width * 0.5
      offsetX = Math.round(boxCenterX - contentCenterX)
    }

    let offsetY: number
    if (anchor === 'bottom') {
      const targetBaseY = frame.height - 2
      offsetY = Math.round(targetBaseY - maxY * invY)
    } else if (anchor === 'top') {
      const targetTopY = 2
      offsetY = Math.round(targetTopY - minY * invY)
    } else {
      const contentCenterY = (minY + maxY) * 0.5 * invY
      const boxCenterY = frame.height * 0.5
      offsetY = Math.round(boxCenterY - contentCenterY)
    }

    return {
      ...frame,
      offsetX,
      offsetY
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
  targetHeight?: number,
  anchor: 'bottom' | 'center' | 'top' | 'left' | 'right' = 'bottom'
): HTMLCanvasElement {
  const outW = Math.max(1, Math.round(targetWidth ?? frame.width))
  const outH = Math.max(1, Math.round(targetHeight ?? frame.height))

  const meta = getLoopSourceCanvasMeta(sourceCanvas)
  if (
    meta &&
    meta.rawImage &&
    (meta.workScaleX < 0.999 || meta.workScaleY < 0.999) &&
    (outW > frame.width * meta.workScaleX + 4 || outH > frame.height * meta.workScaleY + 4)
  ) {
    const highRes = extractHighResFrameFromProxy(meta, frame, outW, outH, anchor)
    if (highRes) return highRes
  }

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const { sx, sy } = getLoopSourceLogicalSize(sourceCanvas)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const drawX =
    anchor === 'left'
      ? Math.round(frame.offsetX)
      : anchor === 'right'
        ? Math.round(canvas.width - frame.width + frame.offsetX)
        : Math.round((canvas.width - frame.width) * 0.5 + frame.offsetX)
  let drawY: number
  if (anchor === 'bottom') {
    drawY = Math.round(canvas.height - frame.height + frame.offsetY)
  } else if (anchor === 'top') {
    drawY = Math.round(frame.offsetY)
  } else {
    drawY = Math.round((canvas.height - frame.height) * 0.5 + frame.offsetY)
  }

  ctx.drawImage(
    sourceCanvas,
    frame.x * sx,
    frame.y * sy,
    Math.max(1, frame.width * sx),
    Math.max(1, frame.height * sy),
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
/**
 * Trích xuất toàn bộ các frame ảnh PNG trong suốt đã qua khử nền Chroma Key và căn chỉnh,
 * phục vụ lưu vào template để tái sử dụng ngay lập tức mà không phải chạy lại thuật toán chroma key.
 */
export function extractAllFramesAsDataUrls(
  sourceCanvas: HTMLCanvasElement,
  frames: LoopFrameBox[]
): string[] {
  const enabled = frames.filter((f) => f.enabled)
  const list = enabled.length > 0 ? enabled : frames
  return list.map((frame) => {
    const raw = extractFrameCanvas(sourceCanvas, frame, frame.width, frame.height)
    return raw.toDataURL('image/png')
  })
}

/**
 * Tính số cột × hàng chuẩn (3 hàng × N cột từ trái sang phải, từ trên xuống dưới khi >= 3 frame)
 * để hiển thị gọn gàng trong Xưởng Tách Hoạt Ảnh thay vì trải dài 1 hàng ngang.
 */
export function computeLoopSheetGrid(frameCount: number): { cols: number; rows: number } {
  if (frameCount <= 1) return { cols: 1, rows: 1 }
  if (frameCount < 3) return { cols: frameCount, rows: 1 }
  const rows = 3
  const cols = Math.ceil(frameCount / rows)
  return { cols, rows }
}

export function extractFirstFramePreviewUrl(
  sourceCanvas: HTMLCanvasElement,
  frames: LoopFrameBox[],
  maxSize = 256,
  preferredFrameIndex?: number
): string {
  const preferred =
    typeof preferredFrameIndex === 'number' &&
    preferredFrameIndex >= 0 &&
    preferredFrameIndex < frames.length &&
    frames[preferredFrameIndex]?.enabled
      ? frames[preferredFrameIndex]
      : undefined
  const targetFrame = preferred ?? frames.find((f) => f.enabled) ?? frames[0]
  if (!targetFrame) return sourceCanvas.toDataURL('image/png')
  const rawCanvas = extractFrameCanvas(sourceCanvas, targetFrame, targetFrame.width, targetFrame.height)
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
  packageJson?: LoopAnimationPackageJson
}

const _spriteSheetCache = new Map<string, Promise<CachedLoopSpriteSheet | null>>()
const _primedPackageSheets = new Map<string, CachedLoopSpriteSheet>()

/** Ghi sẵn dải frame ngang đã tách nền vào bộ nhớ đệm RAM để hiển thị tức thì 0ms */
export function primeCachedLoopTemplateSheet(templateId: string, sheet: CachedLoopSpriteSheet): void {
  _primedPackageSheets.set(templateId, sheet)
}

/** Xoá cache sprite sheet của mẫu hoạt ảnh khi cập nhật tệp animation.json hoặc lưu đè */
export function invalidateCachedLoopTemplateSheet(templateId?: string): void {
  if (!templateId) {
    _primedPackageSheets.clear()
    _spriteSheetCache.clear()
    return
  }
  _primedPackageSheets.delete(templateId)
  for (const k of [..._spriteSheetCache.keys()]) {
    if (k.startsWith(`${templateId}:`) || k.startsWith(`pkg:${templateId}:`)) {
      _spriteSheetCache.delete(k)
    }
  }
}

/** Giới hạn kích thước tối đa của dải Sprite Sheet lưu cache trong RAM (chống tràn 75MB–600MB khi nạp gói 16 frame 4K) */
const MAX_CACHED_STRIP_DIM = 3072
const MAX_CACHED_SHEET_DIM = 2048

async function loadPackageHorizontalSheet(slug: string): Promise<CachedLoopSpriteSheet | null> {
  if (typeof window === 'undefined' || !window.api?.loadBuiltInAssetBytes) return null
  const jsonRel = `loop_animations/${slug}/animation.json`
  const rawJson = await window.api.loadBuiltInAssetBytes(jsonRel)
  if (!rawJson || !rawJson.data) return null

  let pkg: LoopAnimationPackageJson
  try {
    pkg = JSON.parse(new TextDecoder('utf-8').decode(rawJson.data)) as LoopAnimationPackageJson
  } catch {
    return null
  }
  const frameDefs = pkg.frames || []
  if (frameDefs.length === 0) return null

  const baseColor: LoopColorConfig = pkg.colorConfig || {}
  const decoded = await Promise.all(
    frameDefs.map(async (f) => {
      const fRel = `loop_animations/${slug}/${f.file}`
      const raw = await window.api.loadBuiltInAssetBytes(fRel)
      if (!raw || !raw.data) return null
      const blob = new Blob([raw.data as unknown as BlobPart], { type: raw.mime || 'image/png' })
      const bmp = await createImageBitmap(blob)

      const frameColor: LoopColorConfig = {
        ...baseColor,
        tintColor: f.tintColor !== undefined ? f.tintColor : baseColor.tintColor,
        brightness: f.brightness !== undefined ? f.brightness : baseColor.brightness,
        contrast: f.contrast !== undefined ? f.contrast : baseColor.contrast,
        saturation: f.saturation !== undefined ? f.saturation : baseColor.saturation,
        hueRotate: f.hueRotate !== undefined ? f.hueRotate : baseColor.hueRotate,
        opacity: f.opacity !== undefined ? f.opacity : baseColor.opacity
      }
      const filtered = applyLoopColorFilterToSource(bmp, bmp.width, bmp.height, frameColor)
      if (filtered) {
        bmp.close()
        return { source: filtered as CanvasImageSource, width: filtered.width, height: filtered.height, bmpToClose: null, meta: f }
      }
      return { source: bmp as CanvasImageSource, width: bmp.width, height: bmp.height, bmpToClose: bmp, meta: f }
    })
  )

  const valid = decoded.filter((d): d is NonNullable<typeof d> => Boolean(d))
  if (valid.length === 0) return null

  const rawFrameW = Math.max(1, pkg.width || 0, ...valid.map((v) => v.width))
  const rawFrameH = Math.max(1, pkg.height || 0, ...valid.map((v) => v.height))
  const grid = computeLoopSheetGrid(valid.length)
  const cellScale = Math.min(
    1,
    MAX_CACHED_STRIP_DIM / Math.max(1, rawFrameW * grid.cols),
    MAX_CACHED_STRIP_DIM / Math.max(1, rawFrameH * grid.rows)
  )
  const frameW = Math.max(1, Math.round(rawFrameW * cellScale))
  const frameH = Math.max(1, Math.round(rawFrameH * cellScale))

  const stripCanvas = document.createElement('canvas')
  stripCanvas.width = frameW * grid.cols
  stripCanvas.height = frameH * grid.rows
  const sctx = stripCanvas.getContext('2d')
  if (!sctx) {
    valid.forEach((v) => v.bmpToClose?.close())
    return null
  }
  const stripFrames: LoopFrameBox[] = valid.map((v, idx) => {
    const col = idx % grid.cols
    const row = Math.floor(idx / grid.cols)
    const x = col * frameW
    const y = row * frameH
    const dw = Math.max(1, Math.round(v.width * cellScale))
    const dh = Math.max(1, Math.round(v.height * cellScale))
    const drawX = x + Math.round((frameW - dw) * 0.5)
    const drawY = y + Math.round(frameH - dh)
    sctx.drawImage(v.source, drawX, drawY, dw, dh)
    v.bmpToClose?.close()
    return {
      id: `frame_${idx}`,
      index: idx,
      x,
      y,
      width: frameW,
      height: frameH,
      offsetX: 0,
      offsetY: 0,
      enabled: true,
      durationRatio: v.meta.durationRatio ?? 1
    }
  })

  return {
    canvas: stripCanvas,
    frames: stripFrames,
    frameW,
    frameH,
    packageJson: pkg
  }
}

/**
 * Loads and caches a processed (Chroma-Key removed) sprite sheet canvas + frame list for a LoopAnimationTemplate,
 * so library cards and the 2.5D Workshop can render Frame #1 or play all frames at 60fps without re-decoding.
 */
export function getCachedLoopTemplateSheet(
  template: Pick<
    LoopAnimationTemplate,
    'id' | 'imageUrl' | 'gridConfig' | 'chromaKey' | 'frames' | 'updatedAt' | 'loopJsonPath' | 'packageFolder'
  >
): Promise<CachedLoopSpriteSheet | null> {
  const primed = _primedPackageSheets.get(template.id)
  if (primed) return Promise.resolve(primed)

  const pkgSource = (template.loopJsonPath || template.packageFolder || template.imageUrl || '').replace(/\\/g, '/')
  const pkgMatch = pkgSource.match(/loop_animations\/([^/]+)/)
  if (pkgMatch && pkgMatch[1]) {
    const slug = pkgMatch[1]
    const pkgCacheKey = `pkg:${slug}:${template.updatedAt ?? 0}`
    const existingPkg = _spriteSheetCache.get(pkgCacheKey)
    if (existingPkg) return existingPkg
    const pkgPromise = loadPackageHorizontalSheet(slug).then((res) => {
      if (res) {
        _primedPackageSheets.set(template.id, res)
        _primedPackageSheets.set(slug, res)
      } else {
        _spriteSheetCache.delete(pkgCacheKey)
      }
      return res
    })
    _spriteSheetCache.set(pkgCacheKey, pkgPromise)
    return pkgPromise
  }

  const pad = template.gridConfig?.borderPadding ?? 0
  const shMode = template.chromaKey?.shadowMode ?? 'off'
  const shType = template.chromaKey?.shadowType ?? 'auto'
  const shRet = template.chromaKey?.shadowRetention ?? 68
  const cacheKey = `${template.id}:${template.updatedAt ?? 0}:${template.imageUrl.slice(0, 64)}:${pad}:${template.chromaKey.enabled}:${template.chromaKey.keyColor}:${template.chromaKey.similarity}:${shMode}:${shType}:${shRet}:${template.chromaKey.isolationMode ?? 'all'}`
  const existing = _spriteSheetCache.get(cacheKey)
  if (existing) return existing

  const promise = new Promise<CachedLoopSpriteSheet | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const rawW = img.naturalWidth || img.width || 512
      const rawH = img.naturalHeight || img.height || 512
      const sheetScale = Math.min(1, MAX_CACHED_SHEET_DIM / Math.max(1, rawW, rawH))
      const w = Math.max(1, Math.round(rawW * sheetScale))
      const h = Math.max(1, Math.round(rawH * sheetScale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      if (pad > 0 || template.chromaKey?.enabled) {
        const imgData = ctx.getImageData(0, 0, w, h)
        if (pad > 0 && template.gridConfig) {
          clearGridBorderPadding(imgData, scaleGridConfigForWorkCanvas(template.gridConfig, sheetScale, sheetScale))
        }
        if (template.chromaKey?.enabled) {
          applyChromaKeyToImageData(imgData, template.chromaKey)
        }
        ctx.putImageData(imgData, 0, 0)
      }
      const allFrames =
        template.frames && template.frames.length > 0
          ? template.frames.map((f) =>
              sheetScale < 0.999
                ? {
                    ...f,
                    x: Math.round(f.x * sheetScale),
                    y: Math.round(f.y * sheetScale),
                    width: Math.max(1, Math.round(f.width * sheetScale)),
                    height: Math.max(1, Math.round(f.height * sheetScale)),
                    offsetX: Math.round((f.offsetX || 0) * sheetScale),
                    offsetY: Math.round((f.offsetY || 0) * sheetScale)
                  }
                : f
            )
          : buildGridFrames(w, h, scaleGridConfigForWorkCanvas(template.gridConfig, sheetScale, sheetScale))
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
