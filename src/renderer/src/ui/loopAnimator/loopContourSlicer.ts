import { wasmFindOpaqueBbox } from '../../engine/wasmAccel'
import { wasmScanContourFloodBoxes } from '../../engine/wasm/wasmIsolationBridge'
import { prepareDownsampledScanContext } from './loopSourceProxy'
import type { ContourSlicerConfig, LoopFrameBox } from './types'

export interface RawBoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function scanContourFloodBoxesJs(
  imgData: Uint8ClampedArray,
  w: number,
  h: number,
  alphaThresh: number
): RawBoundingBox[] {
  const step = w > 512 || h > 512 ? 2 : 1
  const gw = Math.ceil(w / step)
  const gh = Math.ceil(h / step)
  const visited = new Uint8Array(gw * gh)
  const boxes: RawBoundingBox[] = []
  const queueX = new Int32Array(gw * gh)
  const queueY = new Int32Array(gw * gh)

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const idx = gy * gw + gx
      if (visited[idx]) continue
      const px = Math.min(w - 1, gx * step)
      const py = Math.min(h - 1, gy * step)
      if (imgData[(py * w + px) * 4 + 3] < alphaThresh) {
        visited[idx] = 1
        continue
      }

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
            visited[nIdx] = 1
            if (imgData[(npy * w + npx) * 4 + 3] >= alphaThresh) {
              queueX[tail] = nx
              queueY[tail] = ny
              tail++
            }
          }
        }
      }

      boxes.push({ minX, minY, maxX, maxY })
    }
  }

  return boxes
}

function scanContourFloodBoxes(
  imgData: Uint8ClampedArray,
  w: number,
  h: number,
  alphaThresh: number
): RawBoundingBox[] {
  return wasmScanContourFloodBoxes(imgData, w, h, alphaThresh) ?? scanContourFloodBoxesJs(imgData, w, h, alphaThresh)
}

function mergeContourBoxesByGap(boxes: RawBoundingBox[], mergeGap: number): void {
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
}

function mergeSubordinateAndParticleFragments(
  boxes: RawBoundingBox[],
  w: number,
  h: number,
  minArea: number,
  mergeGap: number
): void {
  if (boxes.length <= 1) return
  const sortedAreas = boxes
    .map((b) => (b.maxX - b.minX) * (b.maxY - b.minY))
    .sort((a, b) => b - a)
  const medianMajorArea = sortedAreas[Math.floor(sortedAreas.length * 0.25)] || sortedAreas[0] || 1000

  let fragMerged = true
  while (fragMerged) {
    fragMerged = false
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      const areaB = (b.maxX - b.minX) * (b.maxY - b.minY)
      if (areaB >= medianMajorArea * 0.15) continue

      let bestMajor = -1
      let minDist = Infinity
      for (let j = 0; j < boxes.length; j++) {
        if (i === j) continue
        const a = boxes[j]
        const areaA = (a.maxX - a.minX) * (a.maxY - a.minY)
        if (areaA < medianMajorArea * 0.3) continue

        const hOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
        const vOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
        const vDist = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY))
        const hDist = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX))
        const maxReach = Math.min(48, Math.max(a.maxX - a.minX, a.maxY - a.minY) * 0.25)

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

  const maxCellSpan = Math.max(64, Math.min(w, h) * 0.23)
  const particleGap = Math.max(mergeGap, 28)
  const particleArea = Math.max(minArea, medianMajorArea * 0.15)
  const isParticle = (bx: RawBoundingBox): boolean => (bx.maxX - bx.minX) * (bx.maxY - bx.minY) < particleArea
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

function dedupOverlappingBoxes(boxes: RawBoundingBox[]): void {
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
}

function buildNormalizedContourFrames(
  sortedBoxes: RawBoundingBox[],
  w: number,
  h: number,
  logicalW: number,
  logicalH: number,
  sx: number,
  sy: number,
  config: ContourSlicerConfig
): LoopFrameBox[] {
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

  const boxes = scanContourFloodBoxes(imgData, w, h, alphaThresh)
  mergeContourBoxesByGap(boxes, mergeGap)
  mergeSubordinateAndParticleFragments(boxes, w, h, minArea, mergeGap)
  dedupOverlappingBoxes(boxes)

  const valid = boxes.filter((b) => (b.maxX - b.minX) * (b.maxY - b.minY) >= minArea)
  if (valid.length === 0) return []

  const sortedBoxes = clusterAndSortBoxes(valid, config.readingOrder ?? 'row_first')
  return buildNormalizedContourFrames(sortedBoxes, w, h, logicalW, logicalH, sx, sy, config)
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

export function findSubRectOpaqueBboxJs(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  rectX: number,
  rectY: number,
  rectW: number,
  rectH: number,
  alphaThreshold: number
): { minX: number; minY: number; maxX: number; maxY: number; found: boolean } {
  let minX = rectW
  let minY = rectH
  let maxX = 0
  let maxY = 0
  let found = false

  for (let fy = 0; fy < rectH; fy++) {
    const py = rectY + fy
    if (py < 0 || py >= height) continue
    for (let fx = 0; fx < rectW; fx++) {
      const px = rectX + fx
      if (px < 0 || px >= width) continue
      const a = data[(py * width + px) * 4 + 3]
      if (a >= alphaThreshold) {
        if (fx < minX) minX = fx
        if (fy < minY) minY = fy
        if (fx > maxX) maxX = fx
        if (fy > maxY) maxY = fy
        found = true
      }
    }
  }

  return { minX: found ? minX : 0, minY: found ? minY : 0, maxX: found ? maxX : -1, maxY: found ? maxY : -1, found }
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

    const bbox =
      wasmFindOpaqueBbox(data, w, h, alphaThreshold, true, {
        x: sfX,
        y: sfY,
        width: sfW,
        height: sfH
      }) ?? findSubRectOpaqueBboxJs(data, w, h, sfX, sfY, sfW, sfH, alphaThreshold)

    if (!bbox.found) return { ...frame, offsetX: 0, offsetY: 0 }
    const { minX, minY, maxX, maxY } = bbox
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
