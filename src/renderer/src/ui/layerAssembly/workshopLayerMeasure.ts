import type { AssembledLayerItem, LayerComposite } from './types'
import type { LayerPixelSize } from './creatures/creatureRigTypes'
import {
  computeMeshSyncedReplacement,
  measureUrlAlphaMeshBounds
} from '../../project/meshRatioSync'
import { resolveLayerImageUrlAsync } from './useLayerAssetImage'

/**
 * Đo kích thước ảnh thật (px, chưa nhân scale) của từng layer đang hiển thị trên sân khấu 2D của Xưởng.
 * Hộp `[data-layer-id]` bọc ảnh là inline-block nên offsetWidth/offsetHeight = kích thước mặt phẳng Mesh
 * (không bị ảnh hưởng bởi transform zoom/xoay). Trả về {} khi không có DOM (unit test / MCP chạy nền).
 */
export function measureWorkshopLayerSizes(layers: AssembledLayerItem[]): Record<string, LayerPixelSize> {
  const out: Record<string, LayerPixelSize> = {}
  for (const layer of layers) {
    if (layer.meshWidth && layer.meshHeight && layer.meshWidth > 1 && layer.meshHeight > 1) {
      out[layer.id] = { w: layer.meshWidth, h: layer.meshHeight }
      continue
    }
    if (typeof document === 'undefined') continue
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

/**
 * Đồng bộ kích thước mặt phẳng Mesh (`meshWidth × meshHeight`) và tâm đặt (`x, y`) theo tỉ lệ Alpha Mesh
 * khi thay thế ảnh bộ phận trong Xưởng Lắp Ráp 2.5D (ví dụ nâng cấp ảnh bộ phận lên 2K / 4K).
 */
export async function syncWorkshopLayerMeshOnReplace(
  composite: LayerComposite,
  targetLayerId: string,
  baseLayer: AssembledLayerItem,
  oldAssets?: LayerComposite['assets'],
  fallbackSize?: LayerPixelSize
): Promise<LayerComposite> {
  const target = composite.layers.find((l) => l.id === targetLayerId)
  if (!target) return composite

  const [oldUrl, newUrl] = await Promise.all([
    resolveLayerImageUrlAsync(baseLayer.asset || baseLayer.assetPath, baseLayer.imageUrl, oldAssets ?? composite.assets),
    resolveLayerImageUrlAsync(target.asset || target.assetPath, target.imageUrl, composite.assets)
  ])

  const [oldBounds, newBounds] = await Promise.all([
    measureUrlAlphaMeshBounds(oldUrl),
    measureUrlAlphaMeshBounds(newUrl)
  ])

  if (!newBounds) return composite

  const oldMeshW = baseLayer.meshWidth || fallbackSize?.w || oldBounds?.imgW || newBounds.imgW
  const oldMeshH = baseLayer.meshHeight || fallbackSize?.h || oldBounds?.imgH || newBounds.imgH

  const synced = computeMeshSyncedReplacement({
    oldMeshW,
    oldMeshH,
    oldBounds,
    newBounds,
    newImgW: newBounds.imgW,
    newImgH: newBounds.imgH,
    scaleX: (baseLayer.scale || 1) * (baseLayer.scaleX ?? 1),
    scaleY: (baseLayer.scale || 1) * (baseLayer.scaleY ?? 1),
    anchor: baseLayer.boneId ? 'center' : baseLayer.motion?.anchor ?? 'center',
    invertY: false
  })

  return {
    ...composite,
    layers: composite.layers.map((l) =>
      l.id === targetLayerId
        ? {
            ...l,
            meshWidth: synced.meshWidth,
            meshHeight: synced.meshHeight,
            meshBounds: newBounds,
            x: Math.round((baseLayer.x + synced.deltaX) * 100) / 100,
            y: Math.round((baseLayer.y + synced.deltaY) * 100) / 100
          }
        : l
    )
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
