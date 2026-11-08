import type { ImageLayer, Vec3 } from '@shared/types'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { COMPOSITE_Z_FACTOR } from './insertLayerComposite'
import { ensureRigClips } from './workshopRig'
import { inferFallbackBoneForStackedLayer } from './mohoRigHelpers'
import { detectGarmentCoversLegs } from './workshopClothScanner'

type RigPoseMap = ReturnType<typeof evaluateRig>

const rigPoseTimelineCache = new WeakMap<
  NonNullable<LayerComposite['rig']>,
  Map<string, Array<{ t: number; poses: RigPoseMap }>>
>()

function getCachedRigTimeline(
  rig: NonNullable<LayerComposite['rig']>,
  duration: number,
  sampleFps: number
): Array<{ t: number; poses: RigPoseMap }> {
  let byKey = rigPoseTimelineCache.get(rig)
  if (!byKey) {
    byKey = new Map()
    rigPoseTimelineCache.set(rig, byKey)
  }
  const key = `${duration.toFixed(3)}@${sampleFps}`
  const existing = byKey.get(key)
  if (existing) return existing

  const frames = Math.ceil(duration * sampleFps)
  const timeline: Array<{ t: number; poses: RigPoseMap }> = new Array(frames + 1)
  for (let frame = 0; frame <= frames; frame++) {
    const t = Math.min(duration, frame / sampleFps)
    timeline[frame] = { t, poses: evaluateRig(rig, t) }
  }
  byKey.set(key, timeline)
  return timeline
}

/**
 * Bake chuyển động từ khung xương vào các track bản địa của layer.
 * - Với layer gắn Mềm (`layer.mesh?.skin?.binding?.boneId` có mặt): biến dạng đỉnh (X, Y, Góc xoay) đã được
 *   `updateSkinGeometry -> deformSkin` thực thi trực tiếp theo khung xương, nên KHÔNG bake lặp lại X, Y, Rotation
 *   lên mặt phẳng layer (tránh nhân đôi biến đổi làm gãy rời khuỷu tay/đầu gối). Chỉ bake duy nhất trục Z (`zOrder`)
 *   để đảo chiều sâu cánh tay/chân trước-sau khi vung tay hoặc bước đi.
 * - Với layer gắn Cứng (`rigid`): bake đầy đủ vị trí và góc xoay của xương vào track của layer.
 */
export function bakeWorkshopRig(
  layer: ImageLayer,
  item: AssembledLayerItem,
  composite: LayerComposite,
  duration: number,
  fps: number,
  scale: number,
  offset: Vec3
): void {
  if (!composite.rig) return
  const normalizedRig = ensureRigClips(composite.rig).rig
  const fallbackBoneId =
    !item.boneId && composite.layers.length > 1 && normalizedRig.bones.length
      ? inferFallbackBoneForStackedLayer(item, composite.layers, normalizedRig.bones)
      : undefined
  const effectiveBoneId = item.boneId ?? fallbackBoneId
  if (!effectiveBoneId) return

  const garmentOcclusion = detectGarmentCoversLegs(composite.layers, normalizedRig.bones)
  const isCoveredLegLayer =
    garmentOcclusion.hasLongGarmentCoveringLegs && garmentOcclusion.legLayers.some((leg) => leg.id === item.id)
  const isSoftSkinned = Boolean(layer.mesh?.skin?.binding?.boneId)

  const sampleFps = Math.min(fps, 24)
  const rigTimeline = getCachedRigTimeline(normalizedRig, duration, sampleFps)
  const inPoint = layer.inPoint ?? 0

  interface RawSample {
    t: number
    pos: Vec3
    rot: Vec3
  }

  const restPosX = Math.round((item.x * scale + offset[0]) * 100) / 100
  const restPosY = Math.round((-item.y * scale + offset[1]) * 100) / 100
  const restRot: Vec3 = [
    Math.round((item.rotationX ?? 0) * 100) / 100,
    Math.round((item.rotationY ?? 0) * 100) / 100,
    Math.round((item.rotation ?? 0) * 100) / 100
  ]

  const samples: RawSample[] = new Array(rigTimeline.length)
  for (let frame = 0; frame < rigTimeline.length; frame++) {
    const { t, poses } = rigTimeline[frame]
    const pose = poses.get(effectiveBoneId)
    const rawZOrder = pose?.zOrder ?? 0
    const safeZOrder =
      isCoveredLegLayer && rawZOrder > garmentOcclusion.maxSafeLegZOrder
        ? garmentOcclusion.maxSafeLegZOrder
        : rawZOrder

    if (isSoftSkinned) {
      const finalZ = (item.z ?? 0) + safeZOrder
      const pos: Vec3 = [
        restPosX,
        restPosY,
        Math.round((-finalZ * COMPOSITE_Z_FACTOR * scale + offset[2]) * 100) / 100
      ]
      samples[frame] = { t: Number((inPoint + t).toFixed(4)), pos, rot: restRot }
    } else {
      const posed = transformRigLayer({ ...item, boneId: effectiveBoneId }, poses)
      const finalZ =
        isCoveredLegLayer && typeof posed.z === 'number' && posed.z > (item.z ?? 0) + garmentOcclusion.maxSafeLegZOrder
          ? Number(((item.z ?? 0) + garmentOcclusion.maxSafeLegZOrder).toFixed(3))
          : (posed.z ?? 0)
      const pos: Vec3 = [
        Math.round((posed.x * scale + offset[0]) * 100) / 100,
        Math.round((-posed.y * scale + offset[1]) * 100) / 100,
        Math.round((-finalZ * COMPOSITE_Z_FACTOR * scale + offset[2]) * 100) / 100
      ]
      const rot: Vec3 = [
        Math.round((posed.rotationX ?? 0) * 100) / 100,
        Math.round((posed.rotationY ?? 0) * 100) / 100,
        Math.round(posed.rotation * 100) / 100
      ]
      samples[frame] = { t: Number((inPoint + t).toFixed(4)), pos, rot }
    }
  }

  const first = samples[0]
  layer.transform.position.value = first.pos
  layer.transform.rotation.value = first.rot

  // Kiểm tra xem vị trí và góc xoay có thay đổi trong suốt thời gian hay không
  const isStaticPos = samples.every(
    (s) => Math.hypot(s.pos[0] - first.pos[0], s.pos[1] - first.pos[1], s.pos[2] - first.pos[2]) < 0.05
  )
  const isStaticRot = samples.every(
    (s) => Math.hypot(s.rot[0] - first.rot[0], s.rot[1] - first.rot[1], s.rot[2] - first.rot[2]) < 0.05
  )

  // Nếu hoàn toàn tĩnh (layer không chuyển động), chỉ lưu giá trị tĩnh, không sinh keyframe rác
  if (isStaticPos && isStaticRot) {
    return
  }

  // Đẩy keyframe cho vị trí nếu có chuyển động
  if (!isStaticPos) {
    let lastP: Vec3 | null = null
    let lastPIdx = -1
    for (let f = 0; f < samples.length; f++) {
      const s = samples[f]
      const isBoundary = f === 0 || f === samples.length - 1
      if (
        isBoundary ||
        !lastP ||
        Math.hypot(s.pos[0] - lastP[0], s.pos[1] - lastP[1], s.pos[2] - lastP[2]) >= 0.05
      ) {
        if (f - 1 > lastPIdx && lastPIdx >= 0) {
          const prev = samples[f - 1]
          layer.transform.position.keyframes.push({
            id: `${layer.id}-rig-p-${f - 1}`,
            t: prev.t,
            value: prev.pos,
            ease: 'linear'
          })
        }
        layer.transform.position.keyframes.push({
          id: `${layer.id}-rig-p-${f}`,
          t: s.t,
          value: s.pos,
          ease: 'linear'
        })
        lastP = s.pos
        lastPIdx = f
      }
    }
  }

  // Đẩy keyframe cho góc xoay nếu có chuyển động
  if (!isStaticRot) {
    let lastR: Vec3 | null = null
    let lastRIdx = -1
    for (let f = 0; f < samples.length; f++) {
      const s = samples[f]
      const isBoundary = f === 0 || f === samples.length - 1
      if (
        isBoundary ||
        !lastR ||
        Math.hypot(s.rot[0] - lastR[0], s.rot[1] - lastR[1], s.rot[2] - lastR[2]) >= 0.05
      ) {
        if (f - 1 > lastRIdx && lastRIdx >= 0) {
          const prev = samples[f - 1]
          layer.transform.rotation.keyframes.push({
            id: `${layer.id}-rig-r-${f - 1}`,
            t: prev.t,
            value: prev.rot,
            ease: 'linear'
          })
        }
        layer.transform.rotation.keyframes.push({
          id: `${layer.id}-rig-r-${f}`,
          t: s.t,
          value: s.rot,
          ease: 'linear'
        })
        lastR = s.rot
        lastRIdx = f
      }
    }
  }
}
