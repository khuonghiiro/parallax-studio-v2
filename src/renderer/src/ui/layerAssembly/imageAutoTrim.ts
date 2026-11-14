/**
 * Tự động cắt khoảng trống trong suốt thừa (Auto-Trim Transparency) của ảnh layer:
 * - Quét các pixel đục (alpha > alphaThreshold) để tìm Bounding Box thực tế của nhân vật/chi tiết.
 * - Cắt bỏ viền trong suốt thừa xung quanh, giữ lại nội dung chính xác.
 * - Tính toán độ lệch tâm (offsetX, offsetY) để giữ nguyên vị trí trực quan của nhân vật trên sân khấu.
 */

export interface TrimResult {
  trimmed: boolean
  dataUrl?: string
  width: number
  height: number
  offsetX: number
  offsetY: number
  originalWidth: number
  originalHeight: number
  cropRect?: { x: number; y: number; width: number; height: number }
}

export interface TrimOptions {
  /** Ngưỡng alpha (0..255) để coi là pixel có nội dung. Mặc định 10. */
  alphaThreshold?: number
  /** Khoảng đệm an toàn (pixels) giữ lại xung quanh viền nội dung. Mặc định 4. */
  padding?: number
  /** Lề thừa tối thiểu (pixels) ở ít nhất 1 phía để kích hoạt cắt. Mặc định 16. */
  minTrimMargin?: number
}

import { wasmFindOpaqueBbox } from '../../engine/wasmAccel'

export interface BoundingBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  found: boolean
}

export function findOpaqueBoundingBoxJs(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 10
): BoundingBox {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3]
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const found = maxX >= minX && maxY >= minY
  return { minX: found ? minX : 0, minY: found ? minY : 0, maxX: found ? maxX : -1, maxY: found ? maxY : -1, found }
}

/**
 * Tìm bounding box của các pixel đục trong mảng RGBA (4 bytes / pixel).
 */
export function findOpaqueBoundingBox(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  alphaThreshold = 10
): BoundingBox {
  const wasmBox = wasmFindOpaqueBbox(data, width, height, alphaThreshold, false)
  if (wasmBox) return wasmBox
  return findOpaqueBoundingBoxJs(data, width, height, alphaThreshold)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (src.startsWith('http')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => {
      const fallback = new Image()
      fallback.onload = () => resolve(fallback)
      fallback.onerror = reject
      fallback.src = src
    }
    img.src = src
  })
}

/**
 * Phân tích và cắt bỏ viền trong suốt thừa của ảnh từ dataUrl hoặc URL.
 */
export async function trimImageTransparency(
  imageSource: string | HTMLImageElement,
  options?: TrimOptions
): Promise<TrimResult> {
  const alphaThreshold = options?.alphaThreshold ?? 10
  const padding = options?.padding ?? 4
  const minTrimMargin = options?.minTrimMargin ?? 16

  if (typeof document === 'undefined') {
    return { trimmed: false, width: 0, height: 0, offsetX: 0, offsetY: 0, originalWidth: 0, originalHeight: 0 }
  }

  let img: HTMLImageElement
  if (typeof imageSource === 'string') {
    try {
      img = await loadImage(imageSource)
    } catch (err) {
      console.warn('[imageAutoTrim] Không tải được ảnh để phân tích viền trong suốt:', err)
      return { trimmed: false, width: 0, height: 0, offsetX: 0, offsetY: 0, originalWidth: 0, originalHeight: 0 }
    }
  } else {
    img = imageSource
  }

  const origW = img.naturalWidth || img.width
  const origH = img.naturalHeight || img.height

  if (!origW || !origH || origW < 4 || origH < 4) {
    return { trimmed: false, width: origW, height: origH, offsetX: 0, offsetY: 0, originalWidth: origW, originalHeight: origH }
  }

  // Quét tìm vùng đục (Bounding Box) trên bộ đệm thu nhỏ <= 512px để không đọc 67MB RGBA trên ảnh 4K
  const maxScanDim = 512
  const scanScale = Math.min(1, maxScanDim / Math.max(origW, origH))
  const scanW = Math.max(1, Math.round(origW * scanScale))
  const scanH = Math.max(1, Math.round(origH * scanScale))

  const canvas = document.createElement('canvas')
  canvas.width = scanW
  canvas.height = scanH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    return { trimmed: false, width: origW, height: origH, offsetX: 0, offsetY: 0, originalWidth: origW, originalHeight: origH }
  }

  ctx.drawImage(img, 0, 0, scanW, scanH)
  let imgData: ImageData
  try {
    imgData = ctx.getImageData(0, 0, scanW, scanH)
  } catch (err) {
    console.warn('[imageAutoTrim] Canvas bị bảo mật (tainted), không đọc được pixel:', err)
    return { trimmed: false, width: origW, height: origH, offsetX: 0, offsetY: 0, originalWidth: origW, originalHeight: origH }
  }

  const rawBbox = findOpaqueBoundingBox(imgData.data, scanW, scanH, alphaThreshold)
  if (!rawBbox.found) {
    return { trimmed: false, width: origW, height: origH, offsetX: 0, offsetY: 0, originalWidth: origW, originalHeight: origH }
  }

  const invScale = scanScale < 1 ? 1 / scanScale : 1
  const scaleMargin = scanScale < 1 ? Math.ceil(invScale) : 0
  const minX = Math.max(0, Math.floor(rawBbox.minX * invScale) - scaleMargin)
  const minY = Math.max(0, Math.floor(rawBbox.minY * invScale) - scaleMargin)
  const maxX = Math.min(origW - 1, Math.ceil((rawBbox.maxX + 1) * invScale - 1) + scaleMargin)
  const maxY = Math.min(origH - 1, Math.ceil((rawBbox.maxY + 1) * invScale - 1) + scaleMargin)
  const topTrim = minY
  const bottomTrim = origH - 1 - maxY
  const leftTrim = minX
  const rightTrim = origW - 1 - maxX

  // Chỉ cắt khi lề thừa đủ lớn (tránh cắt vụn vặt 1-2px không cần thiết)
  const maxMargin = Math.max(topTrim, bottomTrim, leftTrim, rightTrim)
  const totalMargin = topTrim + bottomTrim + leftTrim + rightTrim
  if (maxMargin < minTrimMargin && totalMargin < minTrimMargin * 1.5) {
    return { trimmed: false, width: origW, height: origH, offsetX: 0, offsetY: 0, originalWidth: origW, originalHeight: origH }
  }

  // Thêm padding an toàn
  const cropX = Math.max(0, minX - padding)
  const cropY = Math.max(0, minY - padding)
  const cropW = Math.min(origW - cropX, maxX - minX + 1 + padding * 2)
  const cropH = Math.min(origH - cropY, maxY - minY + 1 + padding * 2)

  // Canvas cắt trực tiếp từ ảnh gốc `img`
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = cropW
  cropCanvas.height = cropH
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) {
    return { trimmed: false, width: origW, height: origH, offsetX: 0, offsetY: 0, originalWidth: origW, originalHeight: origH }
  }

  cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  const trimmedUrl = cropCanvas.toDataURL('image/png')

  // Độ lệch tâm giữa ảnh gốc và ảnh đã cắt (để layer không bị giật vị trí trực quan)
  const origCenterX = origW / 2
  const origCenterY = origH / 2
  const cropCenterX = cropX + cropW / 2
  const cropCenterY = cropY + cropH / 2
  const offsetX = Math.round(cropCenterX - origCenterX)
  const offsetY = Math.round(cropCenterY - origCenterY)

  return {
    trimmed: true,
    dataUrl: trimmedUrl,
    width: cropW,
    height: cropH,
    offsetX,
    offsetY,
    originalWidth: origW,
    originalHeight: origH,
    cropRect: { x: cropX, y: cropY, width: cropW, height: cropH }
  }
}
