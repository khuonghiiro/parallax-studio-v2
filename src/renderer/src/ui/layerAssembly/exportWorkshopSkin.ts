import * as THREE from 'three'
import type { ImageLayer } from '@shared/types'
import type { AssembledLayerItem, LayerComposite } from './types'
import { spinesForLayer } from '../../engine/plantSpine'
import { extraSoftBoneIdsForLayer } from './workshopRig'

/**
 * Lưu topology phẳng tiêu chuẩn (rest topology) và rig/spine xương cho layer 2.5D.
 * Sử dụng PlaneGeometry(16, 20) tạo lưới 3D đều cực nhanh (0.01ms), triệt tiêu hoàn toàn
 * độ trễ đọc pixel CPU giúp thao tác kéo thả cụm lắp ráp nhiều lớp vào cảnh mượt mà 60fps.
 */
export async function exportWorkshopSkin(
  layer: ImageLayer,
  item: AssembledLayerItem,
  composite: LayerComposite,
  _url?: string | undefined
): Promise<void> {
  const implicitSingleSoft = !item.boneId && composite.layers.length === 1 && Boolean(composite.rig?.bones.length)
  const isMultiLayerChar = composite.layers.length > 1
  const boneId = item.boneId ?? (implicitSingleSoft ? composite.rig!.bones[0]?.id : undefined)
  const candidateExtraBoneIds =
    boneId && composite.rig
      ? (item.extraBoneIds?.length ? item.extraBoneIds : extraSoftBoneIdsForLayer(composite.layers, composite.rig, item.id, boneId))
      : []
  const skinned =
    Boolean(composite.rig) &&
    ((item.bindingMode === 'soft' && Boolean(boneId)) || implicitSingleSoft || candidateExtraBoneIds.length > 0)
  const spines = spinesForLayer(composite.plantSpines, item.id)
  if (!skinned && !spines.length) return

  const width = item.meshWidth || item.loopConfig?.meshWidth || layer.props.width || composite.width || 400
  const height = item.meshHeight || item.loopConfig?.meshHeight || layer.props.height || composite.height || 400
  const geometry = new THREE.PlaneGeometry(width, height, 16, 20)
  const { x, y, rotation, scale, scaleX, scaleY } = item
  const extraBoneIds = skinned ? candidateExtraBoneIds : []

  layer.mesh = {
    version: 1,
    id: `${layer.id}-skin`,
    name: item.name,
    surface: { width, height, subdivisions: [16, 20], restUVBounds: [0, 0, 1, 1] },
    anchorUV: [0.5, 0.5],
    modifiers: [],
    materials: {},
    skin: {
      rig: skinned ? structuredClone(composite.rig!) : { bones: [], duration: 0, loop: true, tracks: {} },
      binding: {
        boneId: skinned ? boneId : undefined,
        ...(extraBoneIds.length ? { extraBoneIds } : {}),
        ...(skinned && isMultiLayerChar ? { isolateToBoundBones: true } : {}),
        x,
        y,
        rotation,
        scale,
        scaleX,
        scaleY
      },
      ...(spines.length ? { plantSpines: structuredClone(spines) } : {}),
      positions: Array.from(geometry.getAttribute('position').array),
      uvs: Array.from(geometry.getAttribute('uv').array),
      indices: Array.from(geometry.getIndex()!.array)
    }
  }
  layer.props.width = width
  layer.props.height = height
  geometry.dispose()
}
