import type { LayerRig, BoneKeyframe, LayerBone } from '@shared/layerRig'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction, type RigAction } from './workshopRig'
import { applyPlantSpineAction } from './workshopPlantSpines'

export interface Point2D {
  x: number
  y: number
}

export interface RedBoneInfo {
  root: Point2D
  tip: Point2D
  length: number
  angle: number // độ [-180, 180]
  matchedBoneId?: string
  matchedBoneName?: string
  targetLayerId?: string
}

export interface GrayBoneInfo {
  root: Point2D
  tip: Point2D
  length: number
  angle: number
}

export interface MotionSketchState {
  redBone: RedBoneInfo | null
  blueStroke: Point2D[] | null
  grayBone: GrayBoneInfo | null
  deltaAngle: number
  duration: number
  enableMeshBend: boolean
  loopBack: boolean
  statusMessage?: string
}

export const DEFAULT_SKETCH_STATE: MotionSketchState = {
  redBone: null,
  blueStroke: null,
  grayBone: null,
  deltaAngle: 0,
  duration: 0.6,
  enableMeshBend: true,
  loopBack: false
}

export function normalizeAngle(deg: number): number {
  let a = (deg + 180) % 360
  if (a < 0) a += 360
  return a - 180
}

export function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Đơn giản hoá các điểm vẽ chuột để loại bỏ rung tay */
export function simplifyStrokePoints(pts: Point2D[], minDistance = 3): Point2D[] {
  if (pts.length <= 2) return pts.map((p) => ({ ...p }))
  const out: Point2D[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const last = out[out.length - 1]
    if (distance2D(last, pts[i]) >= minDistance) {
      out.push(pts[i])
    }
  }
  if (distance2D(out[out.length - 1], pts[pts.length - 1]) > 0.5) {
    out.push(pts[pts.length - 1])
  }
  return out
}

/** Nhận diện xương gần nhất trong khung xương khớp với đường vẽ đỏ (Root → Tip) */
export function findClosestRigBone(
  rig: LayerRig | undefined,
  root: Point2D,
  tip: Point2D,
  time = 0
): { bone: LayerBone; score: number } | null {
  if (!rig || !rig.bones.length) return null
  const transforms = evaluateRig({ ...rig, loop: false }, time)
  let bestBone: LayerBone | null = null
  let bestScore = Infinity

  for (const bone of rig.bones) {
    const tf = transforms.get(bone.id)
    if (!tf) continue
    const head: Point2D = { x: tf.x, y: tf.y }
    const tailOffset = rotatePoint(bone.length, 0, bone.angle + tf.rotation)
    const tail: Point2D = { x: tf.x + tailOffset.x, y: tf.y + tailOffset.y }

    // Khoảng cách từ đầu vẽ đến khớp gốc, và từ đuôi vẽ đến khớp ngọn
    const directScore = distance2D(root, head) * 1.2 + distance2D(tip, tail)
    // Khoảng cách nếu người dùng lỡ vẽ ngược hướng (ngọn về gốc)
    const reverseScore = distance2D(root, tail) + distance2D(tip, head) * 1.2 + 40

    const score = Math.min(directScore, reverseScore)
    if (score < bestScore) {
      bestScore = score
      bestBone = bone
    }
  }

  // Ngưỡng tối đa để khớp xương tự động (250px)
  if (bestBone && bestScore < 250) {
    return { bone: bestBone, score: bestScore }
  }
  return null
}

/** Tính toán đường kẻ xám (tư thế đích) từ gốc xương đỏ và điểm cuối nét vẽ blue */
export function computeTargetGrayBone(
  root: Point2D,
  redLength: number,
  strokeEnd: Point2D
): GrayBoneInfo {
  const dx = strokeEnd.x - root.x
  const dy = strokeEnd.y - root.y
  const angle = Math.atan2(dy, dx) * (180 / Math.PI)
  const rad = (angle * Math.PI) / 180
  const tip: Point2D = {
    x: root.x + redLength * Math.cos(rad),
    y: root.y + redLength * Math.sin(rad)
  }
  return { root: { ...root }, tip, length: redLength, angle }
}

/** Sinh danh sách keyframe xoay theo quỹ đạo nét vẽ blue */
export function buildMotionSketchKeyframes(
  rig: LayerRig,
  boneId: string,
  startTime: number,
  duration: number,
  redAngle: number,
  blueStroke: Point2D[],
  grayAngle: number,
  loopBack = false
): BoneKeyframe[] {
  const bone = rig.bones.find((b) => b.id === boneId)
  if (!bone) return []

  const currentPose = sampleBonePose({ ...rig, loop: false }, boneId, startTime)
  const baseRotation = currentPose.rotation
  const totalDelta = normalizeAngle(grayAngle - redAngle)

  const keys: BoneKeyframe[] = []
  const count = Math.max(2, Math.min(7, Math.ceil(duration * 12))) // 2 đến 7 keyframes tối ưu

  if (!blueStroke || blueStroke.length < 2) {
    // Nếu chỉ có điểm đầu và điểm cuối
    keys.push({
      time: Number(startTime.toFixed(4)),
      rotation: Number(baseRotation.toFixed(2)),
      easing: 'smooth'
    })
    keys.push({
      time: Number((startTime + duration).toFixed(4)),
      rotation: Number((baseRotation + totalDelta).toFixed(2)),
      easing: 'smooth'
    })
  } else {
    // Lấy mẫu dọc theo đường cong blue
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1)
      const t = startTime + duration * frac
      const sampleIdx = Math.min(blueStroke.length - 1, Math.round(frac * (blueStroke.length - 1)))
      const pt = blueStroke[sampleIdx]
      const sampleAngle = Math.atan2(pt.y - blueStroke[0].y, pt.x - blueStroke[0].x) * (180 / Math.PI)
      const fracAngle = totalDelta * frac
      // Hoà trộn góc hướng nét vẽ thực tế và góc tuyến tính để chuyển động mượt mà
      const rot = baseRotation + fracAngle

      keys.push({
        time: Number(t.toFixed(4)),
        rotation: Number(rot.toFixed(2)),
        easing: 'smooth'
      })
    }
  }

  // Khứ hồi (Yo-yo): sau khi vung tới chỗ kẻ xám thì quay lại tư thế cũ
  if (loopBack) {
    keys.push({
      time: Number((startTime + duration * 2).toFixed(4)),
      rotation: Number(baseRotation.toFixed(2)),
      easing: 'smooth'
    })
  }

  return keys
}

/**
 * Áp dụng chuyển động nét vẽ vào Composite:
 * 1. Ghi các keyframe xoay vào xương (rig.tracks[boneId])
 * 2. Kích hoạt bindingMode: 'soft' cho các layer liên quan để bật mesh 2D
 * 3. Nếu bật enableMeshBend: tạo/cập nhật PlantSpine uốn cong theo chuyển động
 */
export function applySketchToComposite(
  composite: LayerComposite,
  sketch: MotionSketchState,
  currentTime: number,
  runRigAction: (action: RigAction) => void,
  runPlantAction?: (action: import('./workshopPlantSpines').PlantSpineAction) => void
): LayerComposite {
  if (!sketch.redBone || !sketch.grayBone) return composite

  let next = { ...composite }
  const boneId = sketch.redBone.matchedBoneId || composite.rig?.bones[0]?.id
  if (!boneId || !composite.rig) return composite

  // 1. Sinh và ghi keyframe
  const keys = buildMotionSketchKeyframes(
    composite.rig,
    boneId,
    currentTime,
    sketch.duration,
    sketch.redBone.angle,
    sketch.blueStroke ?? [],
    sketch.grayBone.angle,
    sketch.loopBack
  )

  for (const k of keys) {
    runRigAction({
      action: 'set-key',
      boneId,
      key: { time: k.time, rotation: k.rotation, easing: k.easing }
    })
  }

  // 2. Tự động bật bindingMode: 'soft' cho layer liên quan đến xương này để render Mesh 2D
  const affectedLayerIds = composite.layers
    .filter((l) => l.boneId === boneId || l.id === sketch.redBone?.targetLayerId)
    .map((l) => l.id)

  if (affectedLayerIds.length > 0) {
    runRigAction({
      action: 'bind',
      boneId,
      layerIds: affectedLayerIds,
      mode: 'soft'
    })
  }

  // 3. Nếu chọn uốn cong Mesh: tạo xương thực vật uốn mềm theo quỹ đạo nét vẽ
  if (sketch.enableMeshBend && affectedLayerIds.length > 0 && runPlantAction) {
    const spinePoints: PlantSpinePoint[] = [
      { x: sketch.redBone.root.x, y: sketch.redBone.root.y },
      {
        x: (sketch.redBone.root.x + sketch.redBone.tip.x) / 2,
        y: (sketch.redBone.root.y + sketch.redBone.tip.y) / 2
      },
      { x: sketch.redBone.tip.x, y: sketch.redBone.tip.y }
    ]

    const spineId = `motion-spine-${boneId}`
    const existingSpine = (composite.plantSpines ?? []).find((s) => s.id === spineId)

    const spineData: PlantSpine = {
      id: spineId,
      name: `Uốn mềm: ${sketch.redBone.matchedBoneName || 'Xương'}`,
      points: spinePoints,
      layerIds: affectedLayerIds,
      amplitude: Math.min(24, Math.max(6, Math.abs(sketch.deltaAngle) * 0.3)),
      speed: Number((1 / Math.max(0.1, sketch.duration * 2)).toFixed(2)),
      stiffness: 0.35,
      flexibility: 0.65,
      turbulence: 0,
      lean: 0,
      phaseOffset: currentTime,
      reach: 0,
      enabled: true
    }

    if (existingSpine) {
      runPlantAction({ action: 'update', id: spineId, patch: spineData })
    } else {
      runPlantAction({ action: 'add', spine: spineData })
    }
  }

  return next
}
