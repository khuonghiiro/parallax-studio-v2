import type { AssembledLayerItem } from './types'
import { resolveLayerImageUrlAsync } from './useLayerAssetImage'

/** Giới hạn kích thước tối đa của Canvas cọ tẩy để thao tác vẽ/xóa thời gian thực trên ảnh 4K luôn đạt 60fps */
const MAX_BRUSH_CANVAS_DIM = 2048

export async function loadBrushCanvas(layer: AssembledLayerItem): Promise<HTMLCanvasElement> {
  const url = await resolveLayerImageUrlAsync(layer.assetPath, layer.imageUrl)
  if (!url) throw new Error('Không tìm thấy ảnh để tẩy.')
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Không tải được ảnh để tẩy.'))
    img.src = url
  })
  const rawW = image.naturalWidth || image.width || 512
  const rawH = image.naturalHeight || image.height || 512
  const scale = Math.min(1, MAX_BRUSH_CANVAS_DIM / Math.max(1, rawW, rawH))
  const w = Math.max(1, Math.round(rawW * scale))
  const h = Math.max(1, Math.round(rawH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Không tạo được canvas cọ tẩy.')
  ctx.drawImage(image, 0, 0, w, h)
  return canvas
}
