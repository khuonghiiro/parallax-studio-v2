import { nanoid } from 'nanoid'
import type { LayerComposite, AssembledLayerItem } from './types'
import { useEditor } from '../../store/editor'
import { assetStore } from '../../project/assets'
import { createImageLayer } from '../../project/factory'
import type { AssetMeta, ImageLayer } from '@shared/types'
import { resolveFaceTexture } from '../assets/models3d/textureResolver'
import { toast } from '../../actions'
import { bakeWorkshopRig } from './bakeWorkshopRig'
import { validateRig } from './workshopRig'

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
  validateRig(composite)
  const state = useEditor.getState()
  const shotId = targetShotId ?? state.selectedShotId ?? state.project.shots[0]?.id ?? null
  if (!shotId) return []

  const shot = state.project.shots.find((s) => s.id === shotId)
  if (!shot) return []

  const comp = state.project.comp
  const createdLayerIds: string[] = []
  const layersToAdd: ImageLayer[] = []
  const newAssetsToAdd: AssetMeta[] = []
  const projectAssets = state.project.assets

  const instanceId = 'comp-inst-' + nanoid(8)
  const activeItems = composite.layers.filter((item) => !item.hidden)

  // Duyệt qua các layer theo thứ tự
  for (let idx = 0; idx < activeItems.length; idx++) {
    const item = activeItems[idx]

    // 1. Tìm asset trong project nếu đã có
    let asset: AssetMeta | undefined = projectAssets.find(
      (a) =>
        (item.assetPath && (a.path?.endsWith(item.assetPath) || a.assetPath === item.assetPath)) ||
        a.id === item.assetPath
    )

    // Kiểm tra trong assetStore runtime
    if (!asset && item.assetPath) {
      const existingRt = assetStore.get(item.assetPath)
      if (existingRt) {
        asset = existingRt.meta
      }
    }

    // 2. Nếu chưa có trong assetStore hoặc projectAssets -> Nạp dữ liệu ảnh và đăng ký vào assetStore
    if (!asset) {
      try {
        let loadedData: Uint8Array | Blob | null = null
        let mime = 'image/png'

        // Nạp từ built-in assets hoặc asset-3ds
        if (item.assetPath) {
          if (window.api?.loadBuiltInAssetBytes) {
            try {
              const file =
                (await window.api.loadBuiltInAssetBytes(item.assetPath)) ||
                (await window.api.loadBuiltInAssetBytes(`assembly_3d/${item.assetPath.replace(/^assembly_3d[\\/]/, '')}`))
              if (file?.data && file.data.length > 0) {
                loadedData = file.data
                mime = file.mime || 'image/png'
              }
            } catch {}
          }
          if (!loadedData && window.api?.asset3ds?.loadBytes) {
            try {
              const cleanPath = item.assetPath.replace(/^asset-3ds[\\/]/, '')
              const file = await window.api.asset3ds.loadBytes(cleanPath)
              if (file?.data && file.data.length > 0) {
                loadedData = file.data
                mime = file.mime || 'image/png'
              }
            } catch {}
          }
          if (!loadedData) {
            const resolved = await resolveFaceTexture(item.assetPath)
            if (resolved?.url) {
              const res = await fetch(resolved.url)
              loadedData = await res.blob()
              mime = (loadedData as Blob).type || 'image/png'
            }
          }
        }

        // Nạp từ direct imageUrl nếu có
        if (!loadedData && item.imageUrl && (item.imageUrl.startsWith('data:') || item.imageUrl.startsWith('blob:') || item.imageUrl.startsWith('http'))) {
          const res = await fetch(item.imageUrl)
          loadedData = await res.blob()
          mime = (loadedData as Blob).type || 'image/png'
        }

        if (loadedData) {
          const fileName = (item.assetPath || item.name || 'layer').split('/').pop() || 'layer.png'
          const added = await assetStore.add(fileName, mime, loadedData, 'image')
          if (item.assetPath) {
            added.meta.assetPath = item.assetPath
            added.meta.path = item.assetPath
          }
          asset = added.meta
          if (!projectAssets.some((a) => a.id === asset!.id) && !newAssetsToAdd.some((a) => a.id === asset!.id)) {
            newAssetsToAdd.push(added.meta)
          }
        }
      } catch (err) {
        console.warn('[insertLayerCompositeToScene] Failed to load asset bytes for item:', item.name, err)
      }
    }

    const targetAsset: AssetMeta = asset || {
      id: item.assetPath || `asset-auto-${nanoid(6)}`,
      name: item.name,
      kind: 'image',
      mime: 'image/png',
      width: composite.width,
      height: composite.height
    }

    if (asset && !projectAssets.some((a) => a.id === asset!.id) && !newAssetsToAdd.some((a) => a.id === asset!.id)) {
      newAssetsToAdd.push(asset)
    }

    const layerName = `[${composite.name}] ${item.name}`
    const posX = item.x * globalScale + positionOffset[0]
    const posY = -item.y * globalScale + positionOffset[1]
    const posZ = item.z * globalScale + positionOffset[2]

    const newLayer = createImageLayer(targetAsset, comp, posZ)
    newLayer.id = 'layer-' + nanoid(8)
    newLayer.name = layerName
    newLayer.shotId = shotId
    newLayer.autoScale = false
    if (targetAsset.width && targetAsset.height) {
      newLayer.props.width = targetAsset.width
      newLayer.props.height = targetAsset.height
    }
    newLayer.transform.position.value = [posX, posY, posZ]
    newLayer.transform.scale.value = [item.scale * globalScale, item.scale * globalScale, 1]
    newLayer.transform.rotation.value = [item.rotationX || 0, item.rotationY || 0, item.rotation || 0]
    newLayer.transform.opacity.value = item.opacity

    // Gắn thông tin liên kết cụm composite (hỗ trợ khóa cụm, di chuyển đồng bộ, đổi layer con)
    newLayer.composite = {
      instanceId,
      compositeId: composite.id,
      compositeName: composite.name,
      isRoot: idx === 0,
      lockedGroup: true,
      centerPosition: [positionOffset[0], positionOffset[1], positionOffset[2]],
      rootOffset: [item.x * globalScale, -item.y * globalScale, item.z * globalScale]
    }

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

    bakeWorkshopRig(newLayer, item, composite, comp.duration, comp.fps, globalScale, positionOffset)
    layersToAdd.push(newLayer)
    createdLayerIds.push(newLayer.id)
  }

  if (layersToAdd.length > 0) {
    useEditor.getState().update((p) => {
      if (newAssetsToAdd.length > 0) {
        p.assets.push(...newAssetsToAdd)
      }
      // Chèn layer lên trên cùng của shot hiện tại để hiển thị ngay trước mắt người xem
      const firstShotIdx = p.layers.findIndex((l) => l.shotId === shotId)
      if (firstShotIdx < 0) {
        p.layers.unshift(...layersToAdd)
      } else {
        p.layers.splice(firstShotIdx, 0, ...layersToAdd)
      }
    }, `Thêm cụm layer: ${composite.name}`)

    useEditor.getState().selectLayer(createdLayerIds[0])
    toast(`Đã thêm cụm layer "${composite.name}" vào cảnh`)
  }

  return createdLayerIds
}
