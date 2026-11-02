import { nanoid } from 'nanoid'
import type { AssetMeta, Composition, ImageLayer, LayerMotion } from '@shared/types'
import { toast } from '../../actions'
import { assetStore } from '../../project/assets'
import { createImageLayer } from '../../project/factory'
import { useEditor } from '../../store/editor'
import { buildLoopAnimatedAsset } from '../loopAnimator/loopAnimationExporter'
import { bakeWorkshopRig } from './bakeWorkshopRig'
import { resolveCompositeItemAsset } from './compositeAssetLoader'
import { exportWorkshopSkin } from './exportWorkshopSkin'
import type { AssembledLayerItem, LayerComposite } from './types'
import { validateRig } from './workshopRig'

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

function isSwappableHiddenVariant(item: AssembledLayerItem): boolean {
  return Boolean(
    item.slot ||
      item.variant ||
      /biểu cảm|ẩn sẵn|mùa|variant|expr|cười|nháy|buồn|giận/i.test(item.name)
  )
}

/** Tạo ImageLayer của cảnh từ 1 layer trong mẫu (vị trí, tỉ lệ, góc, liên kết cụm & thông tin bộ phận). */
function buildSceneLayer({
  item,
  asset,
  composite,
  comp,
  shotId,
  instanceId,
  isRoot,
  globalScale,
  positionOffset
}: BuildLayerArgs): ImageLayer {
  const pos: [number, number, number] = [
    item.x * globalScale + positionOffset[0],
    -item.y * globalScale + positionOffset[1],
    item.z * globalScale + positionOffset[2]
  ]
  const layer = createImageLayer(asset, comp, pos[2])
  layer.id = 'layer-' + nanoid(8)
  layer.name = `[${composite.name}] ${item.name}`
  layer.shotId = shotId
  layer.visible = !item.hidden
  layer.autoScale = false
  if (asset.width && asset.height) {
    layer.props.width = asset.width
    layer.props.height = asset.height
  }
  if (item.loopConfig?.enabled) {
    layer.props.speed = item.loopConfig.speed ?? 1
    layer.props.loopMode = item.loopConfig.loopMode ?? 'loop'
    layer.props.timeOffset = item.loopConfig.timeOffset ?? 0
    layer.props.autoPlayPaused = true
    if (item.loopConfig.templateId) {
      layer.props.loopTemplateId = item.loopConfig.templateId
    }
    if (item.loopConfig.rhythmMode && item.loopConfig.rhythmMode !== 'none') {
      layer.props.loopRhythmMode = item.loopConfig.rhythmMode
      layer.props.loopRhythmRateHz = item.loopConfig.rhythmRateHz ?? 2.5
      layer.props.loopRhythmIntensity = item.loopConfig.rhythmIntensity ?? 0.4
      layer.props.loopMinOpacity = item.loopConfig.minOpacity ?? 0.6
      layer.props.loopScaleBeatPct = item.loopConfig.scaleBeatPct ?? 12
    }
  }
  layer.transform.position.value = pos
  layer.transform.scale.value = [
    item.scale * (item.scaleX ?? 1) * globalScale,
    item.scale * (item.scaleY ?? 1) * globalScale,
    1
  ]
  layer.transform.rotation.value = [item.rotationX || 0, item.rotationY || 0, item.rotation || 0]
  layer.transform.opacity.value = item.opacity
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
    ...(item.partGroupId ? { partGroupId: item.partGroupId } : {}),
    ...(isRoot && composite.customActions?.length
      ? { customActions: structuredClone(composite.customActions) }
      : {})
  }
  const motion = toSceneMotion(item)
  if (motion) layer.motion = motion
  if (item.physics) {
    layer.physics = structuredClone(item.physics)
  }
  if (item.virtualLight) {
    layer.virtualLight = structuredClone(item.virtualLight)
  }
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
  const activeItems = composite.layers.filter((item) => !item.hidden || isSwappableHiddenVariant(item))
  const rootItemId = (activeItems.find((item) => !item.hidden) ?? activeItems[0])?.id

  // Tối ưu hoá tải tài nguyên song song (Promise.all) triệt tiêu độ trễ khi chèn cụm lắp ráp nhiều lớp
  const resolvedItems = await Promise.all(
    activeItems.map(async (item) => {
      let asset: AssetMeta
      let isNew = false
      if (
        item.loopConfig?.enabled &&
        item.loopConfig.spriteSheetUrl &&
        item.loopConfig.frames &&
        item.loopConfig.frames.length > 0
      ) {
        const built = await buildLoopAnimatedAsset({
          name: item.name,
          spriteSheetUrl: item.loopConfig.spriteSheetUrl,
          frames: item.loopConfig.frames,
          chromaKey: item.loopConfig.chromaKey,
          fps: item.loopConfig.fps || 12
        })
        asset = built.assetMeta
        isNew = true
      } else {
        const resolved = await resolveCompositeItemAsset(item, composite, projectAssets)
        asset = resolved.asset
        isNew = resolved.isNew
      }
      return { item, asset, isNew }
    })
  )

  for (const { asset, isNew } of resolvedItems) {
    if (isNew && !newAssets.some((a) => a.id === asset.id)) {
      newAssets.push(asset)
    }
  }

  // Khởi tạo và nướng rig song song cho toàn bộ các layer giữ đúng thứ tự
  const builtLayers = await Promise.all(
    resolvedItems.map(async ({ item, asset }) => {
      const layer = buildSceneLayer({
        item,
        asset,
        composite,
        comp,
        shotId,
        instanceId,
        isRoot: item.id === rootItemId,
        globalScale,
        positionOffset
      })
      await exportWorkshopSkin(layer, item, composite, assetStore.get(asset.id)?.url ?? item.imageUrl)
      bakeWorkshopRig(layer, item, composite, comp.duration, comp.fps, globalScale, positionOffset)
      return layer
    })
  )

  layersToAdd.push(...builtLayers)

  if (layersToAdd.length > 0) {
    useEditor.getState().update((p) => {
      if (newAssets.length > 0) p.assets.push(...newAssets.filter((a) => !p.assets.some((x) => x.id === a.id)))
      const firstShotIdx = p.layers.findIndex((l) => l.shotId === shotId)
      if (firstShotIdx < 0) p.layers.unshift(...layersToAdd)
      else p.layers.splice(firstShotIdx, 0, ...layersToAdd)
    }, `Thêm cụm layer: ${composite.name}`)
    useEditor.getState().selectLayer(layersToAdd[0].id)
    toast(`Đã thêm cụm layer "${composite.name}" vào cảnh`)
  }
  return layersToAdd.map((l) => l.id)
}
