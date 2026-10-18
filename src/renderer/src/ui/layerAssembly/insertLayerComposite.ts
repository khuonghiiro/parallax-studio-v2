import { nanoid } from 'nanoid'
import type { LayerComposite, AssembledLayerItem } from './types'
import { useEditor } from '../../store/editor'
import { assetStore } from '../../project/assets'
import { createImageLayer } from '../../project/factory'
import type { AssetMeta, Composition, ImageLayer, LayerMotion } from '@shared/types'
import { toast } from '../../actions'
import { exportWorkshopSkin } from './exportWorkshopSkin'
import { bakeWorkshopRig } from './bakeWorkshopRig'
import { validateRig } from './workshopRig'
import { resolveCompositeItemAsset } from './compositeAssetLoader'

export interface InsertCompositeOptions {
  composite: LayerComposite
  targetShotId?: string | null
  positionOffset?: [number, number, number]
  globalScale?: number
}

/** Quy đổi chuyển động lắc lư của Xưởng sang motion 2.5D của cảnh. */
export function toSceneMotion(item: AssembledLayerItem): LayerMotion | undefined {
  if (!item.motion || item.motion.type === 'none') return undefined
  const map: Record<string, LayerMotion['type']> = { sway: 'sway', breathe: 'pulse', float: 'float' }
  return {
    type: map[item.motion.type] ?? 'wiggle',
    speed: item.motion.speed,
    amplitude: [item.motion.amplitude, item.motion.amplitude, 0],
    phase: item.motion.phaseOffset ?? 0
  }
}

interface BuildLayerArgs {
  item: AssembledLayerItem
  asset: AssetMeta
  composite: LayerComposite
  comp: Composition
  shotId: string
  instanceId: string
  isRoot: boolean
  globalScale: number
  positionOffset: [number, number, number]
}

/** Tạo ImageLayer của cảnh từ 1 layer trong mẫu (vị trí, tỉ lệ, góc, liên kết cụm & thông tin bộ phận). */
function buildSceneLayer({ item, asset, composite, comp, shotId, instanceId, isRoot, globalScale, positionOffset }: BuildLayerArgs): ImageLayer {
  const pos: [number, number, number] = [
    item.x * globalScale + positionOffset[0],
    -item.y * globalScale + positionOffset[1],
    item.z * globalScale + positionOffset[2]
  ]
  const layer = createImageLayer(asset, comp, pos[2])
  layer.id = 'layer-' + nanoid(8)
  layer.name = `[${composite.name}] ${item.name}`
  layer.shotId = shotId
  layer.autoScale = false
  if (asset.width && asset.height) {
    layer.props.width = asset.width
    layer.props.height = asset.height
  }
  layer.transform.position.value = pos
  layer.transform.scale.value = [item.scale * (item.scaleX ?? 1) * globalScale, item.scale * (item.scaleY ?? 1) * globalScale, 1]
  layer.transform.rotation.value = [item.rotationX || 0, item.rotationY || 0, item.rotation || 0]
  layer.transform.opacity.value = item.opacity
  // Liên kết cụm (khoá cụm, di chuyển đồng bộ) + thông tin bộ phận để đổi biểu cảm / bộ phận nhanh trong cảnh
  layer.composite = {
    instanceId,
    compositeId: composite.id,
    compositeName: composite.name,
    isRoot,
    lockedGroup: true,
    centerPosition: [...positionOffset],
    rootOffset: [item.x * globalScale, -item.y * globalScale, item.z * globalScale],
    sourceLayerId: item.id,
    ...(item.slot ? { slot: item.slot, variant: item.variant } : {}),
    ...(item.partGroupId ? { partGroupId: item.partGroupId } : {})
  }
  const motion = toSceneMotion(item)
  if (motion) layer.motion = motion
  return layer
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
  if (!shotId || !state.project.shots.some((s) => s.id === shotId)) return []

  const comp = state.project.comp
  const projectAssets = state.project.assets
  const layersToAdd: ImageLayer[] = []
  const newAssets: AssetMeta[] = []
  const instanceId = 'comp-inst-' + nanoid(8)
  const activeItems = composite.layers.filter((item) => !item.hidden)

  for (let idx = 0; idx < activeItems.length; idx++) {
    const item = activeItems[idx]
    const { asset, isNew } = await resolveCompositeItemAsset(item, composite, [...projectAssets, ...newAssets])
    if (isNew && !newAssets.some((a) => a.id === asset.id)) newAssets.push(asset)
    const layer = buildSceneLayer({ item, asset, composite, comp, shotId, instanceId, isRoot: idx === 0, globalScale, positionOffset })
    await exportWorkshopSkin(layer, item, composite, assetStore.get(asset.id)?.url ?? item.imageUrl)
    bakeWorkshopRig(layer, item, composite, comp.duration, comp.fps, globalScale, positionOffset)
    layersToAdd.push(layer)
  }

  if (layersToAdd.length > 0) {
    useEditor.getState().update((p) => {
      if (newAssets.length > 0) p.assets.push(...newAssets.filter((a) => !p.assets.some((x) => x.id === a.id)))
      // Chèn layer lên trên cùng của shot hiện tại để hiển thị ngay trước mắt người xem
      const firstShotIdx = p.layers.findIndex((l) => l.shotId === shotId)
      if (firstShotIdx < 0) p.layers.unshift(...layersToAdd)
      else p.layers.splice(firstShotIdx, 0, ...layersToAdd)
    }, `Thêm cụm layer: ${composite.name}`)
    useEditor.getState().selectLayer(layersToAdd[0].id)
    toast(`Đã thêm cụm layer "${composite.name}" vào cảnh`)
  }
  return layersToAdd.map((l) => l.id)
}
