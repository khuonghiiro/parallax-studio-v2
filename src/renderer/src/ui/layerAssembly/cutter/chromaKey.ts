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
  r: number,
  g: number,
  b: number,
  kr: number,
  kg: number,
  kb: number
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

  return (Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db) / 255) * 100
}

export function applyChromaKey(
  sourceCtx: CanvasRenderingContext2D,
  targetCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: ChromaKeySettings,
  cachedRawData?: ImageData | null,
  userAlphaOverride?: Int16Array | null
): void {
  // Ưu tiên dùng cached raw data (đã decode 1 lần) thay vì getImageData lại ảnh 4K/8K
  let imgData: ImageData
  if (cachedRawData && cachedRawData.width === width && cachedRawData.height === height) {
    imgData = new ImageData(new Uint8ClampedArray(cachedRawData.data), width, height)
  } else {
    imgData = sourceCtx.getImageData(0, 0, width, height)
  }

  if (!settings.enabled || settings.previewMode === 'original') {
    targetCtx.putImageData(imgData, 0, 0)
    return
  }

  processAdvancedChromaPixelData(imgData.data, width, height, settings)

  // Áp dụng các thao tác thủ công (Cọ tẩy/Khôi phục) lên trên kết quả tách nền
  if (userAlphaOverride) {
    const data = imgData.data
    const total = width * height
    for (let p = 0; p < total; p++) {
      const override = userAlphaOverride[p]
      if (override >= 0) {
        data[p * 4 + 3] = Math.max(0, Math.min(255, override))
      }
    }
  }

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
 * Quét nhanh các đảo pixel thô bằng hàng đợi Int32Array tĩnh (không cấp phát mảng con),
 * hỗ trợ quy đổi hệ số tỷ lệ `coordScale` khi quét trên canvas proxy của ảnh 4K/8K.
 */
export function scanRawIslandsFromData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  coordScale = 1
): DetectedIsland[] {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  const rawIslands: DetectedIsland[] = []
  const step = 2
  const outputScale = coordScale > 0 ? coordScale : 1
  const areaScale = outputScale * outputScale

  for (let sy = 0; sy < height; sy += step) {
    const rowOff = sy * width
    for (let sx = 0; sx < width; sx += step) {
      const idx = rowOff + sx
      if (visited[idx] || data[idx * 4 + 3] < 12) continue

      let minX = sx
      let maxX = sx
      let minY = sy
      let maxY = sy
      let head = 0
      let tail = 0
      queue[tail++] = idx
      visited[idx] = 1

      while (head < tail) {
        const curr = queue[head++]
        const cx = curr % width
        const cy = (curr - cx) / width

        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy

        if (cy > 0) {
          const n = curr - width
          if (!visited[n] && data[n * 4 + 3] >= 12) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cy < height - 1) {
          const n = curr + width
          if (!visited[n] && data[n * 4 + 3] >= 12) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cx > 0) {
          const n = curr - 1
          if (!visited[n] && data[n * 4 + 3] >= 12) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
        if (cx < width - 1) {
          const n = curr + 1
          if (!visited[n] && data[n * 4 + 3] >= 12) {
            visited[n] = 1
            queue[tail++] = n
          }
        }
      }

      const area = tail
      const w = maxX - minX + 1
      const h = maxY - minY + 1
      if (area >= 12 && w >= 3 && h >= 3) {
        const padMinX = Math.max(0, minX - 2)
        const padMinY = Math.max(0, minY - 2)
        const padMaxX = Math.min(width - 1, maxX + 2)
        const padMaxY = Math.min(height - 1, maxY + 2)

        const rx = Math.round(padMinX * outputScale)
        const ry = Math.round(padMinY * outputScale)
        const rw = Math.max(4, Math.round((padMaxX - padMinX + 1) * outputScale))
        const rh = Math.max(4, Math.round((padMaxY - padMinY + 1) * outputScale))

        rawIslands.push({
          id: `raw-${rawIslands.length + 1}`,
          x: rx,
          y: ry,
          width: rw,
          height: rh,
          area: Math.round(area * areaScale)
        })
      }
    }
  }

  return rawIslands
}

/**
 * Gom cụm và lọc danh sách mảnh từ `rawIslands` trong < 0.1ms (không cần quét lại pixel khi kéo thanh trượt Lọc vụn / Gom nét).
 */
export function clusterAndFilterIslands(
  rawIslands: DetectedIsland[],
  naturalWidth: number,
  naturalHeight: number,
  minArea = 100,
  mergeGap = 18
): DetectedIsland[] {
  const islands: DetectedIsland[] = rawIslands.map((isl) => ({ ...isl }))

  if (mergeGap > 0) {
    const maxClusterW = Math.max(80, naturalWidth * 0.23)
    const maxClusterH = Math.max(60, naturalHeight * 0.16)
    const scaleFactor = Math.max(1, Math.max(naturalWidth, naturalHeight) / 960)
    const effGapX = Math.round(mergeGap * scaleFactor)
    const effGapY = Math.round(Math.max(2, mergeGap - 2) * scaleFactor)

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
          if (gapX <= effGapX && gapY <= effGapY) {
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
  }

  const sizeFiltered = islands.filter(
    (isl) => isl.area >= minArea && isl.width >= 12 && isl.height >= 12
  )

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

  const rowStep = Math.max(48, Math.round(naturalHeight * 0.06))
  filtered.sort((a, b) => {
    const rowA = Math.floor(a.y / rowStep)
    const rowB = Math.floor(b.y / rowStep)
    if (rowA !== rowB) return rowA - rowB
    return a.x - b.x
  })

  return filtered.map((isl, idx) => ({
    ...isl,
    id: `island-${idx + 1}`,
    label: `Mảnh #${idx + 1} (${isl.width}×${isl.height})`
  }))
}

/**
 * Tự động phát hiện các đảo pixel không trong suốt (Connected Components / Slices)
 */
export function detectOpaqueIslands(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  minArea = 100,
  mergeGap = 18
): DetectedIsland[] {
  const imgData = ctx.getImageData(0, 0, width, height)
  const raw = scanRawIslandsFromData(imgData.data, width, height, 1)
  return clusterAndFilterIslands(raw, width, height, minArea, mergeGap)
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
 * Khởi tạo phiên nét cọ nội suy liên tục (segment interpolation) mượt mà 60fps trên cả ảnh 4K/8K.
 * Chỉ đẩy vùng chữ nhật bẩn (dirty rect) lên GPU khi commit mỗi đoạn cọ.
 */
export function createCutterStroke(
  targetCtx: CanvasRenderingContext2D,
  rawCtx: CanvasRenderingContext2D | null,
  width: number,
  height: number,
  settings: CutterStrokeSettings,
  userAlphaOverride?: Int16Array | null,
  cachedRawData?: ImageData | null
): CutterStrokeSession {
  const targetImg = targetCtx.getImageData(0, 0, width, height)
  const tdata = targetImg.data
  const rdata =
    !settings.isEraser && cachedRawData?.width === width && cachedRawData.height === height
      ? cachedRawData.data
      : !settings.isEraser && rawCtx
        ? rawCtx.getImageData(0, 0, width, height).data
        : null

  // Uint8 đủ chính xác cho độ phủ cọ và dùng ít hơn 75% bộ nhớ so với Float32Array.
  const coverage = new Uint8Array(width * height)
  const initialAlpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) {
    initialAlpha[i] = tdata[i * 4 + 3]
  }

  const radius = Math.max(1, Math.round(settings.radius))
  const opacity = Math.max(0.05, Math.min(1, settings.opacity ?? 1))
  const hardness = Math.max(0, Math.min(1, settings.hardness ?? 0.85))
  const isEraser = settings.isEraser
  let changed = false

  let dirtyMinX = width
  let dirtyMinY = height
  let dirtyMaxX = -1
  let dirtyMaxY = -1

  function segment(from: { x: number; y: number }, to: { x: number; y: number }) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const lenSq = dx * dx + dy * dy

    const minX = Math.max(0, Math.floor(Math.min(from.x, to.x) - radius - 1))
    const maxX = Math.min(width - 1, Math.ceil(Math.max(from.x, to.x) + radius + 1))
    const minY = Math.max(0, Math.floor(Math.min(from.y, to.y) - radius - 1))
    const maxY = Math.min(height - 1, Math.ceil(Math.max(from.y, to.y) + radius + 1))

    const feather = Math.max(1 - hardness, 1 / radius)
    let segChanged = false

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5 - from.x
        const py = y + 0.5 - from.y
        const t = lenSq > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq)) : 0
        const dist = Math.hypot(px - dx * t, py - dy * t) / radius
        if (dist > 1) continue

        const fade = Math.max(0, Math.min(1, (1 - dist) / feather))
        const amount = fade * fade * (3 - 2 * fade)
        const i = y * width + x
        const amountByte = Math.round(amount * 255)
        if (amountByte <= coverage[i]) continue
        coverage[i] = amountByte

        const idx = i * 4
        if (isEraser) {
          const newAlpha = Math.round(initialAlpha[i] * (1 - opacity * amount))
          if (tdata[idx + 3] !== newAlpha) {
            tdata[idx + 3] = newAlpha
            if (userAlphaOverride) userAlphaOverride[i] = newAlpha
            changed = true
            segChanged = true
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
            if (userAlphaOverride) userAlphaOverride[i] = targetA
            changed = true
            segChanged = true
          }
        }
      }
    }

    if (segChanged) {
      if (minX < dirtyMinX) dirtyMinX = minX
      if (minY < dirtyMinY) dirtyMinY = minY
      if (maxX > dirtyMaxX) dirtyMaxX = maxX
      if (maxY > dirtyMaxY) dirtyMaxY = maxY
    }
  }

  function commit() {
    if (changed && dirtyMaxX >= dirtyMinX && dirtyMaxY >= dirtyMinY) {
      const dw = dirtyMaxX - dirtyMinX + 1
      const dh = dirtyMaxY - dirtyMinY + 1
      targetCtx.putImageData(targetImg, 0, 0, dirtyMinX, dirtyMinY, dw, dh)
      dirtyMinX = width
      dirtyMinY = height
      dirtyMaxX = -1
      dirtyMaxY = -1
    }
  }

  return {
    segment,
    commit,
    get changed() {
      return changed
    }
  }
}

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
 * Trích xuất ảnh PNG trong suốt từ vùng chọn (hỗ trợ đồng bộ giữa ảnh gốc 4K/8K và mặt nạ đã tách nền trên canvas làm việc)
 */
export function extractRegionDataUrl(
  sourceCanvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  polygon?: CutPoint[],
  fullRawCanvas?: HTMLCanvasElement | null,
  chromaSettings?: ChromaKeySettings
): string {
  const w = Math.max(1, Math.round(box.width))
  const h = Math.max(1, Math.round(box.height))

  const temp = document.createElement('canvas')
  temp.width = w
  temp.height = h
  const tctx = temp.getContext('2d', { willReadFrequently: true })
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

  // Nếu có fullRawCanvas độ phân giải lớn (4K/8K) khác kích thước với sourceCanvas proxy:
  if (
    fullRawCanvas &&
    fullRawCanvas.width > 0 &&
    (fullRawCanvas.width !== sourceCanvas.width || fullRawCanvas.height !== sourceCanvas.height)
  ) {
    const maxExportDim = 1600
    const exportScale = Math.min(1, maxExportDim / Math.max(w, h))
    const ew = Math.max(1, Math.round(w * exportScale))
    const eh = Math.max(1, Math.round(h * exportScale))
    temp.width = ew
    temp.height = eh

    if (polygon && polygon.length >= 3) {
      tctx.beginPath()
      tctx.moveTo((polygon[0].x - box.x) * exportScale, (polygon[0].y - box.y) * exportScale)
      for (let i = 1; i < polygon.length; i++) {
        tctx.lineTo((polygon[i].x - box.x) * exportScale, (polygon[i].y - box.y) * exportScale)
      }
      tctx.closePath()
      tctx.clip()
    }

    tctx.imageSmoothingEnabled = true
    tctx.imageSmoothingQuality = 'high'

    if (chromaSettings && chromaSettings.enabled && chromaSettings.previewMode !== 'original') {
      // Lấy chi tiết sắc nét trực tiếp từ ảnh gốc 4K/8K trên đúng vùng mảnh cắt
      tctx.drawImage(fullRawCanvas, box.x, box.y, w, h, 0, 0, ew, eh)
      const hiData = tctx.getImageData(0, 0, ew, eh)
      processAdvancedChromaPixelData(hiData.data, ew, eh, chromaSettings)

      // Đồng bộ mặt nạ alpha từ sourceCanvas (bao gồm các nét Cọ tẩy / Đũa thần thủ công)
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = ew
      maskCanvas.height = eh
      const mctx = maskCanvas.getContext('2d')
      if (mctx) {
        const scaleX = sourceCanvas.width / fullRawCanvas.width
        const scaleY = sourceCanvas.height / fullRawCanvas.height
        mctx.drawImage(
          sourceCanvas,
          box.x * scaleX,
          box.y * scaleY,
          w * scaleX,
          h * scaleY,
          0,
          0,
          ew,
          eh
        )
        const maskData = mctx.getImageData(0, 0, ew, eh).data
        const hpx = hiData.data
        for (let i = 3; i < hpx.length; i += 4) {
          const mAlpha = maskData[i]
          if (mAlpha < hpx[i]) {
            hpx[i] = mAlpha
          } else if (mAlpha > 240 && hpx[i] < 200) {
            // Giữ nguyên các vùng ruột được bảo vệ (flood_fill) hoặc do người dùng dùng Cọ khôi phục
            hpx[i] = mAlpha
          }
        }
      }
      tctx.putImageData(hiData, 0, 0)
      return temp.toDataURL('image/png')
    }

    const scaleX = sourceCanvas.width / fullRawCanvas.width
    const scaleY = sourceCanvas.height / fullRawCanvas.height
    tctx.drawImage(
      sourceCanvas,
      box.x * scaleX,
      box.y * scaleY,
      w * scaleX,
      h * scaleY,
      0,
      0,
      ew,
      eh
    )
    return temp.toDataURL('image/png')
  }

  tctx.drawImage(sourceCanvas, box.x, box.y, w, h, 0, 0, w, h)
  return temp.toDataURL('image/png')
}
