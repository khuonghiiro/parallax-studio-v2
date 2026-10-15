import type { ChromaKeySettings, CutPoint, DetectedIsland, EyedropperSample } from './types'
import { processAdvancedChromaPixelData, rgbToHex } from './chromaAdvancedProcessor'

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#ffffff').replace('#', '').trim()
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
  if (!settings.enabled || settings.previewMode === 'original') {
    targetCtx.putImageData(imgData, 0, 0)
    return
  }

  processAdvancedChromaPixelData(imgData.data, width, height, settings)
  targetCtx.putImageData(imgData, 0, 0)
}

/**
 * Lấy mẫu màu pixel kèm lưới lân cận 9x9 để hiển thị kính lúp & vòng đối chiếu kiểu Adobe Photoshop
 */
export function sampleEyedropperAtPoint(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  imgX: number,
  imgY: number,
  clientX: number,
  clientY: number,
  canvasX: number,
  canvasY: number,
  prevHex: string,
  gridRadius = 4
): EyedropperSample {
  const cx = Math.max(0, Math.min(imgW - 1, Math.round(imgX)))
  const cy = Math.max(0, Math.min(imgH - 1, Math.round(imgY)))
  const size = gridRadius * 2 + 1
  const x0 = Math.max(0, cx - gridRadius)
  const y0 = Math.max(0, cy - gridRadius)
  const x1 = Math.min(imgW - 1, cx + gridRadius)
  const y1 = Math.min(imgH - 1, cy + gridRadius)
  const rw = Math.max(1, x1 - x0 + 1)
  const rh = Math.max(1, y1 - y0 + 1)
  const patch = ctx.getImageData(x0, y0, rw, rh).data

  const getPixel = (px: number, py: number) => {
    const clampedX = Math.max(x0, Math.min(x1, px)) - x0
    const clampedY = Math.max(y0, Math.min(y1, py)) - y0
    const idx = (clampedY * rw + clampedX) * 4
    return {
      r: patch[idx] ?? 0,
      g: patch[idx + 1] ?? 0,
      b: patch[idx + 2] ?? 0,
      a: patch[idx + 3] ?? 255
    }
  }

  const center = getPixel(cx, cy)
  const hex = rgbToHex(center.r, center.g, center.b)
  const pixelGrid: string[][] = []

  for (let dy = -gridRadius; dy <= gridRadius; dy++) {
    const row: string[] = []
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
      const p = getPixel(cx + dx, cy + dy)
      row.push(p.a < 15 ? 'transparent' : rgbToHex(p.r, p.g, p.b))
    }
    pixelGrid.push(row)
  }

  return {
    clientX,
    clientY,
    canvasX,
    canvasY,
    imgX: cx,
    imgY: cy,
    hex,
    r: center.r,
    g: center.g,
    b: center.b,
    a: center.a,
    prevHex: (prevHex || '#FFFFFF').toUpperCase(),
    pixelGrid: pixelGrid.length === size ? pixelGrid : []
  }
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
      if (area >= 16 && w >= 4 && h >= 4) {
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

  // Gom cụm các nét ngũ quan rời (lông mày, mắt, mũi, miệng) nằm gần nhau thành 1 mảnh biểu cảm khuôn mặt duy nhất
  const maxClusterW = Math.max(80, width * 0.23)
  const maxClusterH = Math.max(60, height * 0.16)
  let merged = true
  while (merged) {
    merged = false
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        const a = islands[i]
        const b = islands[j]
        if (a.width > maxClusterW || a.height > maxClusterH) continue
        if (b.width > maxClusterW || b.height > maxClusterH) continue
        const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width))
        const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height))
        if (gapX <= 18 && gapY <= 16) {
          const nx = Math.min(a.x, b.x)
          const ny = Math.min(a.y, b.y)
          const nw = Math.max(a.x + a.width, b.x + b.width) - nx
          const nh = Math.max(a.y + a.height, b.y + b.height) - ny
          if (nw <= maxClusterW && nh <= maxClusterH) {
            islands[i] = {
              id: a.id,
              x: nx,
              y: ny,
              width: nw,
              height: nh,
              area: a.area + b.area
            }
            islands.splice(j, 1)
            merged = true
            break
          }
        }
      }
      if (merged) break
    }
  }

  const sizeFiltered = islands.filter(
    (isl) => isl.area >= minArea && isl.width >= 12 && isl.height >= 12
  )

  // Loại bỏ các box bị bao bọc hoàn toàn bởi box lớn hơn
  const filtered = sizeFiltered.filter((isl, i) => {
    return !sizeFiltered.some((other, j) => {
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
    id: `island-${idx + 1}`,
    label: `Mảnh #${idx + 1} (${isl.width}×${isl.height})`
  }))
}

export interface CutterStrokeSettings {
  radius: number
  opacity?: number
  hardness?: number
  isEraser: boolean
}

export interface CutterStrokeSession {
  segment: (from: { x: number; y: number }, to: { x: number; y: number }) => void
  commit: () => void
  readonly changed: boolean
}

/**
 * Khởi tạo phiên nét cọ nội suy liên tục (segment interpolation) mượt mà như After Effects/Photoshop.
 * Hỗ trợ cọ tẩy (giảm alpha) và cọ khôi phục (lấy lại pixel từ ảnh gốc) với độ cứng (hardness) và lực tẩy (opacity).
 */
export function createCutterStroke(
  targetCtx: CanvasRenderingContext2D,
  rawCtx: CanvasRenderingContext2D | null,
  width: number,
  height: number,
  settings: CutterStrokeSettings
): CutterStrokeSession {
  const targetImg = targetCtx.getImageData(0, 0, width, height)
  const tdata = targetImg.data
  const rdata = !settings.isEraser && rawCtx ? rawCtx.getImageData(0, 0, width, height).data : null

  const coverage = new Float32Array(width * height)
  const initialAlpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    initialAlpha[i] = tdata[i * 4 + 3]
  }

  const radius = Math.max(1, Math.round(settings.radius))
  const opacity = Math.max(0.05, Math.min(1, settings.opacity ?? 1))
  const hardness = Math.max(0, Math.min(1, settings.hardness ?? 0.85))
  const isEraser = settings.isEraser
  let changed = false

  function segment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const lenSq = dx * dx + dy * dy

    const minX = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius - 1))
    const maxX = Math.min(width - 1, Math.ceil(Math.max(from.x, to.x) + radius + 1))
    const minY = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius - 1))
    const maxY = Math.min(height - 1, Math.ceil(Math.max(from.y, to.y) + radius + 1))

    const feather = Math.max(1 - hardness, 1 / radius)

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5 - from.x
        const py = y + 0.5 - from.y
        const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq)) : 0
        const dist = Math.hypot(px - dx * t, py - dy * t) / radius
        if (dist > 1) continue

        const fade = Math.max(0, Math.min(1, (1 - dist) / feather))
        // Smoothstep curve (3x^2 - 2x^3) for soft natural edge
        const amount = fade * fade * (3 - 2 * fade)
        const i = y * width + x
        if (amount <= coverage[i]) continue
        coverage[i] = amount

        const idx = i * 4
        if (isEraser) {
          const newAlpha = Math.round(initialAlpha[i] * (1 - opacity * amount))
          if (tdata[idx + 3] !== newAlpha) {
            tdata[idx + 3] = newAlpha
            changed = true
          }
        } else if (rdata) {
          const blend = amount * opacity
          const targetR = Math.round(tdata[idx] + (rdata[idx] - tdata[idx]) * blend)
          const targetG = Math.round(tdata[idx + 1] + (rdata[idx + 1] - tdata[idx + 1]) * blend)
          const targetB = Math.round(tdata[idx + 2] + (rdata[idx + 2] - tdata[idx + 2]) * blend)
          const targetA = Math.round(tdata[idx + 3] + (rdata[idx + 3] - tdata[idx + 3]) * blend)

          if (tdata[idx + 3] !== targetA || tdata[idx] !== targetR) {
            tdata[idx] = targetR
            tdata[idx + 1] = targetG
            tdata[idx + 2] = targetB
            tdata[idx + 3] = targetA
            changed = true
          }
        }
      }
    }
  }

  function commit() {
    if (changed) {
      targetCtx.putImageData(targetImg, 0, 0)
    }
  }

  return { segment, commit, get changed() { return changed } }
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
  isEraser: boolean,
  hardness = 0.85,
  opacity = 1
): void {
  const stroke = createCutterStroke(
    targetCtx,
    rawCtx,
    targetCtx.canvas.width,
    targetCtx.canvas.height,
    { radius, hardness, opacity, isEraser }
  )
  stroke.segment({ x: centerX, y: centerY }, { x: centerX, y: centerY })
  stroke.commit()
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

