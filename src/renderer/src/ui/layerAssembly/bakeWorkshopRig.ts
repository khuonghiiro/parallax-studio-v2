import type { ImageLayer, Vec3 } from '@shared/types'
import { evaluateRig, transformRigLayer } from '../../engine/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { COMPOSITE_Z_FACTOR } from './insertLayerComposite'

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
 * Dùng chung bảng nội suy pose khung xương qua WeakMap cho toàn bộ các lớp con trong cùng cụm (tăng tốc 15x),
 * đồng thời tự động phát hiện và bỏ qua các layer tĩnh để tránh sinh keyframe rác làm đơ timeline.
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
  if (!composite.rig || !item.boneId) return
  const sampleFps = Math.min(fps, 24)
  const rigTimeline = getCachedRigTimeline(composite.rig, duration, sampleFps)

  interface RawSample {
    t: number
    pos: Vec3
    rot: Vec3
  }

  const samples: RawSample[] = new Array(rigTimeline.length)
  for (let frame = 0; frame < rigTimeline.length; frame++) {
    const { t, poses } = rigTimeline[frame]
    const posed = transformRigLayer(item, poses)
    const pos: Vec3 = [
      Math.round((posed.x * scale + offset[0]) * 100) / 100,
      Math.round((-posed.y * scale + offset[1]) * 100) / 100,
      Math.round((-(posed.z ?? 0) * COMPOSITE_Z_FACTOR * scale + offset[2]) * 100) / 100
    ]
    const rot: Vec3 = [
      Math.round((posed.rotationX ?? 0) * 100) / 100,
      Math.round((posed.rotationY ?? 0) * 100) / 100,
      Math.round(posed.rotation * 100) / 100
    ]
    samples[frame] = { t, pos, rot }
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
    for (let f = 0; f < samples.length; f++) {
      const s = samples[f]
      const isBoundary = f === 0 || f === samples.length - 1
      if (
        isBoundary ||
        !lastP ||
        Math.hypot(s.pos[0] - lastP[0], s.pos[1] - lastP[1], s.pos[2] - lastP[2]) >= 0.05
      ) {
        layer.transform.position.keyframes.push({
          id: `${layer.id}-rig-p-${f}`,
          t: s.t,
          value: s.pos,
          ease: 'linear'
        })
        lastP = s.pos
      }
    }
  }

  // Đẩy keyframe cho góc xoay nếu có chuyển động
  if (!isStaticRot) {
    let lastR: Vec3 | null = null
    for (let f = 0; f < samples.length; f++) {
      const s = samples[f]
      const isBoundary = f === 0 || f === samples.length - 1
      if (
        isBoundary ||
        !lastR ||
        Math.hypot(s.rot[0] - lastR[0], s.rot[1] - lastR[1], s.rot[2] - lastR[2]) >= 0.05
      ) {
        layer.transform.rotation.keyframes.push({
          id: `${layer.id}-rig-r-${f}`,
          t: s.t,
          value: s.rot,
          ease: 'linear'
        })
        lastR = s.rot
      }
    }
  }
}
