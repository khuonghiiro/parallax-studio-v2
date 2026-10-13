import type { ChromaKeySettings, CutPoint, DetectedIsland } from './types'

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim()
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0
    }
  }
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0
  }
}

export function computeColorDist(
  r: number, g: number, b: number,
  kr: number, kg: number, kb: number
): number {
  const dr = r - kr
  const dg = g - kg
  const db = b - kb
  const isGreenKey = kg > kr + 20 && kg > kb + 20
  const isBlueKey = kb > kr + 20 && kb > kg + 20

  if (isGreenKey) {
    const greenDom = g - Math.max(r, b)
    const wDist = Math.sqrt(0.25 * dr * dr + 0.6 * dg * dg + 0.15 * db * db)
    const bonus = greenDom > 15 ? Math.min(25, (greenDom - 15) * 0.6) : 0
    return Math.max(0, (wDist / 255) * 100 - bonus)
  }

  if (isBlueKey) {
    const blueDom = b - Math.max(r, g)
    const wDist = Math.sqrt(0.2 * dr * dr + 0.2 * dg * dg + 0.6 * db * db)
    const bonus = blueDom > 15 ? Math.min(25, (blueDom - 15) * 0.6) : 0
    return Math.max(0, (wDist / 255) * 100 - bonus)
  }

  // Perceptually weighted Euclidean distance (0..100)
  return (Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db) / 255) * 100
}

export function applyChromaKey(
  sourceCtx: CanvasRenderingContext2D,
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ChromaKeySettings
): void {
  const imgData = sourceCtx.getImageData(0, 0, width, height)
  if (!settings.enabled) {
    targetCtx.putImageData(imgData, 0, 0)
    return
  }

  const data = imgData.data
  const { r: kr, g: kg, b: kb } = hexToRgb(settings.keyColor)
  const tol = settings.tolerance
  const smooth = Math.max(0.5, settings.smoothness)
  const isGreenKey = kg > kr && kg > kb
  const isBlueKey = kb > kr && kb > kg

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (a === 0) continue

    const dist = computeColorDist(r, g, b, kr, kg, kb)

    if (dist <= tol) {
      data[i + 3] = 0
    } else if (dist < tol + smooth) {
      const t = Math.max(0, Math.min(1, (dist - tol) / smooth))
      // Smoothstep interpolation for soft anti-aliased edge
      const feather = t * t * (3 - 2 * t)
      data[i + 3] = Math.round(a * feather)
      if (settings.despill) {
        if (isGreenKey && g > (r + b) / 2) data[i + 1] = Math.min(g, Math.round((r + b) / 2))
        else if (isBlueKey && b > (r + g) / 2) data[i + 2] = Math.min(b, Math.round((r + g) / 2))
      }
    } else if (settings.despill) {
      if (isGreenKey && g > Math.max(r, b)) {
        data[i + 1] = Math.min(g, Math.round((r + b) / 2))
      } else if (isBlueKey && b > Math.max(r, g)) {
        data[i + 2] = Math.min(b, Math.round((r + g) / 2))
      }
    }
  }

  targetCtx.putImageData(imgData, 0, 0)
}

/**
 * Tự động phát hiện các đảo pixel không trong suốt (Connected Components / Slices)
 */
export function detectOpaqueIslands(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  minArea = 100
): DetectedIsland[] {
  const imgData = ctx.getImageData(0, 0, width, height)
  const data = imgData.data
  const visited = new Uint8Array(width * height)
  const islands: DetectedIsland[] = []

  // Bước nhảy scan lưới để phát hiện mầm nhanh và chính xác
  const step = 2

  for (let sy = 0; sy < height; sy += step) {
    for (let sx = 0; sx < width; sx += step) {
      const idx = sy * width + sx
      if (visited[idx] || data[idx * 4 + 3] < 30) continue

      // BFS tìm toàn bộ vùng nối liền
      let minX = sx, maxX = sx, minY = sy, maxY = sy
      let area = 0
      const queue: number[] = [idx]
      visited[idx] = 1

      while (queue.length > 0) {
        const curr = queue.pop()!
        const cx = curr % width
        const cy = Math.floor(curr / width)
        area++

        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        // 4 hướng lân cận
        const neighbors = [
          cy > 0 ? (cy - 1) * width + cx : -1,
          cy < height - 1 ? (cy + 1) * width + cx : -1,
          cx > 0 ? cy * width + (cx - 1) : -1,
          cx < width - 1 ? cy * width + (cx + 1) : -1
        ]

        for (const n of neighbors) {
          if (n !== -1 && !visited[n] && data[n * 4 + 3] >= 30) {
            visited[n] = 1
            queue.push(n)
          }
        }
      }

      const w = maxX - minX + 1
      const h = maxY - minY + 1
      if (area >= minArea && w >= 12 && h >= 12) {
        // Mở rộng viền 2px để bảo toàn đường nét chi tiết
        const paddedMinX = Math.max(0, minX - 2)
        const paddedMinY = Math.max(0, minY - 2)
        const paddedMaxX = Math.min(width - 1, maxX + 2)
        const paddedMaxY = Math.min(height - 1, maxY + 2)

        islands.push({
          id: `island-${islands.length + 1}`,
          x: paddedMinX,
          y: paddedMinY,
          width: paddedMaxX - paddedMinX + 1,
          height: paddedMaxY - paddedMinY + 1,
          area
        })
      }
    }
  }

  // Loại bỏ các box bị bao bọc hoàn toàn bởi box lớn hơn
  const filtered = islands.filter((isl, i) => {
    return !islands.some((other, j) => {
      if (i === j) return false
      return (
        other.x <= isl.x &&
        other.y <= isl.y &&
        other.x + other.width >= isl.x + isl.width &&
        other.y + other.height >= isl.y + isl.height &&
        other.area > isl.area * 1.4
      )
    })
  })

  // Sắp xếp các mảnh tự nhiên theo thứ tự hàng trên -> dưới, cột trái -> phải
  filtered.sort((a, b) => {
    const rowA = Math.floor(a.y / 60)
    const rowB = Math.floor(b.y / 60)
    if (rowA !== rowB) return rowA - rowB
    return a.x - b.x
  })

  // Đặt nhãn rõ ràng, chuẩn xác không gán nhãn giải phẫu đoán mò
  return filtered.map((isl, idx) => ({
    ...isl,
    label: `Mảnh #${idx + 1} (${isl.width}×${isl.height})`
  }))
}

/**
 * Áp dụng cọ tẩy (xóa viền xanh còn sót) hoặc cọ khôi phục (lấy lại pixel gốc)
 */
export function applyBrushToCanvas(
  targetCtx: CanvasRenderingContext2D,
  rawCtx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  isEraser: boolean
): void {
  const r = Math.max(2, Math.round(radius))
  const startX = Math.max(0, centerX - r)
  const startY = Math.max(0, centerY - r)
  const w = Math.min(targetCtx.canvas.width - startX, r * 2)
  const h = Math.min(targetCtx.canvas.height - startY, r * 2)
  if (w <= 0 || h <= 0) return

  const targetData = targetCtx.getImageData(startX, startY, w, h)
  const rawData = isEraser ? null : rawCtx.getImageData(startX, startY, w, h)

  const tdata = targetData.data
  const rdata = rawData?.data

  const rSq = r * r

  for (let py = 0; py < h; py++) {
    const dy = startY + py - centerY
    for (let px = 0; px < w; px++) {
      const dx = startX + px - centerX
      const distSq = dx * dx + dy * dy
      if (distSq <= rSq) {
        const idx = (py * w + px) * 4
        if (isEraser) {
          // Xóa pixel về trong suốt
          tdata[idx + 3] = 0
        } else if (rdata) {
          // Khôi phục pixel gốc nguyên bản
          tdata[idx] = rdata[idx]
          tdata[idx + 1] = rdata[idx + 1]
          tdata[idx + 2] = rdata[idx + 2]
          tdata[idx + 3] = rdata[idx + 3]
        }
      }
    }
  }

  targetCtx.putImageData(targetData, startX, startY)
}

/**
 * Trích xuất ảnh PNG trong suốt từ vùng chọn (box hoặc polygon)
 */
export function extractRegionDataUrl(
  sourceCanvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  polygon?: CutPoint[]
): string {
  const w = Math.max(1, Math.round(box.width))
  const h = Math.max(1, Math.round(box.height))

  const temp = document.createElement('canvas')
  temp.width = w
  temp.height = h
  const tctx = temp.getContext('2d')
  if (!tctx) return ''

  if (polygon && polygon.length >= 3) {
    tctx.beginPath()
    tctx.moveTo(polygon[0].x - box.x, polygon[0].y - box.y)
    for (let i = 1; i < polygon.length; i++) {
      tctx.lineTo(polygon[i].x - box.x, polygon[i].y - box.y)
    }
    tctx.closePath()
    tctx.clip()
  }

  tctx.drawImage(sourceCanvas, box.x, box.y, w, h, 0, 0, w, h)
  return temp.toDataURL('image/png')
}

