import type { ImageLayer } from '@shared/types'
import type { AssembledLayerItem, LayerComposite } from './types'
import { createLayerAlphaTrimmedGeometry } from './layerAssemblyAlphaMesh'
import { spinesForLayer } from '../../engine/plantSpine'

/** Store rest topology, not per-frame vertices: saved projects evaluate the exact same skin. */
export async function exportWorkshopSkin(layer: ImageLayer, item: AssembledLayerItem,
  composite: LayerComposite, url: string | undefined): Promise<void> {
  const skinned = item.bindingMode === 'soft' && Boolean(item.boneId) && Boolean(composite.rig)
  const spines = spinesForLayer(composite.plantSpines, item.id)
  if (!skinned && !spines.length) return
  let loadedImage: HTMLImageElement | null = null
  if (url) {
    try {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error(`Không tải được ảnh mesh: ${item.name}`))
        image.src = url
      })
      loadedImage = image
    } catch {
      loadedImage = null
    }
  }
  const width = loadedImage?.naturalWidth || layer.props.width || composite.width || 400
  const height = loadedImage?.naturalHeight || layer.props.height || composite.height || 400
  const geometry = createLayerAlphaTrimmedGeometry(width, height, loadedImage)
  const { boneId, x, y, rotation, scale, scaleX, scaleY } = item
  layer.mesh = {
    version: 1, id: `${layer.id}-skin`, name: item.name,
    surface: { width, height, subdivisions: [16, 20], restUVBounds: [0, 0, 1, 1] },
    anchorUV: [0.5, 0.5], modifiers: [], materials: {},
    skin: {
      rig: skinned ? structuredClone(composite.rig!) : { bones: [], duration: 0, loop: true, tracks: {} },
      binding: { boneId: skinned ? boneId : undefined, x, y, rotation, scale, scaleX, scaleY },
      ...(spines.length ? { plantSpines: structuredClone(spines) } : {}),
      positions: Array.from(geometry.getAttribute('position').array),
      uvs: Array.from(geometry.getAttribute('uv').array),
      indices: Array.from(geometry.getIndex()!.array)
    }
  }
  layer.props.width = width; layer.props.height = height
  geometry.dispose()
}
