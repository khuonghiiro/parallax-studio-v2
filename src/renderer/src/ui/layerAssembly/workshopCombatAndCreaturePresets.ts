import type { BoneKeyframe, LayerBone, MotionViewAngle } from '@shared/layerRig'
import { weldConnectedLimbBones } from './mohoRigHelpers'
import { kf, fillRestTracks, resolveBodyIds } from './workshopMotionComicPresets'
import {
  createBirdBones,
  generateBirdWingFlap,
  generateQuadrupedWalk
} from './templates/creatureRigPresets'
import { generateWalkCycle } from './workshopWalkCycle'

function findBoneByTokens(bones: LayerBone[], tokens: string[]): string | undefined {
  for (const b of bones) {
    const idLow = b.id.toLowerCase()
    const nameLow = (b.name || '').toLowerCase()
    for (const tk of tokens) {
      if (idLow.includes(tk) || nameLow.includes(tk)) return b.id
    }
  }
  return undefined
}

/** Suy luận hướng quay mặt của khung xương (`1` = quay phải `+X`, `-1` = quay trái `-X`). */
function detectFacingSign(bones: LayerBone[], viewAngle: MotionViewAngle = 'diagonal'): 1 | -1 {
  if (viewAngle === 'back') return -1
  const pelvis = bones.find((b) => b.id.includes('pelvis') || !b.parentId)
  const head = bones.find((b) => b.id.includes('head') && !b.id.includes('jaw'))
  const birdBody = bones.find((b) => b.id === 'bone-bird-body')
  if (birdBody && head) {
    return head.x >= birdBody.x ? 1 : -1
  }
  if (pelvis && head && Math.abs(head.x - pelvis.x) > 12) {
    return head.x >= pelvis.x ? 1 : -1
  }
  return 1
}

// ---------------------------------------------------------------------------
// 1. Khung Xương Chuẩn Cho Con Vật 2.5D & Quái Vật 2.5D
// ---------------------------------------------------------------------------

/** Khung xương Thú 4 chân nhìn ngang hướng phải (+X) dành cho Linh Thú / Sói / Ngựa 2.5D. */
export function createQuadrupedRigBones(): LayerBone[] {
  return weldConnectedLimbBones([
    { id: 'bone-pelvis', name: 'Hông sau (Root)', x: -42, y: 8, length: 48, angle: 0 },
    { id: 'bone-torso', name: 'Ngực / Thân trước', parentId: 'bone-pelvis', x: 6, y: 6, length: 54, angle: -4 },
    { id: 'bone-neck', name: 'Cổ linh thú', parentId: 'bone-torso', x: 58, y: -4, length: 40, angle: -48 },
    { id: 'bone-head', name: 'Đầu & Hàm trên', parentId: 'bone-neck', x: 84, y: -32, length: 46, angle: 8 },
    { id: 'bone-jaw', name: 'Hàm dưới', parentId: 'bone-head', x: 96, y: -18, length: 30, angle: 16 },
    { id: 'bone-tail', name: 'Đuôi gốc', parentId: 'bone-pelvis', x: -58, y: 4, length: 46, angle: 148 },
    { id: 'bone-tail-tip', name: 'Đuôi ngọn', parentId: 'bone-tail', x: -96, y: 28, length: 42, angle: 128 },
    { id: 'bone-leg-fl-thigh', name: 'Đùi trước trái', parentId: 'bone-torso', x: 46, y: 22, length: 48, angle: 86 },
    { id: 'bone-leg-fl-shin', name: 'Cẳng chân trước trái', parentId: 'bone-leg-fl-thigh', x: 49, y: 70, length: 46, angle: 92 },
    { id: 'bone-leg-fr-thigh', name: 'Đùi trước phải', parentId: 'bone-torso', x: 32, y: 22, length: 48, angle: 94 },
    { id: 'bone-leg-fr-shin', name: 'Cẳng chân trước phải', parentId: 'bone-leg-fr-thigh', x: 29, y: 70, length: 46, angle: 90 },
    { id: 'bone-leg-bl-thigh', name: 'Đùi sau trái', parentId: 'bone-pelvis', x: -34, y: 22, length: 52, angle: 98 },
    { id: 'bone-leg-bl-shin', name: 'Cẳng chân sau trái', parentId: 'bone-leg-bl-thigh', x: -42, y: 73, length: 48, angle: 82 },
    { id: 'bone-leg-br-thigh', name: 'Đùi sau phải', parentId: 'bone-pelvis', x: -48, y: 22, length: 52, angle: 102 },
    { id: 'bone-leg-br-shin', name: 'Cẳng chân sau phải', parentId: 'bone-leg-br-thigh', x: -58, y: 73, length: 48, angle: 82 }
  ])
}

/** Khung xương Linh Cầm / Chim 2.5D hàn khít khớp. */
export function createWingedRigBones(): LayerBone[] {
  return createBirdBones()
}

/** Khung xương Quái Vật 2.5D (14 khớp hàn khít, hàm dưới tách rời để gầm rống & song trảo). */
export function createMonsterBones(): LayerBone[] {
  return weldConnectedLimbBones([
    { id: 'bone-pelvis', name: 'Hông quái vật (Root)', x: 0, y: 36, length: 52, angle: -95 },
    { id: 'bone-torso', name: 'Ngực vạm vỡ', parentId: 'bone-pelvis', x: -4, y: -16, length: 76, angle: -108 },
    { id: 'bone-head', name: 'Đầu sừng & Hàm trên', parentId: 'bone-torso', x: -28, y: -88, length: 54, angle: 175 },
    { id: 'bone-jaw', name: 'Hàm dưới nanh nhọn', parentId: 'bone-head', x: -42, y: -62, length: 38, angle: 172 },
    { id: 'bone-arm-r', name: 'Bắp tay trảo gần', parentId: 'bone-torso', x: 24, y: -74, length: 64, angle: 118 },
    { id: 'bone-forearm-r', name: 'Cẳng trảo gần', parentId: 'bone-arm-r', x: -6, y: -18, length: 68, angle: 145 },
    { id: 'bone-arm-l', name: 'Bắp tay trảo xa', parentId: 'bone-torso', x: -34, y: -74, length: 60, angle: 132 },
    { id: 'bone-forearm-l', name: 'Cẳng trảo xa', parentId: 'bone-arm-l', x: -74, y: -30, length: 64, angle: 156 },
    { id: 'bone-thigh-r', name: 'Đùi quái vật gần', parentId: 'bone-pelvis', x: 24, y: 40, length: 66, angle: 82 },
    { id: 'bone-shin-r', name: 'Cẳng chân móng gần', parentId: 'bone-thigh-r', x: 32, y: 105, length: 68, angle: 102 },
    { id: 'bone-thigh-l', name: 'Đùi quái vật xa', parentId: 'bone-pelvis', x: -24, y: 40, length: 66, angle: 104 },
    { id: 'bone-shin-l', name: 'Cẳng chân móng xa', parentId: 'bone-thigh-l', x: -40, y: 104, length: 68, angle: 92 },
    { id: 'bone-tail', name: 'Đuôi gai gốc', parentId: 'bone-pelvis', x: 26, y: 26, length: 58, angle: 28 },
    { id: 'bone-tail-tip', name: 'Đuôi chùy nhọn', parentId: 'bone-tail', x: 78, y: 54, length: 52, angle: -12 }
  ])
}

// ---------------------------------------------------------------------------
// 2. Động Tác Chiến Đấu Nhân Vật 2.5D (Combat, Kick, Dodge, Hit Recoil)
// ---------------------------------------------------------------------------

/** Liên hoàn trảm: thủ thế → thu đà xoay vai → chém chéo thức 1 → vung chém ngang thức 2 → hồi thế. */
export function generateCombatCombo(
  bones: LayerBone[],
  duration = 1.5,
  viewAngle: MotionViewAngle = 'diagonal'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const f = detectFacingSign(bones, viewAngle)

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, -2 * f, 0, 2),
      kf(d * 0.18, -6 * f, -6 * f, 8, 1.02, 0.96, undefined, 'ease-out'),
      kf(d * 0.42, 7 * f, 12 * f, -3, 0.98, 1.03, undefined, 'ease-out'),
      kf(d * 0.65, 2 * f, 4 * f, 6, 1.02, 0.97, undefined, 'ease-in-out'),
      kf(d * 0.84, 9 * f, 14 * f, -2, 1, 1, undefined, 'ease-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [
      kf(0, 6 * f),
      kf(d * 0.18, -14 * f),
      kf(d * 0.42, 20 * f),
      kf(d * 0.65, -8 * f),
      kf(d * 0.84, 18 * f),
      kf(d, 4 * f)
    ]
  }
  if (ids.head) {
    tracks[ids.head] = [
      kf(0, -3 * f),
      kf(d * 0.18, 8 * f),
      kf(d * 0.42, -10 * f),
      kf(d * 0.84, -8 * f),
      kf(d, 0)
    ]
  }
  // Tay gần/chính (vũ khí) vung 2 nhát dứt khoát có Z-order đưa lên trước ngực
  if (ids.armL) {
    tracks[ids.armL] = [
      kf(0, -24 * f, 0, 0, 1, 1, 16),
      kf(d * 0.18, 44 * f, 0, 0, 1, 1, 10),
      kf(d * 0.42, -92 * f, 0, 0, 1, 1, 36, 'ease-out'),
      kf(d * 0.65, -45 * f, 0, 0, 1, 1, 24),
      kf(d * 0.84, -108 * f, 0, 0, 1, 1, 38, 'ease-out'),
      kf(d, -24 * f, 0, 0, 1, 1, 16)
    ]
  }
  if (ids.forearmL) {
    tracks[ids.forearmL] = [
      kf(0, -28 * f),
      kf(d * 0.18, 32 * f),
      kf(d * 0.42, -48 * f),
      kf(d * 0.65, -18 * f),
      kf(d * 0.84, -52 * f),
      kf(d, -28 * f)
    ]
  }
  if (ids.armR) {
    tracks[ids.armR] = [
      kf(0, 16 * f),
      kf(d * 0.18, -32 * f),
      kf(d * 0.42, 42 * f),
      kf(d * 0.65, -24 * f),
      kf(d * 0.84, 38 * f),
      kf(d, 16 * f)
    ]
  }
  if (ids.forearmR) {
    tracks[ids.forearmR] = [
      kf(0, -18 * f),
      kf(d * 0.42, 26 * f),
      kf(d * 0.84, 22 * f),
      kf(d, -18 * f)
    ]
  }
  // Tấn chiến: chân trước khuỵu giữ trụ, chân sau đạp căng
  if (ids.thighL) {
    tracks[ids.thighL] = [
      kf(0, -16 * f),
      kf(d * 0.18, -24 * f),
      kf(d * 0.42, -34 * f),
      kf(d * 0.84, -38 * f),
      kf(d, -16 * f)
    ]
  }
  if (ids.shinL) {
    tracks[ids.shinL] = [
      kf(0, 22 * f),
      kf(d * 0.18, 36 * f),
      kf(d * 0.42, 34 * f),
      kf(d * 0.84, 40 * f),
      kf(d, 22 * f)
    ]
  }
  if (ids.thighR) {
    tracks[ids.thighR] = [
      kf(0, 16 * f),
      kf(d * 0.42, 30 * f),
      kf(d * 0.84, 34 * f),
      kf(d, 16 * f)
    ]
  }
  if (ids.shinR) {
    tracks[ids.shinR] = [kf(0, 8 * f), kf(d * 0.42, 10 * f), kf(d, 8 * f)]
  }
  return fillRestTracks(bones, tracks, d)
}

/** Tung cước tống thẳng (Martial Kick): lấy đà → co gối → bung cước cao → tiếp đất cân bằng. */
export function generateMartialKick(
  bones: LayerBone[],
  duration = 1.2,
  viewAngle: MotionViewAngle = 'diagonal'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const f = detectFacingSign(bones, viewAngle)

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, 0, 0, 0),
      kf(d * 0.2, 0, -4 * f, 8),
      kf(d * 0.46, -8 * f, 6 * f, -10, 1, 1, undefined, 'ease-out'),
      kf(d * 0.72, -4 * f, 4 * f, 4),
      kf(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [kf(0, 4 * f), kf(d * 0.2, 10 * f), kf(d * 0.46, -22 * f), kf(d, 4 * f)]
  }
  if (ids.head) {
    tracks[ids.head] = [kf(0, 0), kf(d * 0.2, -4 * f), kf(d * 0.46, 12 * f), kf(d, 0)]
  }
  if (ids.thighL) {
    tracks[ids.thighL] = [
      kf(0, -10 * f),
      kf(d * 0.24, -64 * f),
      kf(d * 0.46, -82 * f, 0, 0, 1, 1, 24, 'ease-out'),
      kf(d * 0.74, -40 * f),
      kf(d, -10 * f)
    ]
  }
  if (ids.shinL) {
    tracks[ids.shinL] = [kf(0, 14 * f), kf(d * 0.24, 72 * f), kf(d * 0.46, 8 * f), kf(d, 14 * f)]
  }
  if (ids.thighR) tracks[ids.thighR] = [kf(0, 10 * f), kf(d * 0.46, 18 * f), kf(d, 10 * f)]
  if (ids.shinR) tracks[ids.shinR] = [kf(0, 6 * f), kf(d * 0.2, 22 * f), kf(d * 0.46, 8 * f), kf(d, 6 * f)]
  if (ids.armL) tracks[ids.armL] = [kf(0, -16 * f), kf(d * 0.46, 46 * f), kf(d, -16 * f)]
  if (ids.armR) tracks[ids.armR] = [kf(0, 12 * f), kf(d * 0.46, -54 * f), kf(d, 12 * f)]
  return fillRestTracks(bones, tracks, d)
}

/** Né đòn & Phản kích (Dodge Counter): lách gập người né về sau rồi bật lò xo đâm kiếm tới. */
export function generateDodgeCounter(
  bones: LayerBone[],
  duration = 1.25,
  viewAngle: MotionViewAngle = 'diagonal'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const f = detectFacingSign(bones, viewAngle)

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, 0, 0, 0),
      kf(d * 0.28, -8 * f, -14 * f, 10, 1.03, 0.94, undefined, 'ease-out'),
      kf(d * 0.62, 8 * f, 16 * f, -4, 0.98, 1.02, undefined, 'ease-out'),
      kf(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [kf(0, 2 * f), kf(d * 0.28, -24 * f), kf(d * 0.62, 22 * f), kf(d, 2 * f)]
  }
  if (ids.head) {
    tracks[ids.head] = [kf(0, 0), kf(d * 0.28, 14 * f), kf(d * 0.62, -12 * f), kf(d, 0)]
  }
  if (ids.armL) {
    tracks[ids.armL] = [
      kf(0, -12 * f),
      kf(d * 0.28, 28 * f, 0, 0, 1, 1, 18),
      kf(d * 0.62, -96 * f, 0, 0, 1, 1, 32),
      kf(d, -12 * f)
    ]
  }
  if (ids.forearmL) {
    tracks[ids.forearmL] = [kf(0, -24 * f), kf(d * 0.28, 18 * f), kf(d * 0.62, -16 * f), kf(d, -24 * f)]
  }
  if (ids.thighL) tracks[ids.thighL] = [kf(0, -8 * f), kf(d * 0.28, -28 * f), kf(d * 0.62, -32 * f), kf(d, -8 * f)]
  if (ids.shinL) tracks[ids.shinL] = [kf(0, 12 * f), kf(d * 0.28, 42 * f), kf(d * 0.62, 26 * f), kf(d, 12 * f)]
  return fillRestTracks(bones, tracks, d)
}

/** Trúng đòn bật lùi (Hit Recoil): đa hình hỗ trợ cả Người, Quái vật và Con vật 4 chân. */
export function generateHitRecoil(
  bones: LayerBone[],
  duration = 1.0,
  viewAngle: MotionViewAngle = 'diagonal'
): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const jawId = findBoneByTokens(bones, ['jaw', 'hàm dưới'])
  const tailId = findBoneByTokens(bones, ['tail', 'đuôi'])
  const f = detectFacingSign(bones, viewAngle)

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, 0, 0, 0),
      kf(d * 0.16, -12 * f, -16 * f, -8, 1.04, 0.94, undefined, 'ease-out'),
      kf(d * 0.52, -5 * f, -8 * f, 6, 1.01, 0.98, undefined, 'ease-in-out'),
      kf(d, 0, 0, 0, 1, 1, undefined, 'ease-in-out')
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [kf(0, 0), kf(d * 0.16, -24 * f), kf(d * 0.52, -10 * f), kf(d, 0)]
  }
  if (ids.head) {
    tracks[ids.head] = [kf(0, 0), kf(d * 0.16, -22 * f), kf(d * 0.52, -8 * f), kf(d, 0)]
  }
  if (jawId) {
    tracks[jawId] = [kf(0, 0), kf(d * 0.16, -24 * f), kf(d * 0.52, -10 * f), kf(d, 0)]
  }
  if (ids.armL) tracks[ids.armL] = [kf(0, 0), kf(d * 0.16, 48 * f), kf(d * 0.52, 22 * f), kf(d, 0)]
  if (ids.armR) tracks[ids.armR] = [kf(0, 0), kf(d * 0.16, 56 * f), kf(d * 0.52, 18 * f), kf(d, 0)]
  if (ids.thighL) tracks[ids.thighL] = [kf(0, 0), kf(d * 0.16, 22 * f), kf(d, 0)]
  if (ids.shinL) tracks[ids.shinL] = [kf(0, 0), kf(d * 0.16, -18 * f), kf(d, 0)]
  if (tailId) tracks[tailId] = [kf(0, 0), kf(d * 0.16, 30 * f), kf(d, 0)]
  return fillRestTracks(bones, tracks, d)
}

// ---------------------------------------------------------------------------
// 3. Con Vật / Linh Thú 2.5D (Quadruped Walk, Gallop, Wing Flap)
// ---------------------------------------------------------------------------

/** Thú 4 chân bước đi (tự đảo dấu góc theo hướng nhìn của bộ xương và fallback mượt). */
export function generateQuadrupedWalkClip(bones: LayerBone[], duration = 1.4): Record<string, BoneKeyframe[]> {
  const hasQuad = bones.some((b) => b.id.includes('leg-fl'))
  if (!hasQuad) {
    return generateWalkCycle(bones, duration, 'side')
  }
  const f = detectFacingSign(bones, 'side')
  const raw = generateQuadrupedWalk(bones, duration)
  if (f < 0) return fillRestTracks(bones, raw, duration)
  const out: Record<string, BoneKeyframe[]> = {}
  for (const [id, keys] of Object.entries(raw)) {
    out[id] = keys.map((item) => ({ ...item, rotation: Number((-item.rotation).toFixed(2)) }))
  }
  return fillRestTracks(bones, out, duration)
}

/** Thú 4 chân phi nước đại / lao vồ (Quadruped Gallop): co cụm trên không → vươn 2 chân trước → đạp 2 chân sau. */
export function generateQuadrupedGallopClip(bones: LayerBone[], duration = 0.85): Record<string, BoneKeyframe[]> {
  const hasQuad = bones.some((b) => b.id.includes('leg-fl'))
  if (!hasQuad) {
    return generateCombatCombo(bones, duration, 'side')
  }
  const d = duration
  const f = detectFacingSign(bones, 'side')
  const legFwd = -f
  const tracks: Record<string, BoneKeyframe[]> = {}

  tracks['bone-pelvis'] = [
    kf(0, -6 * f, 0, 2),
    kf(d * 0.25, 10 * f, 4 * f, -14, 1.03, 0.96, undefined, 'ease-out'),
    kf(d * 0.55, -8 * f, 0, -6),
    kf(d * 0.8, 4 * f, -2 * f, 4),
    kf(d, -6 * f, 0, 2)
  ]
  tracks['bone-torso'] = [
    kf(0, 8 * f),
    kf(d * 0.25, -14 * f),
    kf(d * 0.55, 12 * f),
    kf(d, 8 * f)
  ]
  tracks['bone-head'] = [kf(0, -6 * f), kf(d * 0.25, 10 * f), kf(d * 0.55, -10 * f), kf(d, -6 * f)]
  tracks['bone-tail'] = [kf(0, -18 * f), kf(d * 0.25, 22 * f), kf(d * 0.6, -20 * f), kf(d, -18 * f)]
  tracks['bone-tail-tip'] = [kf(0, -14 * f), kf(d * 0.35, 26 * f), kf(d * 0.7, -16 * f), kf(d, -14 * f)]

  // Hai chân trước vươn xa đón đất ở 0.25d rồi đạp mạnh ra sau ở 0.7d
  for (const [thId, shId, phase] of [
    ['bone-leg-fl-thigh', 'bone-leg-fl-shin', 0],
    ['bone-leg-fr-thigh', 'bone-leg-fr-shin', 0.08]
  ] as const) {
    if (bones.some((b) => b.id === thId)) {
      tracks[thId] = [
        kf(0, -28 * legFwd),
        kf(d * (0.25 + phase), 46 * legFwd),
        kf(d * (0.58 + phase), -36 * legFwd),
        kf(d, -28 * legFwd)
      ]
    }
    if (bones.some((b) => b.id === shId)) {
      tracks[shId] = [
        kf(0, 32 * f),
        kf(d * (0.25 + phase), -14 * f),
        kf(d * (0.58 + phase), 36 * f),
        kf(d, 32 * f)
      ]
    }
  }
  // Hai chân sau co rạp dưới bụng khi vồ rồi đạp bung mạnh ra sau
  for (const [thId, shId, phase] of [
    ['bone-leg-bl-thigh', 'bone-leg-bl-shin', 0],
    ['bone-leg-br-thigh', 'bone-leg-br-shin', 0.08]
  ] as const) {
    if (bones.some((b) => b.id === thId)) {
      tracks[thId] = [
        kf(0, 38 * legFwd),
        kf(d * (0.28 + phase), -40 * legFwd),
        kf(d * (0.62 + phase), 28 * legFwd),
        kf(d, 38 * legFwd)
      ]
    }
    if (bones.some((b) => b.id === shId)) {
      tracks[shId] = [
        kf(0, -18 * f),
        kf(d * (0.28 + phase), 24 * f),
        kf(d * (0.62 + phase), -22 * f),
        kf(d, -18 * f)
      ]
    }
  }
  return fillRestTracks(bones, tracks, d)
}

/** Linh Cầm / Chim 2.5D vỗ cánh bay lượn mượt mà (hỗ trợ cả xương chim lẫn humanoid). */
export function generateWingFlapClip(bones: LayerBone[], duration = 1.1): Record<string, BoneKeyframe[]> {
  if (bones.some((b) => b.id === 'bone-bird-wing-l')) {
    return fillRestTracks(bones, generateBirdWingFlap(bones, duration), duration)
  }
  const d = duration
  const tracks: Record<string, BoneKeyframe[]> = {}
  const ids = resolveBodyIds(bones)
  if (ids.pelvis) tracks[ids.pelvis] = [kf(0, 0, 0, 0), kf(d * 0.35, 0, 0, -10), kf(d * 0.7, 0, 0, 5), kf(d, 0, 0, 0)]
  if (ids.armL) tracks[ids.armL] = [kf(0, 0), kf(d * 0.35, -58), kf(d * 0.7, 18), kf(d, 0)]
  if (ids.armR) tracks[ids.armR] = [kf(0, 0), kf(d * 0.35, 58), kf(d * 0.7, -18), kf(d, 0)]
  return fillRestTracks(bones, tracks, d)
}

// ---------------------------------------------------------------------------
// 4. Quái Vật 2.5D (Prowl, Roar, Pounce Double Claw Strike)
// ---------------------------------------------------------------------------

/** Quái vật rình bước nặng nề: lắc vai gù lưng, trảo đung đưa & đuôi gai quất chậm. */
export function generateMonsterProwl(bones: LayerBone[], duration = 1.8): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const jawId = findBoneByTokens(bones, ['jaw', 'hàm dưới'])
  const tailId = findBoneByTokens(bones, ['tail', 'đuôi gốc'])
  const tailTipId = findBoneByTokens(bones, ['tail-tip', 'chùy', 'đuôi ngọn'])
  const f = detectFacingSign(bones, 'side')
  const legFwd = -f

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, -3 * f, 0, 4),
      kf(d * 0.25, 3 * f, 0, -4),
      kf(d * 0.5, -3 * f, 0, 5),
      kf(d * 0.75, 3 * f, 0, -4),
      kf(d, -3 * f, 0, 4)
    ]
  }
  if (ids.torso) tracks[ids.torso] = [kf(0, 8 * f), kf(d * 0.25, 14 * f), kf(d * 0.5, 6 * f), kf(d * 0.75, 14 * f), kf(d, 8 * f)]
  if (ids.head) tracks[ids.head] = [kf(0, -8 * f), kf(d * 0.25, -4 * f), kf(d * 0.5, -10 * f), kf(d, -8 * f)]
  if (jawId) tracks[jawId] = [kf(0, -4 * f), kf(d * 0.3, -12 * f), kf(d * 0.65, -3 * f), kf(d, -4 * f)]
  if (ids.thighL) tracks[ids.thighL] = [kf(0, 22 * legFwd), kf(d * 0.5, -24 * legFwd), kf(d, 22 * legFwd)]
  if (ids.shinL) tracks[ids.shinL] = [kf(0, -10 * f), kf(d * 0.25, 22 * f), kf(d * 0.5, 8 * f), kf(d, -10 * f)]
  if (ids.thighR) tracks[ids.thighR] = [kf(0, -24 * legFwd), kf(d * 0.5, 22 * legFwd), kf(d, -24 * legFwd)]
  if (ids.shinR) tracks[ids.shinR] = [kf(0, 8 * f), kf(d * 0.5, -10 * f), kf(d * 0.75, 22 * f), kf(d, 8 * f)]
  if (ids.armL) tracks[ids.armL] = [kf(0, -18 * legFwd), kf(d * 0.5, 20 * legFwd), kf(d, -18 * legFwd)]
  if (ids.armR) tracks[ids.armR] = [kf(0, 20 * legFwd), kf(d * 0.5, -18 * legFwd), kf(d, 20 * legFwd)]
  if (ids.forearmL) tracks[ids.forearmL] = [kf(0, 14 * legFwd), kf(d * 0.5, -10 * legFwd), kf(d, 14 * legFwd)]
  if (ids.forearmR) tracks[ids.forearmR] = [kf(0, -10 * legFwd), kf(d * 0.5, 14 * legFwd), kf(d, -10 * legFwd)]
  if (tailId) tracks[tailId] = [kf(0, -14), kf(d * 0.5, 16), kf(d, -14)]
  if (tailTipId) tracks[tailTipId] = [kf(0, 16), kf(d * 0.5, -20), kf(d, 16)]
  return fillRestTracks(bones, tracks, d)
}

/** Quái vật gầm rống uy áp: thu ngực lấy hơi → ngửa đầu há to hàm rung gầm + bung rộng song trảo. */
export function generateMonsterRoar(bones: LayerBone[], duration = 1.6): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const jawId = findBoneByTokens(bones, ['jaw', 'hàm dưới'])
  const tailId = findBoneByTokens(bones, ['tail', 'đuôi gốc'])
  const f = detectFacingSign(bones, 'side')

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, 0, 0, 0),
      kf(d * 0.24, 6 * f, 4 * f, 10, 1.03, 0.94),
      kf(d * 0.45, -10 * f, -6 * f, -6, 1.05, 1.04, undefined, 'ease-out'),
      kf(d * 0.72, -12 * f, -8 * f, -8),
      kf(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [kf(0, 8 * f), kf(d * 0.24, 20 * f), kf(d * 0.45, -24 * f), kf(d * 0.75, -20 * f), kf(d, 8 * f)]
  }
  if (ids.head) {
    tracks[ids.head] = [
      kf(0, 0),
      kf(d * 0.24, 14 * f),
      kf(d * 0.45, -24 * f),
      kf(d * 0.62, -20 * f),
      kf(d * 0.78, -26 * f),
      kf(d, 0)
    ]
  }
  if (jawId) {
    tracks[jawId] = [
      kf(0, 0),
      kf(d * 0.24, 2 * f),
      kf(d * 0.45, -30 * f, 0, 0, 1, 1, undefined, 'ease-out'),
      kf(d * 0.62, -24 * f),
      kf(d * 0.78, -32 * f),
      kf(d, 0)
    ]
  }
  if (ids.armR) tracks[ids.armR] = [kf(0, 0), kf(d * 0.24, 22 * f), kf(d * 0.45, -62 * f, 0, 0, 1, 1, 30), kf(d * 0.78, -56 * f), kf(d, 0)]
  if (ids.armL) tracks[ids.armL] = [kf(0, 0), kf(d * 0.24, -18 * f), kf(d * 0.45, -48 * f, 0, 0, 1, 1, -24), kf(d * 0.78, -42 * f), kf(d, 0)]
  if (ids.forearmR) tracks[ids.forearmR] = [kf(0, 0), kf(d * 0.45, -28 * f), kf(d, 0)]
  if (ids.forearmL) tracks[ids.forearmL] = [kf(0, 0), kf(d * 0.45, -22 * f), kf(d, 0)]
  if (tailId) tracks[tailId] = [kf(0, 0), kf(d * 0.45, 28), kf(d * 0.75, -22), kf(d, 0)]
  return fillRestTracks(bones, tracks, d)
}

/** Quái vật vồ tát song trảo: co người dồn lực → vọt người giương song trảo → bổ chéo tát mạnh → ghìm thế. */
export function generateMonsterPounce(bones: LayerBone[], duration = 1.3): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const ids = resolveBodyIds(bones)
  const jawId = findBoneByTokens(bones, ['jaw', 'hàm dưới'])
  const tailId = findBoneByTokens(bones, ['tail', 'đuôi gốc'])
  const f = detectFacingSign(bones, 'side')
  const legFwd = -f

  if (ids.pelvis) {
    tracks[ids.pelvis] = [
      kf(0, 0, 0, 0),
      kf(d * 0.25, -8 * f, -12 * f, 12, 1.04, 0.92),
      kf(d * 0.52, 6 * f, 8 * f, -16, 0.98, 1.04, undefined, 'ease-out'),
      kf(d * 0.76, 12 * f, 18 * f, 6, 1.04, 0.95, undefined, 'ease-out'),
      kf(d, 0, 0, 0)
    ]
  }
  if (ids.torso) {
    tracks[ids.torso] = [kf(0, 6 * f), kf(d * 0.25, -14 * f), kf(d * 0.52, -4 * f), kf(d * 0.76, 28 * f), kf(d, 6 * f)]
  }
  if (ids.head) tracks[ids.head] = [kf(0, 0), kf(d * 0.25, 10 * f), kf(d * 0.52, -16 * f), kf(d * 0.76, -8 * f), kf(d, 0)]
  if (jawId) tracks[jawId] = [kf(0, 0), kf(d * 0.52, -26 * f), kf(d * 0.76, -12 * f), kf(d, 0)]
  if (ids.armR) {
    tracks[ids.armR] = [kf(0, 0), kf(d * 0.25, 36 * f), kf(d * 0.52, -98 * f, 0, 0, 1, 1, 36), kf(d * 0.76, -18 * f, 0, 0, 1, 1, 28), kf(d, 0)]
  }
  if (ids.armL) {
    tracks[ids.armL] = [kf(0, 0), kf(d * 0.25, 28 * f), kf(d * 0.52, -88 * f, 0, 0, 1, 1, -20), kf(d * 0.76, -10 * f), kf(d, 0)]
  }
  if (ids.forearmR) tracks[ids.forearmR] = [kf(0, 0), kf(d * 0.52, -42 * f), kf(d * 0.76, 24 * f), kf(d, 0)]
  if (ids.forearmL) tracks[ids.forearmL] = [kf(0, 0), kf(d * 0.52, -36 * f), kf(d * 0.76, 18 * f), kf(d, 0)]
  if (ids.thighR) tracks[ids.thighR] = [kf(0, 0), kf(d * 0.25, 32 * legFwd), kf(d * 0.52, -36 * legFwd), kf(d * 0.76, 26 * legFwd), kf(d, 0)]
  if (ids.thighL) tracks[ids.thighL] = [kf(0, 0), kf(d * 0.25, 26 * legFwd), kf(d * 0.52, -22 * legFwd), kf(d * 0.76, -18 * legFwd), kf(d, 0)]
  if (tailId) tracks[tailId] = [kf(0, 0), kf(d * 0.52, -26), kf(d * 0.76, 32), kf(d, 0)]
  return fillRestTracks(bones, tracks, d)
}
