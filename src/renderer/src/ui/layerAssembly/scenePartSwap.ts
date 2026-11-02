import type { ImageLayer, Layer } from '@shared/types'
import type { AssembledLayerItem, LayerComposite } from './types'
import { useEditor } from '../../store/editor'
import { assetStore } from '../../project/assets'
import {
  computeAlphaMeshBoundsFromMask,
  computeMeshSyncedReplacement,
  syncImageMeshDefinition
} from '../../project/meshRatioSync'
import { BUILTIN_COMPOSITES, getStoredComposites } from './layerAssemblyStorage'
import { resolveCompositeItemAsset } from './compositeAssetLoader'
import { exportWorkshopSkin } from './exportWorkshopSkin'
import { inferSlot, layerAssetPath, type PartAssetCandidate } from './workshopParts'

/**
 * Đổi nhanh bộ phận / biểu cảm cho nhân vật 2.5D ĐÃ đặt trong cảnh: chỉ thay ảnh của layer, giữ nguyên
 * transform, keyframe, motion và liên kết cụm → khuôn mặt mới trùng khớp đúng vị trí khuôn mặt cũ.
 */

export interface ScenePartCandidate extends PartAssetCandidate {
  key: string
  /** Layer biến thể trong mẫu gốc (nếu ứng viên đến từ khe biến thể của mẫu). */
  sourceLayerId?: string
  active?: boolean
}

export function findCompositeTemplate(compositeId?: string): LayerComposite | undefined {
  if (!compositeId) return undefined
  return getStoredComposites().find((c) => c.id === compositeId) ?? BUILTIN_COMPOSITES.find((c) => c.id === compositeId)
}

const stripPrefix = (name: string) => name.replace(/^\[[^\]]+\]\s*/, '')

/** Layer nguồn trong mẫu gốc tương ứng với layer cảnh (theo sourceLayerId, rồi theo tên). */
export function sceneSourceItem(layer: Layer, template?: LayerComposite): AssembledLayerItem | undefined {
  if (!template) return undefined
  const ref = layer.composite
  return template.layers.find((l) => l.id === ref?.sourceLayerId) ?? template.layers.find((l) => l.name === stripPrefix(layer.name))
}

/** Khe biến thể của layer cảnh: lưu trên layer → của layer nguồn → suy từ tên (face-happy → face). */
export function sceneSlot(layer: Layer, template?: LayerComposite): string | undefined {
  return layer.composite?.slot ?? sceneSourceItem(layer, template)?.slot ?? inferSlot(stripPrefix(layer.name))?.slot
}

/** Các biến thể cùng khe trong mẫu gốc (VD face-normal / face-happy / face-cry). */
export function listSceneVariants(layer: Layer, template?: LayerComposite): ScenePartCandidate[] {
  const slot = sceneSlot(layer, template)
  if (!template || !slot) return []
  const current = layer.composite?.sourceLayerId ?? sceneSourceItem(layer, template)?.id
  return template.layers
    .filter((l) => (l.slot ?? inferSlot(l.name)?.slot) === slot)
    .map((l) => ({
      key: l.id,
      sourceLayerId: l.id,
      path: layerAssetPath(template, l) || l.imageUrl || '',
      previewUrl: l.imageUrl,
      name: l.variant ?? inferSlot(l.name)?.variant ?? l.name,
      active: l.id === current
    }))
}

/** Đường dẫn ảnh gốc của layer cảnh (qua layer nguồn của mẫu hoặc asset của dự án). */
export function sceneLayerPath(layer: Layer, template?: LayerComposite): string {
  const item = sceneSourceItem(layer, template)
  if (item && template) return layerAssetPath(template, item)
  if (layer.type !== 'image') return ''
  const meta = useEditor.getState().project.assets.find((a) => a.id === layer.props.assetId)
  return meta?.assetPath || meta?.path || ''
}

function buildSwapItem(base: AssembledLayerItem | undefined, layer: Layer, cand: ScenePartCandidate, template?: LayerComposite): AssembledLayerItem {
  const fromTemplate = cand.sourceLayerId ? template?.layers.find((l) => l.id === cand.sourceLayerId) : undefined
  if (fromTemplate) return structuredClone(fromTemplate)
  const isData = cand.path.startsWith('data:') || cand.path.startsWith('blob:')
  const label = cand.name.replace(/\.[^.]+$/, '')
  const seed: AssembledLayerItem = base
    ? structuredClone(base)
    : { id: layer.id, name: label, x: 0, y: 0, z: 0, scale: 1, rotation: 0, opacity: 1, motion: { type: 'none', speed: 1, amplitude: 0, anchor: 'center' } }
  return { ...seed, name: label, asset: undefined, assetPath: isData ? undefined : cand.path, imageUrl: isData ? cand.path : undefined, variant: inferSlot(label)?.variant ?? label }
}

/** Đổi ảnh bộ phận của layer cảnh (có Undo). Giữ nguyên vị trí/keyframe; đồng bộ theo tỉ lệ Alpha Mesh (2K/4K) và dựng lại skin mesh nếu là layer uốn mềm. */
export async function swapScenePart(layerId: string, cand: ScenePartCandidate): Promise<void> {
  const state = useEditor.getState()
  const layer = state.project.layers.find((l) => l.id === layerId)
  if (!layer || layer.type !== 'image') throw new Error('Chỉ đổi được bộ phận cho layer ảnh')
  const template = findCompositeTemplate(layer.composite?.compositeId)
  const item = buildSwapItem(sceneSourceItem(layer, template), layer, cand, template)
  const tableSource = template ?? { assets: undefined, width: layer.props.width, height: layer.props.height }
  const { asset, isNew } = await resolveCompositeItemAsset(item, tableSource, state.project.assets)

  // Đồng bộ theo tỉ lệ Alpha Mesh để khi thay bằng ảnh 2K/4K không bị phình to hay lệch khớp xương
  const oldRt = assetStore.get(layer.props.assetId)
  const newRt = assetStore.get(asset.id)
  const oldBounds = oldRt?.alpha
    ? computeAlphaMeshBoundsFromMask(oldRt.alpha, oldRt.meta.width, oldRt.meta.height)
    : null
  const newBounds = newRt?.alpha
    ? computeAlphaMeshBoundsFromMask(newRt.alpha, asset.width, asset.height)
    : null
  const synced = computeMeshSyncedReplacement({
    oldMeshW: layer.props.width,
    oldMeshH: layer.props.height,
    oldBounds,
    newBounds,
    newImgW: asset.width || layer.props.width,
    newImgH: asset.height || layer.props.height,
    scaleX: layer.transform.scale.value[0] ?? 1,
    scaleY: layer.transform.scale.value[1] ?? 1,
    anchor: 'center',
    invertY: true
  })

  const targetMeshW = item.meshWidth || synced.meshWidth
  const targetMeshH = item.meshHeight || synced.meshHeight
  item.meshWidth = targetMeshW
  item.meshHeight = targetMeshH

  let mesh: ImageLayer['mesh'] | undefined = layer.mesh
  if (layer.mesh && template) {
    const draft = structuredClone(layer) as ImageLayer
    draft.props.width = targetMeshW
    draft.props.height = targetMeshH
    await exportWorkshopSkin(draft, item, template, newRt?.url ?? item.imageUrl)
    mesh = draft.mesh
  } else if (layer.mesh) {
    mesh = syncImageMeshDefinition(layer.mesh, targetMeshW, targetMeshH)
  }

  const prefix = layer.name.match(/^\[[^\]]+\]\s*/)?.[0] ?? ''
  useEditor.getState().update((p) => {
    if (isNew && !p.assets.some((a) => a.id === asset.id)) p.assets.push(asset)
    const target = p.layers.find((l) => l.id === layerId)
    if (!target || target.type !== 'image') return
    target.props.assetId = asset.id
    target.props.width = targetMeshW
    target.props.height = targetMeshH
    if ((synced.deltaX !== 0 || synced.deltaY !== 0) && target.transform.position.keyframes.length === 0) {
      target.transform.position.value = [
        Math.round((target.transform.position.value[0] + synced.deltaX) * 100) / 100,
        Math.round((target.transform.position.value[1] + synced.deltaY) * 100) / 100,
        target.transform.position.value[2]
      ]
      if (target.composite?.rootOffset) {
        target.composite.rootOffset = [
          Math.round((target.composite.rootOffset[0] + synced.deltaX) * 100) / 100,
          Math.round((target.composite.rootOffset[1] + synced.deltaY) * 100) / 100,
          target.composite.rootOffset[2]
        ]
      }
    }
    if (mesh) target.mesh = mesh
    target.name = `${prefix}${item.name}`
    if (target.composite) {
      target.composite.sourceLayerId = cand.sourceLayerId ?? target.composite.sourceLayerId
      target.composite.variant = item.variant
      target.composite.slot = target.composite.slot ?? sceneSlot(layer, template)
    }
  }, `Đổi bộ phận: ${stripPrefix(layer.name)} → ${item.name}`)
}
