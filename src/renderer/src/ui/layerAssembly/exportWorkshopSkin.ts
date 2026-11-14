import * as THREE from 'three'
import type { ImageLayer } from '@shared/types'
import type { AssembledLayerItem, LayerComposite } from './types'
import { spinesForLayer } from '../../engine/plantSpine'
import { ensureRigClips, extraSoftBoneIdsForLayer, resolveAutoSoftExtraBoneIds } from './workshopRig'
import { inferFallbackBoneForStackedLayer } from './mohoRigHelpers'
import { detectGarmentCoversLegs } from './workshopClothScanner'

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
  const normalizedRig = composite.rig ? ensureRigClips(composite.rig).rig : undefined
  const garmentOcclusion = normalizedRig ? detectGarmentCoversLegs(composite.layers, normalizedRig.bones) : undefined
  const robeMatch = garmentOcclusion?.robeLayers.find((r) => r.id === item.id)
  const implicitSingleSoft = !item.boneId && composite.layers.length === 1 && Boolean(normalizedRig?.bones.length)
  const isMultiLayerChar = composite.layers.length > 1
  const fallbackBoneId =
    !item.boneId && isMultiLayerChar && normalizedRig?.bones.length
      ? inferFallbackBoneForStackedLayer(item, composite.layers, normalizedRig.bones)
      : undefined
  const boneId = item.boneId ?? fallbackBoneId ?? (implicitSingleSoft ? normalizedRig!.bones[0]?.id : undefined)
  const rawExtraBones =
    boneId && normalizedRig
      ? (item.extraBoneIds?.length ? item.extraBoneIds : extraSoftBoneIdsForLayer(composite.layers, normalizedRig, item.id, boneId))
      : []
  const baseExtraBones = resolveAutoSoftExtraBoneIds(
    item,
    normalizedRig,
    rawExtraBones,
    composite.layers.length === 1 && Boolean(normalizedRig?.bones.length)
  )
  const candidateExtraBoneIds =
    robeMatch && robeMatch.coveredBoneIds.length > 0
      ? Array.from(new Set([...baseExtraBones, ...robeMatch.coveredBoneIds]))
      : baseExtraBones
  const skinned =
    Boolean(normalizedRig) &&
    ((item.bindingMode === 'soft' && Boolean(boneId)) ||
      Boolean(robeMatch) ||
      Boolean(fallbackBoneId) ||
      implicitSingleSoft ||
      candidateExtraBoneIds.length > 0)
  const spines = spinesForLayer(composite.plantSpines, item.id)
  if (!skinned && !spines.length) return

  const width = item.meshWidth || item.loopConfig?.meshWidth || layer.props.width || composite.width || 400
  const height = item.meshHeight || item.loopConfig?.meshHeight || layer.props.height || composite.height || 400
  const geometry = new THREE.PlaneGeometry(width, height, 16, 20)
  const { x, y, rotation, scale, scaleX, scaleY } = item
  const extraBoneIds = skinned ? candidateExtraBoneIds : []
  const effectiveIsCloth = Boolean(item.isCloth || (robeMatch && robeMatch.coveredBoneIds.length > 0))
  const effectiveClothAmp = item.clothAmplitude ?? (effectiveIsCloth ? 45 : undefined)

  layer.mesh = {
    version: 1,
    id: `${layer.id}-skin`,
    name: item.name,
    surface: { width, height, subdivisions: [16, 20], restUVBounds: [0, 0, 1, 1] },
    anchorUV: [0.5, 0.5],
    modifiers: [],
    materials: {},
    skin: {
      rig: skinned ? structuredClone(normalizedRig!) : { bones: [], duration: 0, loop: true, tracks: {} },
      binding: {
        boneId: skinned ? boneId : undefined,
        ...(extraBoneIds.length ? { extraBoneIds } : {}),
        ...(skinned && isMultiLayerChar ? { isolateToBoundBones: true } : {}),
        ...(effectiveIsCloth
          ? {
              isCloth: true,
              clothFollowBoneId: item.clothFollowBoneId ?? robeMatch?.coveredBoneIds[0],
              clothAmplitude: effectiveClothAmp
            }
          : {}),
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
