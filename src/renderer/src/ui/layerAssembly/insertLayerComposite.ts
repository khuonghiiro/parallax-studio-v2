import { nanoid } from 'nanoid'
import type { LayerComposite, AssembledLayerItem } from './types'
import { useEditor } from '../../store/editor'
import { assetStore } from '../../project/assets'
import { createImageLayer } from '../../project/factory'
import type { AssetMeta, ImageLayer } from '@shared/types'

export interface InsertCompositeOptions {
  composite: LayerComposite
  targetShotId?: string | null
  positionOffset?: [number, number, number]
  globalScale?: number
}

/**
 * Chèn một cụm layer (đã lắp ráp và xếp chồng) vào cảnh hiện tại của dự án.
 */
export async function insertLayerCompositeToScene({
  composite,
  targetShotId,
  positionOffset = [0, 0, 0],
  globalScale = 1.0
}: InsertCompositeOptions): Promise<string[]> {
  const state = useEditor.getState()
  const shotId = targetShotId ?? state.selectedShotId ?? state.project.shots[0]?.id ?? null
  if (!shotId) return []

  const shot = state.project.shots.find((s) => s.id === shotId)
  if (!shot) return []

  const comp = state.project.comp
  const createdLayerIds: string[] = []
  const layersToAdd: ImageLayer[] = []
  const projectAssets = state.project.assets

  // Duyệt qua các layer theo thứ tự từ sau ra trước (hoặc ngược lại)
  for (const item of composite.layers) {
    if (item.hidden) continue

    // Tìm asset trong project nếu có
    let asset: AssetMeta | undefined = projectAssets.find(
      (a) => (item.assetPath && a.path?.endsWith(item.assetPath)) || a.id === item.assetPath
    )

    const targetAsset: AssetMeta = asset || {
      id: item.assetPath || `asset-auto-${nanoid(6)}`,
      name: item.name,
      kind: 'image',
      mime: 'image/png',
      width: composite.width,
      height: composite.height
    }

    const layerName = `[${composite.name}] ${item.name}`
    const posX = item.x * globalScale + positionOffset[0]
    const posY = -item.y * globalScale + positionOffset[1]
    const posZ = item.z * globalScale + positionOffset[2]

    const newLayer = createImageLayer(targetAsset, comp, posZ)
    newLayer.id = 'layer-' + nanoid(8)
    newLayer.name = layerName
    newLayer.shotId = shotId
    newLayer.transform.position.value = [posX, posY, posZ]
    newLayer.transform.scale.value = [item.scale * globalScale, item.scale * globalScale, 1]
    newLayer.transform.rotation.value = [0, 0, item.rotation]
    newLayer.transform.opacity.value = item.opacity

    // Gắn thông số hoạt ảnh lắc lư/đung đưa (motion) chuẩn 2.5D
    if (item.motion && item.motion.type !== 'none') {
      const motionType =
        item.motion.type === 'sway'
          ? 'sway'
          : item.motion.type === 'breathe'
            ? 'pulse'
            : item.motion.type === 'float'
              ? 'float'
              : 'wiggle'

      newLayer.motion = {
        type: motionType,
        speed: item.motion.speed,
        amplitude: [item.motion.amplitude, item.motion.amplitude, 0],
        phase: item.motion.phaseOffset ?? 0
      }
    }

    layersToAdd.push(newLayer)
    createdLayerIds.push(newLayer.id)
  }

  if (layersToAdd.length > 0) {
    useEditor.getState().update((p) => {
      p.layers.push(...layersToAdd)
    }, `Thêm cụm layer: ${composite.name}`)
  }

  return createdLayerIds
}
