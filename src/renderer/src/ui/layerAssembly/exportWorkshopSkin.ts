import type { ImageLayer } from '@shared/types'
import type { AssembledLayerItem, LayerComposite } from './types'
import { createLayerAlphaTrimmedGeometry } from './layerAssemblyAlphaMesh'

/** Store rest topology, not per-frame vertices: saved projects evaluate the exact same skin. */
export async function exportWorkshopSkin(layer: ImageLayer, item: AssembledLayerItem,
  composite: LayerComposite, url: string | undefined): Promise<void> {
  if (item.bindingMode !== 'soft' || !item.boneId || !composite.rig) return
  if (!url) throw new Error(`Không đọc được ảnh để tạo mesh: ${item.name}`)
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`Không tải được ảnh mesh: ${item.name}`))
    image.src = url
  })
  const factor = Math.min(1, 380 / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.round(image.naturalWidth * factor), height = Math.round(image.naturalHeight * factor)
  const geometry = createLayerAlphaTrimmedGeometry(width, height, image)
  const { boneId, x, y, rotation, scale, scaleX, scaleY } = item
  layer.mesh = {
    version: 1, id: `${layer.id}-skin`, name: item.name,
    surface: { width, height, subdivisions: [16, 20], restUVBounds: [0, 0, 1, 1] },
    anchorUV: [0.5, 0.5], modifiers: [], materials: {},
    skin: {
      rig: structuredClone(composite.rig), binding: { boneId, x, y, rotation, scale, scaleX, scaleY },
      positions: Array.from(geometry.getAttribute('position').array),
      uvs: Array.from(geometry.getAttribute('uv').array),
      indices: Array.from(geometry.getIndex()!.array)
    }
  }
  layer.props.width = width; layer.props.height = height
  geometry.dispose()
}
