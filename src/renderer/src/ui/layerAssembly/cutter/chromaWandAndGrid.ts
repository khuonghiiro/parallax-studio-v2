import type { DetectedIsland, GridSlicerSettings } from './types'

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

/**
 * Công cụ Đũa thần (Magic Wand): Click 1 điểm để xoá (hoặc khôi phục) vùng màu liên thông đồng nhất.
 */
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
  const seed = { r: refData[seedIdx], g: refData[seedIdx + 1], b: refData[seedIdx + 2] }

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

    if (cx > 0) tail = queueWandNeighbor(p - 1, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore)
    if (cx < w - 1) tail = queueWandNeighbor(p + 1, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore)
    if (cy > 0) tail = queueWandNeighbor(p - w, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore)
    if (cy < h - 1) tail = queueWandNeighbor(p + w, visited, queue, tail, refData, targetData, seed, maxDistSq, isRestore)
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
