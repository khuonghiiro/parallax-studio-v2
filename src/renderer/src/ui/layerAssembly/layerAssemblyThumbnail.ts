import type { LayerComposite, AssembledLayerItem } from './types'
import { resolveLayerImageUrlAsync } from './useLayerAssetImage'

/**
 * Tải ảnh vào đối tượng HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Vẽ một layer lên 2D thumbnail context
 */
function drawLayerToContext(
  ctx: CanvasRenderingContext2D,
  layer: AssembledLayerItem,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  scaleFactor: number
): void {
  const nw = img.naturalWidth || 100
  const nh = img.naturalHeight || 100
  const maxDim = 380
  const imgScale = Math.min(1, maxDim / Math.max(nw, nh))

  const drawW = nw * imgScale * layer.scale * scaleFactor
  const drawH = nh * imgScale * layer.scale * scaleFactor

  const layerX = cx + layer.x * scaleFactor
  const layerY = cy + layer.y * scaleFactor

  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity))
  ctx.translate(layerX, layerY)

  // Điểm neo và xoay
  if (layer.rotation) {
    ctx.rotate((layer.rotation * Math.PI) / 180)
  }

  // Đổ bóng nhẹ drop shadow tự nhiên
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 6 * scaleFactor
  ctx.shadowOffsetY = 3 * scaleFactor

  // Tâm của layer là giữa ảnh
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
  ctx.restore()
}

/**
 * Tự động kết xuất ảnh xem trước 2D (Thumbnail 2D Preview) cho cụm layer composite
 * Cho ra hình ảnh sạch đẹp trên nền trong suốt, hiển thị trên card tab "Lắp ráp".
 */
export async function captureCompositeThumbnail(
  composite: LayerComposite,
  size = 280
): Promise<string> {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Nền trong suốt hoặc nền nhẹ
  ctx.clearRect(0, 0, size, size)

  const compW = composite.width || 550
  const compH = composite.height || 600
  const padding = 24
  const scaleFactor = Math.min((size - padding) / compW, (size - padding) / compH)

  const cx = size / 2
  const cy = size / 2

  // Sắp xếp các layer: Z càng lớn ở sau (vẽ trước), Z càng nhỏ ở trước (vẽ sau)
  const sortedLayers = [...composite.layers]
    .filter((l) => !l.hidden)
    .sort((a, b) => b.z - a.z)

  for (const layer of sortedLayers) {
    try {
      const url = await resolveLayerImageUrlAsync(layer.assetPath, layer.imageUrl)
      if (!url) continue
      const img = await loadImage(url)
      drawLayerToContext(ctx, layer, img, cx, cy, scaleFactor)
    } catch (err) {
      console.warn('[captureCompositeThumbnail] Failed to draw layer:', layer.name, err)
    }
  }

  return canvas.toDataURL('image/png')
}
