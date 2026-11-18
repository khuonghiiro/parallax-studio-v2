import type { BoneEasing, BoneKeyframe, LayerBone, MotionViewAngle } from '@shared/layerRig'
import { inferHumanoidBoneRoles } from './spineRigWorkflow'

export interface BodyBoneIds {
  pelvis?: string
  torso?: string
  head?: string
  armL?: string
  armR?: string
  forearmL?: string
  forearmR?: string
  handL?: string
  handR?: string
  thighL?: string
  thighR?: string
  shinL?: string
  shinR?: string
  footL?: string
  footR?: string
}

/** Tạo một BoneKeyframe chuẩn hoá với easing tuỳ chọn (mặc định `ease-in-out` mượt 2D/Spine). */
export function kf(
  time: number,
  rotation: number,
  x = 0,
  y = 0,
  scaleX = 1,
  scaleY = 1,
  zOrder?: number,
  easing: BoneEasing = 'smooth'
): BoneKeyframe {
  return {
    time: Number(time.toFixed(3)),
    rotation: Number(rotation.toFixed(2)),
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    scaleX: Number(scaleX.toFixed(3)),
    scaleY: Number(scaleY.toFixed(3)),
    ...(zOrder !== undefined && Math.abs(zOrder) > 1e-4 ? { zOrder: Number(zOrder.toFixed(1)) } : {}),
    easing
  }
}

function findBoneId(bones: LayerBone[], keywords: string[]): string | undefined {
  for (const b of bones) {
    const idLow = b.id.toLowerCase()
    const nameLow = (b.name || '').toLowerCase()
    for (const kw of keywords) {
      if (idLow.includes(kw) || nameLow.includes(kw)) return b.id
    }
  }
  return undefined
}

/** Điền keyframe nghỉ cho các xương chưa được track riêng để giữ độ dài clip đồng nhất. */
export function fillRestTracks(bones: LayerBone[], tracks: Record<string, BoneKeyframe[]>, d: number) {
  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [kf(0, 0), kf(d * 0.5, 0), kf(d, 0)]
    }
  }
  return tracks
}

/** Ánh xạ các xương nhân vật chuẩn từ danh sách xương bất kỳ trong Xưởng. */
export function resolveBodyIds(bones: LayerBone[]): BodyBoneIds {
  const inferred = inferHumanoidBoneRoles(bones)
  return {
    pelvis: findBoneId(bones, ['pelvis', 'hông', 'root']) ?? inferred.pelvis,
    torso: findBoneId(bones, ['torso', 'thân', 'ngực']) ?? inferred.torso,
    head: findBoneId(bones, ['head', 'đầu']) ?? inferred.head,
    armL: findBoneId(bones, ['arm-l', 'arm_l', 'bắp tay trái', 'upperarm-l']) ?? inferred.armL,
    armR: findBoneId(bones, ['arm-r', 'arm_r', 'bắp tay phải', 'upperarm-r']) ?? inferred.armR,
    forearmL: findBoneId(bones, ['forearm-l', 'forearm_l', 'cẳng tay trái', 'lowerarm-l']) ?? inferred.forearmL,
    forearmR: findBoneId(bones, ['forearm-r', 'forearm_r', 'cẳng tay phải', 'lowerarm-r']) ?? inferred.forearmR,
    handL: findBoneId(bones, ['hand-l', 'hand_l', 'bàn tay trái']) ?? inferred.handL,
    handR: findBoneId(bones, ['hand-r', 'hand_r', 'bàn tay phải']) ?? inferred.handR,
    thighL: findBoneId(bones, ['thigh-l', 'thigh_l', 'đùi trái']) ?? inferred.thighL,
    thighR: findBoneId(bones, ['thigh-r', 'thigh_r', 'đùi phải']) ?? inferred.thighR,
    shinL: findBoneId(bones, ['shin-l', 'shin_l', 'cẳng chân trái']) ?? inferred.shinL,
    shinR: findBoneId(bones, ['shin-r', 'shin_r', 'cẳng chân phải']) ?? inferred.shinR,
    footL: findBoneId(bones, ['foot-l', 'foot_l', 'bàn chân trái']) ?? inferred.footL,
    footR: findBoneId(bones, ['foot-r', 'foot_r', 'bàn chân phải']) ?? inferred.footR
  }
}

/**
 * 1. Thuyết thoại / Đàm đạo (`talk`): nhịp nói chuyện 2D Motion-Comic mượt mà (Hàn Bối Tháp).
 * Thở bất đối xứng + tay phải vung diễn giải có trễ pha vai → khuỷu → cổ tay + đầu gật nhấn ý.
 */
export function generateTalkGesture(
  bones: LayerBone[],
  duration = 2.2,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isSide = viewAngle === 'side'

  if (ids.pelvis) tracks[ids.pelvis] = [kf(0, 0), kf(d * 0.5, 0), kf(d, 0)]
  if (ids.torso) {
    const lean = isSide ? 3.2 : viewAngle === 'diagonal' ? 1.8 : 1.2
    tracks[ids.torso] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.24, lean, 0, -2.4, 1.016, 1.018, undefined, 'ease-out'),
      kf(d * 0.58, -lean * 0.7, 0, -0.8, 1.006, 1.008, undefined, 'ease-in-out'),
      kf(d * 0.82, lean * 0.45, 0, -1.8, 1.012, 1.012, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.16, -2.2, 0, -0.8, 1, 1, undefined, 'ease-out'),
      kf(d * 0.34, isSide ? 4.8 : 3.2, 0, -2.0, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.64, isSide ? -3.4 : -2.6, 0, -0.6, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.88, 1.8, 0, -1.2, 1, 1, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.armR) {
    const raise = isSide ? -46 : -34
    tracks[ids.armR] = [
      kf(0, -12, 0, 0, 1, 1, 50, 'ease-out'),
      kf(d * 0.24, raise, 0, 0, 1, 1, 55, 'ease-in-out'),
      kf(d * 0.54, raise + 14, 0, 0, 1, 1, 55, 'ease-in-out'),
      kf(d * 0.78, raise - 4, 0, 0, 1, 1, 55, 'ease-in-out'),
      kf(d, -12, 0, 0, 1, 1, 50, 'ease-in-out')
    ]
  }
  if (ids.forearmR) {
    tracks[ids.forearmR] = [
      kf(0, -14, 0, 0, 1, 1, 20, 'ease-in-out'),
      kf(d * 0.16, -26, 0, 0, 1, 1, 20, 'ease-out'),
      kf(d * 0.34, -44, 0, 0, 1, 1, 25, 'ease-in-out'),
      kf(d * 0.62, -22, 0, 0, 1, 1, 20, 'ease-in-out'),
      kf(d * 0.86, -38, 0, 0, 1, 1, 25, 'ease-in-out'),
      kf(d, -14, 0, 0, 1, 1, 20, 'ease-in-out')
    ]
  }
  if (ids.handR) {
    tracks[ids.handR] = [
      kf(0, -6),
      kf(d * 0.22, -16),
      kf(d * 0.42, 14),
      kf(d * 0.68, -12),
      kf(d * 0.90, 10),
      kf(d, -6)
    ]
  }
  if (ids.armL) {
    tracks[ids.armL] = [kf(0, 6), kf(d * 0.48, 12, 0, 0, 1, 1, 40), kf(d, 6)]
  }
  if (ids.forearmL) {
    tracks[ids.forearmL] = [kf(0, -8), kf(d * 0.54, -18), kf(d, -8)]
  }
  return fillRestTracks(bones, tracks, d)
}

/**
 * 2. Mưu tính / Chống cằm (`scheming`): dáng suy luận quy tắc đặc trưng của Hàn Bối Tháp.
 * Vào dáng nhanh bằng ease-out -> giữ thế nghiêng đầu phân tích kèm nhịp cổ tay -> nhả nhẹ.
 */
export function generateSchemingChin(
  bones: LayerBone[],
  duration = 2.6,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isSide = viewAngle === 'side'

  if (ids.pelvis) tracks[ids.pelvis] = [kf(0, 0), kf(d * 0.5, 0), kf(d, 0)]
  if (ids.torso) {
    tracks[ids.torso] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-out'),
      kf(d * 0.24, isSide ? 4.2 : 2.2, 0, -2.0, 1.012, 1.016, undefined, 'ease-in-out'),
      kf(d * 0.52, isSide ? 5.0 : 2.8, 0, -3.2, 1.022, 1.024, undefined, 'ease-in-out'),
      kf(d * 0.76, isSide ? 3.8 : 2.0, 0, -1.6, 1.01, 1.014, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.head) {
    const tilt = isSide ? -5.5 : 5.2
    tracks[ids.head] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-out'),
      kf(d * 0.28, tilt, 0, 1.5, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.56, tilt + 1.8, 0, -0.5, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.78, tilt - 0.8, 0, 1.2, 1, 1, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.armR) {
    const up = isSide ? -56 : -44
    tracks[ids.armR] = [
      kf(0, 0, 0, 0, 1, 1, 55, 'ease-out'),
      kf(d * 0.22, up, 0, -2, 1, 1, 60, 'ease-in-out'),
      kf(d * 0.74, up - 2, 0, -2, 1, 1, 60, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, 55, 'ease-in-out')
    ]
  }
  if (ids.forearmR) {
    tracks[ids.forearmR] = [
      kf(0, 0, 0, 0, 1, 1, 25, 'ease-out'),
      kf(d * 0.26, -88, 0, 0, 1, 1, 30, 'ease-in-out'),
      kf(d * 0.50, -94, 0, 0, 1, 1, 30, 'ease-in-out'),
      kf(d * 0.76, -86, 0, 0, 1, 1, 30, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, 25, 'ease-in-out')
    ]
  }
  if (ids.handR) {
    tracks[ids.handR] = [
      kf(0, 0),
      kf(d * 0.28, -16),
      kf(d * 0.48, -8),
      kf(d * 0.66, -18),
      kf(d * 0.78, -14),
      kf(d, 0)
    ]
  }
  if (ids.armL) tracks[ids.armL] = [kf(0, 0, 0, 0, 1, 1, 45), kf(d * 0.26, 16, 0, 0, 1, 1, 45), kf(d * 0.74, 18, 0, 0, 1, 1, 45), kf(d, 0)]
  if (ids.forearmL) tracks[ids.forearmL] = [kf(0, 0), kf(d * 0.30, 22), kf(d * 0.74, 24), kf(d, 0)]
  return fillRestTracks(bones, tracks, d)
}

/**
 * 3. Giật mình Quái Đàm (`shock`): phản xạ co người dứt khoát (`ease-out`) + rung nhịp tim nhẹ rồi hồi thế.
 */
export function generateShockRecoil(
  bones: LayerBone[],
  duration = 1.5,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isSide = viewAngle === 'side'

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-out'),
      kf(d * 0.16, 0, isSide ? -8 : 0, 8, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.54, 0, isSide ? -6 : 0, 5, 1, 1, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-out'),
      kf(d * 0.16, isSide ? -9 : -4.5, 0, 4, 1.036, 0.94, undefined, 'ease-in-out'),
      kf(d * 0.32, isSide ? -7 : -3.0, 0, 2, 1.02, 0.97, undefined, 'ease-in-out'),
      kf(d * 0.50, isSide ? -8.5 : -4.0, 0, 3, 1.028, 0.955, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-out'),
      kf(d * 0.14, isSide ? -10 : -5.5, 0, -4, 1, 1, undefined, 'ease-out'),
      kf(d * 0.24, isSide ? -6 : 3.5, 0, 3, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.54, isSide ? -5 : -2.5, 0, 1, 1, 1, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.armL) tracks[ids.armL] = [kf(0, 0, 0, 0, 1, 1, 55, 'ease-out'), kf(d * 0.18, 44, 0, 0, 1, 1, 55), kf(d * 0.54, 28, 0, 0, 1, 1, 55), kf(d, 0)]
  if (ids.armR) tracks[ids.armR] = [kf(0, 0, 0, 0, 1, 1, 55, 'ease-out'), kf(d * 0.18, isSide ? -54 : -44, 0, 0, 1, 1, 55), kf(d * 0.54, isSide ? -36 : -28, 0, 0, 1, 1, 55), kf(d, 0)]
  if (ids.forearmL) tracks[ids.forearmL] = [kf(0, 0, 0, 0, 1, 1, 15, 'ease-out'), kf(d * 0.22, -32, 0, 0, 1, 1, 15), kf(d, 0)]
  if (ids.forearmR) tracks[ids.forearmR] = [kf(0, 0, 0, 0, 1, 1, 15, 'ease-out'), kf(d * 0.22, 32, 0, 0, 1, 1, 15), kf(d, 0)]
  return fillRestTracks(bones, tracks, d)
}

/**
 * 4. Chỉ tay phá cục (`point`): lấy đà (`ease-in`) -> vung tay chỉ thẳng dứt khoát (`ease-out`) -> ghim dáng uy lực -> thu về.
 */
export function generateDramaticPoint(
  bones: LayerBone[],
  duration = 1.7,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isSide = viewAngle === 'side'

  if (ids.pelvis) tracks[ids.pelvis] = [kf(0, 0), kf(d * 0.20, 0, -2, 3), kf(d * 0.42, 0, 4, 6), kf(d * 0.76, 0, 3, 5), kf(d, 0)]
  if (ids.torso) {
    tracks[ids.torso] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-in'),
      kf(d * 0.20, isSide ? -8 : -4.5, 0, 2, 0.98, 0.97, undefined, 'ease-out'),
      kf(d * 0.40, isSide ? 11 : 5.2, 0, -2.5, 1.022, 1.028, undefined, 'ease-in-out'),
      kf(d * 0.76, isSide ? 9 : 4.2, 0, -1.8, 1.016, 1.02, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      kf(0, 0, 0, 0, 1, 1, undefined, 'ease-in'),
      kf(d * 0.22, 3.5, 0, 1, 1, 1, undefined, 'ease-out'),
      kf(d * 0.44, isSide ? -5.5 : -3.5, 0, -2, 1, 1, undefined, 'ease-in-out'),
      kf(d * 0.78, isSide ? -4.5 : -2.5, 0, -1.5, 1, 1, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.armR) {
    const snap = isSide ? -88 : -78
    tracks[ids.armR] = [
      kf(0, 0, 0, 0, 1, 1, 60, 'ease-in'),
      kf(d * 0.20, 16, 0, 0, 1, 1, 60, 'ease-out'),
      kf(d * 0.39, snap, 0, 0, 1, 1, 65, 'ease-in-out'),
      kf(d * 0.46, snap + 3, 0, 0, 1, 1, 65, 'ease-in-out'),
      kf(d * 0.76, snap, 0, 0, 1, 1, 65, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, 60, 'ease-in-out')
    ]
  }
  if (ids.forearmR) {
    tracks[ids.forearmR] = [
      kf(0, 0, 0, 0, 1, 1, 20, 'ease-in'),
      kf(d * 0.22, -26, 0, 0, 1, 1, 20, 'ease-out'),
      kf(d * 0.43, -8, 0, 0, 1, 1, 25, 'ease-in-out'),
      kf(d * 0.78, -6, 0, 0, 1, 1, 25, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, 20, 'ease-in-out')
    ]
  }
  if (ids.handR) tracks[ids.handR] = [kf(0, 0), kf(d * 0.24, -18), kf(d * 0.46, 6), kf(d * 0.78, 4), kf(d, 0)]
  if (ids.armL) tracks[ids.armL] = [kf(0, 0, 0, 0, 1, 1, 45), kf(d * 0.22, 12, 0, 0, 1, 1, 45), kf(d * 0.42, 26, 0, 0, 1, 1, 45), kf(d * 0.76, 22, 0, 0, 1, 1, 45), kf(d, 0)]
  if (ids.forearmL) tracks[ids.forearmL] = [kf(0, 0), kf(d * 0.45, -20), kf(d * 0.76, -16), kf(d, 0)]
  return fillRestTracks(bones, tracks, d)
}
