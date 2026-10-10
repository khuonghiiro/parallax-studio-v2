import type { AssembledLayerItem } from './types'
import { resolveLayerImageUrlAsync } from './useLayerAssetImage'

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
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Không tạo được canvas cọ tẩy.')
  ctx.drawImage(image, 0, 0)
  return canvas
}
