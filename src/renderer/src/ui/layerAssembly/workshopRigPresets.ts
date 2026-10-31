import { generateWalkCycle, generateRunCycle } from './workshopWalkCycle'
export { generateWalkCycle, generateRunCycle } from './workshopWalkCycle'
import {
  createFullHumanoidBones,
  createHandDetailedBones,
  createFootDetailedBones,
  generateHandFistClench,
  generateFootHeelToeRoll
} from './workshopHandFootRig'
export {
  createFullHumanoidBones,
  createHandDetailedBones,
  createFootDetailedBones,
  generateHandFistClench,
  generateFootHeelToeRoll
} from './workshopHandFootRig'
import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'
import { weldConnectedLimbBones } from './mohoRigHelpers'

/** Preset humanoid 2D armature in workshop coordinates (origin 0,0 at center), with welded parent-child joints. */
export function createHumanoidBones(): LayerBone[] {
  return weldConnectedLimbBones([
    { id: 'bone-pelvis', name: 'Hông (Root)', x: 0, y: 30, length: 50, angle: -90 },
    { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: 0, y: -20, length: 65, angle: -90 },
    { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: 0, y: -85, length: 60, angle: -90 },
    { id: 'bone-arm-l', name: 'Bắp tay trái', parentId: 'bone-torso', x: -35, y: -70, length: 55, angle: 95 },
    { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -38, y: -15, length: 50, angle: 90 },
    { id: 'bone-hand-l', name: 'Bàn tay trái', parentId: 'bone-forearm-l', x: -38, y: 35, length: 25, angle: 90 },
    { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: 35, y: -70, length: 55, angle: 85 },
    { id: 'bone-forearm-r', name: 'Cẳng tay phải', parentId: 'bone-arm-r', x: 38, y: -15, length: 50, angle: 90 },
    { id: 'bone-hand-r', name: 'Bàn tay phải', parentId: 'bone-forearm-r', x: 38, y: 35, length: 25, angle: 90 },
    { id: 'bone-thigh-l', name: 'Đùi trái', parentId: 'bone-pelvis', x: -25, y: 35, length: 70, angle: 90 },
    { id: 'bone-shin-l', name: 'Cẳng chân trái', parentId: 'bone-thigh-l', x: -25, y: 105, length: 70, angle: 90 },
    { id: 'bone-foot-l', name: 'Bàn chân trái', parentId: 'bone-shin-l', x: -25, y: 175, length: 30, angle: 180 },
    { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: 25, y: 35, length: 70, angle: 90 },
    { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: 25, y: 105, length: 70, angle: 90 },
    { id: 'bone-foot-r', name: 'Bàn chân phải', parentId: 'bone-shin-r', x: 25, y: 175, length: 30, angle: 0 }
  ])
}

/** Simple 3-bone chain for plants, tails, ropes or branches. */
export function createSimpleChainBones(): LayerBone[] {
  return weldConnectedLimbBones([
    { id: 'bone-chain-root', name: 'Khớp gốc', x: 0, y: 120, length: 80, angle: -90 },
    { id: 'bone-chain-mid', name: 'Khớp giữa', parentId: 'bone-chain-root', x: 0, y: 40, length: 80, angle: -90 },
    { id: 'bone-chain-tip', name: 'Khớp ngọn', parentId: 'bone-chain-mid', x: 0, y: -40, length: 75, angle: -90 }
  ])
}

export type ProceduralMotionPreset =
  | 'walk'
  | 'idle'
  | 'wave'
  | 'bow'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'action'
  | 'sway'
  | 'hand-clench'
  | 'foot-roll'

export interface MotionPresetInfo {
  id: ProceduralMotionPreset
  name: string
  icon: string
  duration: number
  description: string
}

export const MOTION_PRESETS: MotionPresetInfo[] = [
  { id: 'walk', name: 'Bước đi (Walk)', icon: '🚶', duration: 1.6, description: 'Chân trụ tiếp đất, nhịp chuyển trọng tâm, đánh tay tự nhiên theo góc nhìn' },
  { id: 'idle', name: 'Đứng thở (Idle)', icon: '🌬️', duration: 2.4, description: 'Nhịp thở lồng ngực phồng nhẹ, vai & hai tay thả lỏng đối xứng tự nhiên' },
  { id: 'wave', name: 'Vẫy tay chào (Wave)', icon: '👋', duration: 1.8, description: 'Đưa tay lên ngang vai vẫy chào thân thiện, đầu nghiêng mỉm cười' },
  { id: 'bow', name: 'Cúi chào (Bow)', icon: '🙇', duration: 2.0, description: 'Gập thân & gật đầu cúi chào trang trọng (phối cảnh 2.5D chuẩn góc nhìn)' },
  { id: 'run', name: 'Chạy nhanh (Run)', icon: '🏃', duration: 1.0, description: 'Sải chân dứt khoát, tay vung nhịp nhanh giàu năng lượng' },
  { id: 'jump', name: 'Nhún nhảy (Jump)', icon: '🦘', duration: 1.4, description: 'Chùng hai gối đối xứng lấy đà bật nhảy vươn tay rồi tiếp đất êm ái' },
  { id: 'fall', name: 'Vấp ngã (Trip & Fall)', icon: '💥', duration: 1.8, description: 'Khựng chân mất thăng bằng, vung hai tay và khuỵu xuống chống sàn' },
  { id: 'land', name: 'Tiếp đất (Land)', icon: '🧘', duration: 1.2, description: 'Rơi tiếp đất giảm chấn, chùng hai gối hạ trọng tâm rồi đứng thẳng dậy' },
  { id: 'action', name: 'Vung đòn (Action)', icon: '⚔️', duration: 1.5, description: 'Xoay vai lấy đà vung chém chéo qua thân uy lực, dứt khoát' },
  { id: 'sway', name: 'Uốn lượn (Sway)', icon: '🌊', duration: 2.0, description: 'Lượn sóng dẻo dai cho cành lá, cây cối, tóc hoặc đuôi' },
  { id: 'hand-clench', name: 'Nắm & Xòe bàn tay (Hand Clench)', icon: '✊', duration: 2.0, description: 'Diễn hoạt bàn tay: uốn cong các ngón thành nắm đấm rồi thả lỏng' },
  { id: 'foot-roll', name: 'Nhón chân & Chạm gót (Heel-Toe Roll)', icon: '🩰', duration: 2.0, description: 'Diễn hoạt cổ chân & bàn chân: chạm gót, đặt phẳng và nhón mũi chân' }
]

function k(
  time: number,
  rotation: number,
  x = 0,
  y = 0,
  scaleX = 1,
  scaleY = 1,
  zOrder?: number
): BoneKeyframe {
  return {
    time: Number(time.toFixed(3)),
    rotation: Number(rotation.toFixed(2)),
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    scaleX: Number(scaleX.toFixed(3)),
    scaleY: Number(scaleY.toFixed(3)),
    ...(zOrder !== undefined && Math.abs(zOrder) > 1e-4 ? { zOrder: Number(zOrder.toFixed(1)) } : {}),
    easing: 'smooth'
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

function fillRestTracks(bones: LayerBone[], tracks: Record<string, BoneKeyframe[]>, d: number) {
  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [k(0, 0), k(d * 0.5, 0), k(d, 0)]
    }
  }
  return tracks
}

function resolveBodyIds(bones: LayerBone[]) {
  return {
    pelvis: findBoneId(bones, ['pelvis', 'hông', 'root']),
    torso: findBoneId(bones, ['torso', 'thân', 'ngực']),
    head: findBoneId(bones, ['head', 'đầu']),
    armL: findBoneId(bones, ['arm-l', 'arm_l', 'bắp tay trái', 'upperarm-l']),
    armR: findBoneId(bones, ['arm-r', 'arm_r', 'bắp tay phải', 'upperarm-r']),
    forearmL: findBoneId(bones, ['forearm-l', 'forearm_l', 'cẳng tay trái', 'lowerarm-l']),
    forearmR: findBoneId(bones, ['forearm-r', 'forearm_r', 'cẳng tay phải', 'lowerarm-r']),
    handL: findBoneId(bones, ['hand-l', 'hand_l', 'bàn tay trái']),
    handR: findBoneId(bones, ['hand-r', 'hand_r', 'bàn tay phải']),
    thighL: findBoneId(bones, ['thigh-l', 'thigh_l', 'đùi trái']),
    thighR: findBoneId(bones, ['thigh-r', 'thigh_r', 'đùi phải']),
    shinL: findBoneId(bones, ['shin-l', 'shin_l', 'cẳng chân trái']),
    shinR: findBoneId(bones, ['shin-r', 'shin_r', 'cẳng chân phải']),
    footL: findBoneId(bones, ['foot-l', 'foot_l', 'bàn chân trái']),
    footR: findBoneId(bones, ['foot-r', 'foot_r', 'bàn chân phải'])
  }
}

/** 1. Đứng thở tự nhiên (Idle Breathe) — đối xứng chính diện 0°, lồng ngực phồng nhẹ, hai tay mở nhịp thở. */
export function generateIdleBreathe(
  bones: LayerBone[],
  duration = 2.4,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isHumanoid = Boolean(ids.torso || ids.armL || ids.armR)

  if (!isHumanoid) {
    for (const [idx, b] of bones.entries()) {
      const amp = !b.parentId ? 1.2 : 2.2 + (idx % 2)
      tracks[b.id] = [k(0, 0), k(d * 0.5, amp, 0, !b.parentId ? -2 : 0), k(d, 0)]
    }
    return tracks
  }

  // Hông (pelvis) và toàn bộ hai chân (đùi, cẳng chân, bàn chân) giữ cố định bám mặt đất 100%,
  // chỉ phần thân trên (ngực torso, đầu, hai vai/tay) nở nhẹ theo nhịp hít thở để không bị cảm giác bay bổng.
  const sideLean = viewAngle === 'side' ? 2.2 : viewAngle === 'diagonal' ? 1.1 : 0.75
  if (ids.pelvis) {
    tracks[ids.pelvis] = [k(0, 0, 0, 0), k(d * 0.5, 0, 0, 0), k(d, 0, 0, 0)]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      k(0, 0, 0, 0, 1, 1),
      k(d * 0.25, sideLean * 0.5, 0, -1.6, 1.012, 1.01),
      k(d * 0.5, sideLean, 0, -3.4, 1.026, 1.022),
      k(d * 0.75, -sideLean * 0.35, 0, -1.4, 1.01, 1.008),
      k(d, 0, 0, 0, 1, 1)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      k(0, 0, 0, 0),
      k(d * 0.55, viewAngle === 'side' ? -1.8 : -1.1, 0, -2.0),
      k(d, 0, 0, 0)
    ]
  }
  // Hai vai/tay nâng mở nhẹ khi ngực hít vào, hạ mềm khi thở ra
  const armOpen = viewAngle === 'side' ? -2.6 : 2.8
  if (ids.armL) tracks[ids.armL] = [k(0, 0, 0, 0), k(d * 0.5, armOpen, 0, -1.5), k(d, 0, 0, 0)]
  if (ids.armR) tracks[ids.armR] = [k(0, 0, 0, 0), k(d * 0.5, viewAngle === 'side' ? -2.6 : -armOpen, 0, -1.5), k(d, 0, 0, 0)]
  if (ids.forearmL) tracks[ids.forearmL] = [k(0, 0), k(d * 0.55, -2.0), k(d, 0)]
  if (ids.forearmR) tracks[ids.forearmR] = [k(0, 0), k(d * 0.55, viewAngle === 'side' ? -2.0 : 2.0), k(d, 0)]
  if (ids.handL) tracks[ids.handL] = [k(0, 0), k(d * 0.55, 2.2), k(d, 0)]
  if (ids.handR) tracks[ids.handR] = [k(0, 0), k(d * 0.55, -2.2), k(d, 0)]

  return fillRestTracks(bones, tracks, d)
}

/** 2. Vẫy tay chào (Wave Hand) — đưa tay phải lên ngang vai gập cẳng tay vẫy chào chính diện tự nhiên. */
export function generateWaveHand(
  bones: LayerBone[],
  duration = 1.8,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isSide = viewAngle === 'side'

  if (ids.pelvis) tracks[ids.pelvis] = [k(0, 0, 0, 0), k(d * 0.5, 0, isSide ? 0 : -2, -1.5), k(d, 0, 0, 0)]
  if (ids.torso) {
    tracks[ids.torso] = [
      k(0, -2),
      k(d * 0.25, -3.5),
      k(d * 0.5, -1.5),
      k(d * 0.75, -3.5),
      k(d, -2)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      k(0, 2, 0, 0),
      k(d * 0.25, 4.5, 0, -2),
      k(d * 0.5, 1.5, 0, 0),
      k(d * 0.75, 4.5, 0, -2),
      k(d, 2, 0, 0)
    ]
  }
  if (ids.armR) {
    const baseRaise = isSide ? -96 : -116
    // Đưa bắp tay phải nổi lên phía trước thân (cẳng tay & bàn tay tự động kế thừa zOrder của bắp tay)
    tracks[ids.armR] = [
      k(0, baseRaise, 0, 0, 1, 1, 55),
      k(d * 0.25, baseRaise - 6, 0, 0, 1, 1, 55),
      k(d * 0.5, baseRaise + 5, 0, 0, 1, 1, 55),
      k(d * 0.75, baseRaise - 6, 0, 0, 1, 1, 55),
      k(d, baseRaise, 0, 0, 1, 1, 55)
    ]
  }
  if (ids.forearmR) {
    const bend = isSide ? -28 : -36
    tracks[ids.forearmR] = [
      k(0, bend, 0, 0, 1, 1, 30),
      k(d * 0.25, bend - 26, 0, 0, 1, 1, 30),
      k(d * 0.5, bend + 24, 0, 0, 1, 1, 30),
      k(d * 0.75, bend - 26, 0, 0, 1, 1, 30),
      k(d, bend, 0, 0, 1, 1, 30)
    ]
  }
  if (ids.handR) {
    tracks[ids.handR] = [
      k(0, 0),
      k(d * 0.25, -24),
      k(d * 0.5, 24),
      k(d * 0.75, -24),
      k(d, 0)
    ]
  }
  // Tay trái thả lỏng đối trọng nhẹ
  if (ids.armL) tracks[ids.armL] = [k(0, 6), k(d * 0.5, 9), k(d, 6)]
  if (ids.forearmL) tracks[ids.forearmL] = [k(0, -8), k(d * 0.5, -11), k(d, -8)]

  return fillRestTracks(bones, tracks, d)
}

/**
 * 3. Cúi chào lịch thiệp (Polite Bow):
 * - Chính diện `0°`: phối cảnh foreshortening 2.5D (thân thu ngắn dọc `scaleY: 0.80`, đầu gật xuống `y: +26`, hai tay khép gọn đối xứng trước bụng) thay vì nghiêng người sang phải!
 * - Chéo `45°` / Ngang `90°`: pha góc gập thân về phía trước đúng hướng mặt nhân vật.
 */
export function generateBow(
  bones: LayerBone[],
  duration = 2.0,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)

  if (viewAngle === 'side') {
    if (ids.pelvis) tracks[ids.pelvis] = [k(0, 0), k(d * 0.42, 0, -4, 6), k(d * 0.65, 0, -4, 6), k(d, 0)]
    if (ids.torso) tracks[ids.torso] = [k(0, 0), k(d * 0.42, 28), k(d * 0.65, 28), k(d, 0)]
    if (ids.head) tracks[ids.head] = [k(0, 0), k(d * 0.42, 16), k(d * 0.65, 16), k(d, 0)]
    if (ids.armL) tracks[ids.armL] = [k(0, 0), k(d * 0.42, 14), k(d * 0.65, 14), k(d, 0)]
    if (ids.armR) tracks[ids.armR] = [k(0, 0), k(d * 0.42, 14), k(d * 0.65, 14), k(d, 0)]
    return fillRestTracks(bones, tracks, d)
  }

  const isDiag = viewAngle === 'diagonal'
  const torsoTilt = isDiag ? 11 : 0
  const torsoSy = isDiag ? 0.87 : 0.8
  const headDropY = isDiag ? 18 : 26
  const headTilt = isDiag ? 8 : 0

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      k(0, 0, 0, 0),
      k(d * 0.42, 0, 0, 9),
      k(d * 0.66, 0, 0, 9),
      k(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      k(0, 0, 0, 0, 1, 1),
      k(d * 0.42, torsoTilt, 0, 13, 1.02, torsoSy),
      k(d * 0.66, torsoTilt, 0, 13, 1.02, torsoSy),
      k(d, 0, 0, 0, 1, 1)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      k(0, 0, 0, 0, 1, 1),
      k(d * 0.44, headTilt, isDiag ? 6 : 0, headDropY, 1, 0.93),
      k(d * 0.66, headTilt, isDiag ? 6 : 0, headDropY, 1, 0.93),
      k(d, 0, 0, 0, 1, 1)
    ]
  }
  // Hai tay khép lịch sự trước bụng (nâng zOrder trên bắp tay để cả cẳng tay & bàn tay nổi trước thân áo)
  if (ids.armL) {
    tracks[ids.armL] = [
      k(0, 0),
      k(d * 0.42, -9, 2, 6, 1, 1, 50),
      k(d * 0.66, -9, 2, 6, 1, 1, 50),
      k(d, 0)
    ]
  }
  if (ids.armR) {
    tracks[ids.armR] = [
      k(0, 0),
      k(d * 0.42, 9, -2, 6, 1, 1, 50),
      k(d * 0.66, 9, -2, 6, 1, 1, 50),
      k(d, 0)
    ]
  }
  if (ids.forearmL) tracks[ids.forearmL] = [k(0, 0), k(d * 0.42, -18), k(d * 0.66, -18), k(d, 0)]
  if (ids.forearmR) tracks[ids.forearmR] = [k(0, 0), k(d * 0.42, 18), k(d * 0.66, 18), k(d, 0)]

  return fillRestTracks(bones, tracks, d)
}

/**
 * 4. Nhún nhảy bật cao (Athletic Jump):
 * - Chính diện `0°`: hai gối mở đối xứng khi chùng chân lấy đà (`thighL +16°`, `thighR -16°`, `shin scaleY 0.88`),
 *   khi bật lên hai tay vươn cao đối xứng chữ V (`armL +124°`, `armR -124°`) thay vì lắc lệch cùng chiều sang một bên!
 */
export function generateJump(
  bones: LayerBone[],
  duration = 1.4,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isSide = viewAngle === 'side'

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      k(0, 0, 0, 0),
      k(d * 0.24, 0, 0, 22),
      k(d * 0.54, 0, 0, -46),
      k(d * 0.84, 0, 0, 15),
      k(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      k(0, 0, 0, 0, 1, 1),
      k(d * 0.24, isSide ? 12 : 0, 0, 5, 1.04, 0.92),
      k(d * 0.54, isSide ? -8 : 0, 0, -4, 0.97, 1.05),
      k(d * 0.84, isSide ? 8 : 0, 0, 3, 1.03, 0.94),
      k(d, 0, 0, 0, 1, 1)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      k(0, 0, 0, 0),
      k(d * 0.24, isSide ? 6 : 0, 0, 6),
      k(d * 0.54, isSide ? -6 : 0, 0, -5),
      k(d * 0.84, 0, 0, 4),
      k(d, 0, 0, 0)
    ]
  }

  if (isSide) {
    for (const t of [ids.thighL, ids.thighR]) {
      if (t) tracks[t] = [k(0, 0), k(d * 0.24, -22), k(d * 0.54, 14), k(d * 0.84, -16), k(d, 0)]
    }
    for (const s of [ids.shinL, ids.shinR]) {
      if (s) tracks[s] = [k(0, 0), k(d * 0.24, 30), k(d * 0.54, -10), k(d * 0.84, 22), k(d, 0)]
    }
    for (const a of [ids.armL, ids.armR]) {
      if (a) tracks[a] = [k(0, 0), k(d * 0.24, 28), k(d * 0.54, -110), k(d * 0.84, 18), k(d, 0)]
    }
  } else {
    if (ids.thighL) tracks[ids.thighL] = [k(0, 0), k(d * 0.24, 16, 0, 0, 1, 0.9), k(d * 0.54, 7, 0, 0, 1, 1.03), k(d * 0.84, 12, 0, 0, 1, 0.92), k(d, 0)]
    if (ids.thighR) tracks[ids.thighR] = [k(0, 0), k(d * 0.24, -16, 0, 0, 1, 0.9), k(d * 0.54, -7, 0, 0, 1, 1.03), k(d * 0.84, -12, 0, 0, 1, 0.92), k(d, 0)]
    if (ids.shinL) tracks[ids.shinL] = [k(0, 0), k(d * 0.24, -14, 0, -4, 1, 0.88), k(d * 0.54, -4, 0, 0, 1, 1.02), k(d * 0.84, -10, 0, -3, 1, 0.92), k(d, 0)]
    if (ids.shinR) tracks[ids.shinR] = [k(0, 0), k(d * 0.24, 14, 0, -4, 1, 0.88), k(d * 0.54, 4, 0, 0, 1, 1.02), k(d * 0.84, 10, 0, -3, 1, 0.92), k(d, 0)]
    if (ids.footL) tracks[ids.footL] = [k(0, 0), k(d * 0.24, -6), k(d * 0.54, -18), k(d * 0.84, -4), k(d, 0)]
    if (ids.footR) tracks[ids.footR] = [k(0, 0), k(d * 0.24, 6), k(d * 0.54, 18), k(d * 0.84, 4), k(d, 0)]
    // Hai tay mở lấy đà rồi vươn cao chữ V đối xứng
    if (ids.armL) tracks[ids.armL] = [k(0, 0), k(d * 0.24, 24), k(d * 0.54, 122), k(d * 0.84, 26), k(d, 0)]
    if (ids.armR) tracks[ids.armR] = [k(0, 0), k(d * 0.24, -24), k(d * 0.54, -122), k(d * 0.84, -26), k(d, 0)]
    if (ids.forearmL) tracks[ids.forearmL] = [k(0, 0), k(d * 0.24, 20), k(d * 0.54, 16), k(d * 0.84, 14), k(d, 0)]
    if (ids.forearmR) tracks[ids.forearmR] = [k(0, 0), k(d * 0.24, -20), k(d * 0.54, -16), k(d * 0.84, -14), k(d, 0)]
  }

  return fillRestTracks(bones, tracks, d)
}

/** Generate fast run cycle animation keys. */
export function generateRun(
  bones: LayerBone[],
  duration = 1.0,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  return generateRunCycle(bones, duration, viewAngle)
}

/**
 * 5. Vung đòn uy lực (Action Slash):
 * - Chính diện `0°`: chân xuống tấn đối xứng, vai xoay lấy đà giương cao tay phải chéo lên trên rồi chém xiên mạnh qua trước ngực, tay trái giữ thế đối trọng.
 */
export function generateActionSlash(
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
      k(0, 0, 0, 0),
      k(d * 0.32, -2, -4, 10),
      k(d * 0.56, 3, 6, 14),
      k(d * 0.76, 2, 4, 10),
      k(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      k(0, 0, 0, 0, 1, 1),
      k(d * 0.32, isSide ? -16 : -7, 0, 2, 0.96, 1.02),
      k(d * 0.56, isSide ? 22 : 9, 0, 5, 1.04, 0.94),
      k(d * 0.76, isSide ? 14 : 5, 0, 3, 1.01, 0.97),
      k(d, 0, 0, 0, 1, 1)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      k(0, 0, 0, 0),
      k(d * 0.32, 4, 0, 0),
      k(d * 0.56, -6, 0, 5),
      k(d, 0, 0, 0)
    ]
  }
  if (ids.armR) {
    // Lấy đà ra sau (-20) rồi vung chém xiên mạnh qua phía trước ngực (+60, cẳng tay & bàn tay ăn theo)
    tracks[ids.armR] = [
      k(0, 0),
      k(d * 0.32, -124, 0, 0, 1, 1, -20),
      k(d * 0.54, 48, 0, 0, 1, 1, 60),
      k(d * 0.76, 32, 0, 0, 1, 1, 55),
      k(d, 0)
    ]
  }
  if (ids.forearmR) {
    tracks[ids.forearmR] = [
      k(0, 0),
      k(d * 0.32, -34),
      k(d * 0.54, 26),
      k(d * 0.76, 14),
      k(d, 0)
    ]
  }
  if (ids.handR) {
    tracks[ids.handR] = [k(0, 0), k(d * 0.32, -24), k(d * 0.54, 42), k(d * 0.76, 16), k(d, 0)]
  }
  // Tay trái thủ thế mở ngang bên trái giữ thăng bằng
  if (ids.armL) {
    tracks[ids.armL] = [k(0, 0), k(d * 0.32, 34), k(d * 0.56, 54), k(d * 0.76, 38), k(d, 0)]
  }
  if (ids.forearmL) {
    tracks[ids.forearmL] = [k(0, 0), k(d * 0.32, -28), k(d * 0.56, 18), k(d, 0)]
  }
  // Hai chân trụ tấn vững vàng
  if (!isSide) {
    if (ids.thighL) tracks[ids.thighL] = [k(0, 0), k(d * 0.32, 12), k(d * 0.56, 18), k(d, 0)]
    if (ids.thighR) tracks[ids.thighR] = [k(0, 0), k(d * 0.32, -12), k(d * 0.56, -16), k(d, 0)]
    if (ids.shinL) tracks[ids.shinL] = [k(0, 0), k(d * 0.56, -10), k(d, 0)]
    if (ids.shinR) tracks[ids.shinR] = [k(0, 0), k(d * 0.56, 10), k(d, 0)]
  }

  return fillRestTracks(bones, tracks, d)
}

/** 6. Uốn lượn mềm mại (Sway) cho cây cối, cành lá, đuôi, áo choàng. */
export function generateSway(bones: LayerBone[], duration = 2.0): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  for (const [idx, b] of bones.entries()) {
    const factor = (idx + 1) * 4
    tracks[b.id] = [k(0, -factor), k(d * 0.5, factor), k(d, -factor)]
  }
  return tracks
}

/**
 * 7. Vấp ngã (Trip & Fall):
 * - Chính diện `0°`: khựng chân mất đà, hai tay vung rộng sang hai bên rồi khuỵu hai gối sụp xuống chống hai tay xuống đất (không bị xoay ngang cả người 75° như góc 90°).
 */
export function generateTripAndFall(
  bones: LayerBone[],
  duration = 1.8,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)

  if (viewAngle === 'side') {
    if (ids.pelvis) {
      tracks[ids.pelvis] = [k(0, 0), k(d * 0.25, 20, 20, 15), k(d * 0.58, 65, 45, 92), k(d, 68, 48, 95)]
    }
    if (ids.torso) tracks[ids.torso] = [k(0, 0), k(d * 0.25, 28), k(d * 0.58, 52), k(d, 48)]
    if (ids.head) tracks[ids.head] = [k(0, 0), k(d * 0.25, -18), k(d * 0.58, -32), k(d, -24)]
    if (ids.thighL) tracks[ids.thighL] = [k(0, 0), k(d * 0.25, -38), k(d * 0.58, -58), k(d, -54)]
    if (ids.thighR) tracks[ids.thighR] = [k(0, 0), k(d * 0.25, 24), k(d * 0.58, -45), k(d, -48)]
    if (ids.armL) tracks[ids.armL] = [k(0, 0), k(d * 0.25, -60), k(d * 0.58, -82), k(d, -74)]
    if (ids.armR) tracks[ids.armR] = [k(0, 0), k(d * 0.25, -55), k(d * 0.58, -78), k(d, -70)]
    return fillRestTracks(bones, tracks, d)
  }

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      k(0, 0, 0, 0),
      k(d * 0.22, -5, 6, -8),
      k(d * 0.56, 3, 2, 74),
      k(d * 0.74, 1, 0, 68),
      k(d, 2, 0, 72)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      k(0, 0, 0, 0, 1, 1),
      k(d * 0.22, -8, 0, -4, 1.02, 1.02),
      k(d * 0.56, 4, 0, 18, 1.05, 0.78),
      k(d * 0.74, 2, 0, 15, 1.03, 0.81),
      k(d, 3, 0, 17, 1.04, 0.79)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      k(0, 0, 0, 0),
      k(d * 0.22, 10, 0, -6),
      k(d * 0.56, -4, 0, 26),
      k(d * 0.74, 2, 0, 18),
      k(d, 0, 0, 22)
    ]
  }
  // Lúc vấp: hai tay vung bấn loạn sang 2 bên -> lúc ngã: chống 2 tay xuống trước ngực
  if (ids.armL) tracks[ids.armL] = [k(0, 0), k(d * 0.22, 78), k(d * 0.56, 26, 6, 12), k(d, 24, 6, 12)]
  if (ids.armR) tracks[ids.armR] = [k(0, 0), k(d * 0.22, -84), k(d * 0.56, -26, -6, 12), k(d, -24, -6, 12)]
  if (ids.forearmL) tracks[ids.forearmL] = [k(0, 0), k(d * 0.22, 24), k(d * 0.56, -28), k(d, -24)]
  if (ids.forearmR) tracks[ids.forearmR] = [k(0, 0), k(d * 0.22, -24), k(d * 0.56, 28), k(d, 24)]
  // Hai chân khuỵu gập gối xuống sàn
  if (ids.thighL) tracks[ids.thighL] = [k(0, 0), k(d * 0.22, 22), k(d * 0.56, 38, 0, 0, 1, 0.72), k(d, 36, 0, 0, 1, 0.72)]
  if (ids.thighR) tracks[ids.thighR] = [k(0, 0), k(d * 0.22, -10), k(d * 0.56, -38, 0, 0, 1, 0.72), k(d, -36, 0, 0, 1, 0.72)]
  if (ids.shinL) tracks[ids.shinL] = [k(0, 0), k(d * 0.22, -18), k(d * 0.56, -46, 0, -10, 1, 0.65), k(d, -44, 0, -10, 1, 0.65)]
  if (ids.shinR) tracks[ids.shinR] = [k(0, 0), k(d * 0.22, 26), k(d * 0.56, 46, 0, -10, 1, 0.65), k(d, 44, 0, -10, 1, 0.65)]

  return fillRestTracks(bones, tracks, d)
}

/**
 * 8. Tiếp đất giảm chấn (Heroic / Athletic Landing):
 * - Chính diện `0°`: chạm đất chùng sâu hai gối đối xứng, hai tay dang giữ thăng bằng, đầu & thân nhún xuống rồi đứng thẳng dậy.
 */
export function generateLand(
  bones: LayerBone[],
  duration = 1.2,
  viewAngle: MotionViewAngle = 'front'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const isSide = viewAngle === 'side'

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      k(0, 0, 0, -18),
      k(d * 0.34, 0, 0, 34),
      k(d * 0.72, 0, 0, 8),
      k(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      k(0, 0, 0, -3, 0.98, 1.03),
      k(d * 0.34, isSide ? 20 : 0, 0, 8, 1.05, 0.87),
      k(d * 0.72, isSide ? 6 : 0, 0, 2, 1.01, 0.97),
      k(d, 0, 0, 0, 1, 1)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      k(0, 0, 0, -3),
      k(d * 0.38, isSide ? 10 : 0, 0, 11),
      k(d * 0.74, 0, 0, 2),
      k(d, 0, 0, 0)
    ]
  }

  if (isSide) {
    for (const t of [ids.thighL, ids.thighR]) if (t) tracks[t] = [k(0, 6), k(d * 0.34, -26), k(d, 0)]
    for (const s of [ids.shinL, ids.shinR]) if (s) tracks[s] = [k(0, -4), k(d * 0.34, 36), k(d, 0)]
    for (const a of [ids.armL, ids.armR]) if (a) tracks[a] = [k(0, -35), k(d * 0.34, 26), k(d, 0)]
  } else {
    if (ids.thighL) tracks[ids.thighL] = [k(0, 5), k(d * 0.34, 22, 0, 0, 1, 0.86), k(d * 0.72, 6, 0, 0, 1, 0.96), k(d, 0)]
    if (ids.thighR) tracks[ids.thighR] = [k(0, -5), k(d * 0.34, -22, 0, 0, 1, 0.86), k(d * 0.72, -6, 0, 0, 1, 0.96), k(d, 0)]
    if (ids.shinL) tracks[ids.shinL] = [k(0, -3), k(d * 0.34, -18, 0, -6, 1, 0.85), k(d * 0.72, -5), k(d, 0)]
    if (ids.shinR) tracks[ids.shinR] = [k(0, 3), k(d * 0.34, 18, 0, -6, 1, 0.85), k(d * 0.72, 5), k(d, 0)]
    if (ids.armL) tracks[ids.armL] = [k(0, 48), k(d * 0.34, 34), k(d * 0.72, 10), k(d, 0)]
    if (ids.armR) tracks[ids.armR] = [k(0, -48), k(d * 0.34, -34), k(d * 0.72, -10), k(d, 0)]
    if (ids.forearmL) tracks[ids.forearmL] = [k(0, 14), k(d * 0.34, 24), k(d, 0)]
    if (ids.forearmR) tracks[ids.forearmR] = [k(0, -14), k(d * 0.34, -24), k(d, 0)]
  }

  return fillRestTracks(bones, tracks, d)
}

/** Tạo một AnimationClip hoàn chỉnh từ preset theo góc nhìn `viewAngle` (`front` | `diagonal` | `side` | `back`). */
export function createClipFromPreset(
  preset: ProceduralMotionPreset,
  bones: LayerBone[],
  customName?: string,
  viewAngle: MotionViewAngle = 'front'
): AnimationClip {
  const meta = MOTION_PRESETS.find((p) => p.id === preset)
  const duration = meta?.duration ?? 1.8
  let tracks: Record<string, BoneKeyframe[]> = {}

  switch (preset) {
    case 'walk':
      tracks = generateWalkCycle(bones, duration, viewAngle)
      break
    case 'idle':
      tracks = generateIdleBreathe(bones, duration, viewAngle)
      break
    case 'wave':
      tracks = generateWaveHand(bones, duration, viewAngle)
      break
    case 'bow':
      tracks = generateBow(bones, duration, viewAngle)
      break
    case 'run':
      tracks = generateRunCycle(bones, duration, viewAngle)
      break
    case 'jump':
      tracks = generateJump(bones, duration, viewAngle)
      break
    case 'fall':
      tracks = generateTripAndFall(bones, duration, viewAngle)
      break
    case 'land':
      tracks = generateLand(bones, duration, viewAngle)
      break
    case 'action':
      tracks = generateActionSlash(bones, duration, viewAngle)
      break
    case 'sway':
      tracks = generateSway(bones, duration)
      break
    case 'hand-clench':
      tracks = generateHandFistClench(bones, duration)
      break
    case 'foot-roll':
      tracks = generateFootHeelToeRoll(bones, duration)
      break
  }

  const thigh = bones.find((b) => b.id === 'bone-thigh-l')
  const shin = bones.find((b) => b.id === 'bone-shin-l')
  if (thigh || shin) {
    const legLen = (thigh?.length ?? 70) + (shin?.length ?? 70)
    const scaleRatio = Math.max(0.25, Math.min(2.5, legLen / 140))
    if (Math.abs(scaleRatio - 1) > 0.05) {
      const scaledTracks: Record<string, BoneKeyframe[]> = {}
      for (const [boneId, keys] of Object.entries(tracks)) {
        scaledTracks[boneId] = keys.map((kf) => ({
          ...kf,
          x: Number((kf.x * scaleRatio).toFixed(2)),
          y: Number((kf.y * scaleRatio).toFixed(2))
        }))
      }
      tracks = scaledTracks
    }
  }

  const angleSuffix =
    viewAngle === 'side' ? ' (90°)' : viewAngle === 'diagonal' ? ' (45°)' : viewAngle === 'back' ? ' (180°)' : ''
  const name = customName || `${meta?.name || `Động tác ${preset}`}${angleSuffix}`
  const isOneShot = preset === 'bow' || preset === 'fall' || preset === 'land'
  return {
    id: `clip-${preset}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    duration,
    loop: !isOneShot,
    tracks,
    description: meta?.description,
    presetKey: preset,
    viewAngle
  }
}

/** Apply procedural preset to composite rig. */
export function applyMotionPresetToRig(
  composite: LayerComposite,
  preset: ProceduralMotionPreset,
  viewAngle: MotionViewAngle = 'front'
): LayerComposite {
  const bones = composite.rig?.bones ?? []
  if (!bones.length) return composite

  const clip = createClipFromPreset(preset, bones, undefined, viewAngle)
  const currentRig = composite.rig ?? { bones, duration: clip.duration, loop: clip.loop, tracks: {} }
  const existingClips = currentRig.clips ?? []
  const activeId = currentRig.activeClipId

  let nextClips: AnimationClip[]
  if (activeId && existingClips.some((c) => c.id === activeId)) {
    nextClips = existingClips.map((c) =>
      c.id === activeId
        ? {
            ...c,
            name: c.name === 'Động tác 1' || !c.name ? clip.name : c.name,
            duration: clip.duration,
            loop: clip.loop,
            tracks: clip.tracks,
            presetKey: preset,
            viewAngle
          }
        : c
    )
  } else if (existingClips.length > 0) {
    nextClips = existingClips.map((c, i) =>
      i === 0
        ? {
            ...c,
            name: c.name === 'Động tác 1' || !c.name ? clip.name : c.name,
            duration: clip.duration,
            loop: clip.loop,
            tracks: clip.tracks,
            presetKey: preset,
            viewAngle
          }
        : c
    )
  } else {
    nextClips = [clip]
  }

  const activeClip = nextClips.find((c) => c.id === (activeId || nextClips[0].id)) || nextClips[0]

  const nextRig: LayerRig = {
    ...currentRig,
    bones,
    duration: activeClip.duration,
    loop: activeClip.loop,
    tracks: activeClip.tracks,
    clips: nextClips,
    activeClipId: activeClip.id
  }

  return { ...composite, rig: nextRig }
}
