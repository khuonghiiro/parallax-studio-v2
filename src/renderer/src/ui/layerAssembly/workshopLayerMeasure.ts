import type { AssembledLayerItem } from './types'
import type { LayerPixelSize } from './creatures/creatureRigTypes'

/**
 * Đo kích thước ảnh thật (px, chưa nhân scale) của từng layer đang hiển thị trên sân khấu 2D của Xưởng.
 * Hộp `[data-layer-id]` bọc ảnh là inline-block nên offsetWidth/offsetHeight = kích thước tự nhiên của ảnh
 * (không bị ảnh hưởng bởi transform zoom/xoay). Trả về {} khi không có DOM (unit test / MCP chạy nền).
 */
export function measureWorkshopLayerSizes(layers: AssembledLayerItem[]): Record<string, LayerPixelSize> {
  if (typeof document === 'undefined') return {}
  const out: Record<string, LayerPixelSize> = {}
  for (const layer of layers) {
    const candidates = document.querySelectorAll<HTMLElement>(`[data-layer-id="${cssEscape(layer.id)}"]`)
    for (const el of Array.from(candidates)) {
      const media = el.querySelector<HTMLImageElement | HTMLCanvasElement>('img, canvas')
      if (!media) continue
      const w = el.offsetWidth || (media as HTMLImageElement).naturalWidth || media.width
      const h = el.offsetHeight || (media as HTMLImageElement).naturalHeight || media.height
      if (w > 1 && h > 1) {
        out[layer.id] = { w, h }
        break
      }
    }
  }
  return out
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
