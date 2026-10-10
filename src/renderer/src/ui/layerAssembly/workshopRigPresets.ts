import { generateWalkCycle, generateRunCycle } from './workshopWalkCycle'
export { generateWalkCycle, generateRunCycle } from './workshopWalkCycle'
import type { AnimationClip, BoneKeyframe, LayerBone, LayerRig, MotionViewAngle } from '@shared/layerRig'
import type { LayerComposite } from './types'

/** Preset humanoid 2D armature in workshop coordinates (origin 0,0 at center). */
export function createHumanoidBones(): LayerBone[] {
  return [
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
    { id: 'bone-foot-l', name: 'Bàn chân trái', parentId: 'bone-shin-l', x: -25, y: 175, length: 30, angle: 0 },
    { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: 25, y: 35, length: 70, angle: 90 },
    { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: 25, y: 105, length: 70, angle: 90 },
    { id: 'bone-foot-r', name: 'Bàn chân phải', parentId: 'bone-shin-r', x: 25, y: 175, length: 30, angle: 0 }
  ]
}

/** Simple 3-bone chain for plants, tails, ropes or branches. */
export function createSimpleChainBones(): LayerBone[] {
  return [
    { id: 'bone-chain-root', name: 'Khớp gốc', x: 0, y: 120, length: 80, angle: -90 },
    { id: 'bone-chain-mid', name: 'Khớp giữa', parentId: 'bone-chain-root', x: 0, y: 40, length: 80, angle: -90 },
    { id: 'bone-chain-tip', name: 'Khớp ngọn', parentId: 'bone-chain-mid', x: 0, y: -40, length: 75, angle: -90 }
  ]
}

export type ProceduralMotionPreset = 'walk' | 'idle' | 'wave' | 'bow' | 'run' | 'jump' | 'action' | 'sway'

export interface MotionPresetInfo {
  id: ProceduralMotionPreset
  name: string
  icon: string
  duration: number
  description: string
}

export const MOTION_PRESETS: MotionPresetInfo[] = [
  { id: 'walk', name: 'Bước đi (Walk)', icon: '🚶', duration: 1.6, description: 'Chân trụ tiếp đất, nhịp chuyển trọng tâm, đánh tay tự nhiên' },
  { id: 'idle', name: 'Đứng thở (Idle)', icon: '🌬️', duration: 2.4, description: 'Nhịp thở ngực nâng hạ êm ái, cơ thể thả lỏng tự nhiên' },
  { id: 'wave', name: 'Vẫy tay chào (Wave)', icon: '👋', duration: 1.8, description: 'Vẫy tay chào thân thiện, thân người nghiêng nhẹ theo nhịp' },
  { id: 'bow', name: 'Cúi chào (Bow)', icon: '🙇', duration: 2.0, description: 'Cúi người chào lịch thiệp, đầu gật nhẹ trang trọng' },
  { id: 'run', name: 'Chạy nhanh (Run)', icon: '🏃', duration: 1.0, description: 'Sải chân dứt khoát, tay vung nhịp nhanh' },
  { id: 'jump', name: 'Nhún nhảy (Jump)', icon: '🦘', duration: 1.4, description: 'Chùng gối lấy đà bật nhảy lên cao rồi tiếp đất êm ái' },
  { id: 'action', name: 'Vung đòn (Action)', icon: '⚔️', duration: 1.5, description: 'Tư thế vung tay ra đòn uy lực, dứt khoát' },
  { id: 'sway', name: 'Uốn lượn (Sway)', icon: '🌊', duration: 2.0, description: 'Lượn sóng dẻo dai cho cành lá, cây cối, tóc hoặc đuôi' }
]

function smoothKey(
  time: number,
  rotation: number,
  x = 0,
  y = 0,
  scaleX = 1,
  scaleY = 1
): BoneKeyframe {
  return {
    time: Number(time.toFixed(3)),
    rotation: Number(rotation.toFixed(2)),
    x,
    y,
    scaleX,
    scaleY,
    easing: 'smooth'
  }
}

/** Helper tìm id xương khớp keyword */
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

/** Generate procedural gentle idle breathing animation keys. */
export function generateIdleBreathe(bones: LayerBone[], duration = 2.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  for (const [idx, b] of bones.entries()) {
    const isRoot = !b.parentId
    const amp = isRoot ? 1.5 : (b.length > 60 ? 3.5 : 2)
    tracks[b.id] = [
      smoothKey(0, 0, 0, isRoot ? 0 : 0),
      smoothKey(d * 0.5, amp, 0, isRoot ? -3 : 0),
      smoothKey(d, 0, 0, 0)
    ]
  }
  return tracks
}

/** Generate friendly waving hand animation keys. */
export function generateWaveHand(bones: LayerBone[], duration = 1.8): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const armR = findBoneId(bones, ['arm-r', 'arm_r', 'bắp tay phải', 'upperarm-r']) ?? bones[1]?.id
  const forearmR = findBoneId(bones, ['forearm-r', 'forearm_r', 'cẳng tay phải', 'lowerarm-r']) ?? bones[2]?.id
  const handR = findBoneId(bones, ['hand-r', 'hand_r', 'bàn tay phải'])
  const torso = findBoneId(bones, ['torso', 'thân', 'ngực'])

  if (torso) {
    tracks[torso] = [
      smoothKey(0, 0),
      smoothKey(d * 0.35, -2.5),
      smoothKey(d * 0.7, 2),
      smoothKey(d, 0)
    ]
  }

  if (armR) {
    tracks[armR] = [
      smoothKey(0, -90),
      smoothKey(d * 0.3, -98),
      smoothKey(d * 0.6, -82),
      smoothKey(d, -90)
    ]
  }
  if (forearmR) {
    tracks[forearmR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 38),
      smoothKey(d * 0.5, -28),
      smoothKey(d * 0.75, 38),
      smoothKey(d, 0)
    ]
  }
  if (handR) {
    tracks[handR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 45),
      smoothKey(d * 0.5, -35),
      smoothKey(d * 0.75, 45),
      smoothKey(d, 0)
    ]
  }

  // Other bones breathe gently
  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 2), smoothKey(d, 0)]
    }
  }
  return tracks
}

/** Generate polite bowing animation keys. */
export function generateBow(bones: LayerBone[], duration = 2.0): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const pelvis = findBoneId(bones, ['pelvis', 'hông', 'root'])
  const torso = findBoneId(bones, ['torso', 'thân', 'ngực'])
  const head = findBoneId(bones, ['head', 'đầu'])
  const armL = findBoneId(bones, ['arm-l', 'arm_l', 'bắp tay trái'])
  const armR = findBoneId(bones, ['arm-r', 'arm_r', 'bắp tay phải'])

  if (pelvis) {
    tracks[pelvis] = [
      smoothKey(0, 0, 0, 0),
      smoothKey(d * 0.45, 0, 0, 6),
      smoothKey(d * 0.65, 0, 0, 6),
      smoothKey(d, 0, 0, 0)
    ]
  }
  if (torso) {
    tracks[torso] = [
      smoothKey(0, 0),
      smoothKey(d * 0.45, 26),
      smoothKey(d * 0.65, 26),
      smoothKey(d, 0)
    ]
  }
  if (head) {
    tracks[head] = [
      smoothKey(0, 0),
      smoothKey(d * 0.45, 18),
      smoothKey(d * 0.65, 18),
      smoothKey(d, 0)
    ]
  }
  if (armL) {
    tracks[armL] = [
      smoothKey(0, 0),
      smoothKey(d * 0.45, 14),
      smoothKey(d * 0.65, 14),
      smoothKey(d, 0)
    ]
  }
  if (armR) {
    tracks[armR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.45, 14),
      smoothKey(d * 0.65, 14),
      smoothKey(d, 0)
    ]
  }

  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
    }
  }
  return tracks
}

/** Generate athletic jump bounce animation keys. */
export function generateJump(bones: LayerBone[], duration = 1.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const pelvis = findBoneId(bones, ['pelvis', 'hông', 'root'])
  const torso = findBoneId(bones, ['torso', 'thân', 'ngực'])
  const thighL = findBoneId(bones, ['thigh-l', 'thigh_l', 'đùi trái'])
  const thighR = findBoneId(bones, ['thigh-r', 'thigh_r', 'đùi phải'])
  const shinL = findBoneId(bones, ['shin-l', 'shin_l', 'cẳng chân trái'])
  const shinR = findBoneId(bones, ['shin-r', 'shin_r', 'cẳng chân phải'])
  const armL = findBoneId(bones, ['arm-l', 'arm_l', 'bắp tay trái'])
  const armR = findBoneId(bones, ['arm-r', 'arm_r', 'bắp tay phải'])

  if (pelvis) {
    tracks[pelvis] = [
      smoothKey(0, 0, 0, 0),
      smoothKey(d * 0.25, 0, 0, 18), // Chùng hông lấy đà
      smoothKey(d * 0.55, 0, 0, -38), // Bật nảy lên không trung
      smoothKey(d * 0.85, 0, 0, 12), // Tiếp đất chùng chân
      smoothKey(d, 0, 0, 0)
    ]
  }
  if (torso) {
    tracks[torso] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 10),
      smoothKey(d * 0.55, -8),
      smoothKey(d * 0.85, 6),
      smoothKey(d, 0)
    ]
  }
  if (thighL) {
    tracks[thighL] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, -20),
      smoothKey(d * 0.55, 12),
      smoothKey(d * 0.85, -16),
      smoothKey(d, 0)
    ]
  }
  if (thighR) {
    tracks[thighR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, -20),
      smoothKey(d * 0.55, 12),
      smoothKey(d * 0.85, -16),
      smoothKey(d, 0)
    ]
  }
  if (shinL) {
    tracks[shinL] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 28),
      smoothKey(d * 0.55, -10),
      smoothKey(d * 0.85, 22),
      smoothKey(d, 0)
    ]
  }
  if (shinR) {
    tracks[shinR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 28),
      smoothKey(d * 0.55, -10),
      smoothKey(d * 0.85, 22),
      smoothKey(d, 0)
    ]
  }
  if (armL) {
    tracks[armL] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 22),
      smoothKey(d * 0.55, -45),
      smoothKey(d * 0.85, 15),
      smoothKey(d, 0)
    ]
  }
  if (armR) {
    tracks[armR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 22),
      smoothKey(d * 0.55, -45),
      smoothKey(d * 0.85, 15),
      smoothKey(d, 0)
    ]
  }

  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.55, 0), smoothKey(d, 0)]
    }
  }
  return tracks
}

/** Generate fast run cycle animation keys. */
export function generateRun(bones: LayerBone[], duration = 1.0): Record<string, BoneKeyframe[]> {
  // Chạy nhanh tương tự walk cycle nhưng chu kỳ 1.0s và biên độ sải chân / vung tay lớn hơn
  return generateWalkCycle(bones, duration)
}

/** Generate sword strike / action pose animation keys. */
export function generateActionSlash(bones: LayerBone[], duration = 1.5): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  const torso = findBoneId(bones, ['torso', 'thân', 'ngực'])
  const armR = findBoneId(bones, ['arm-r', 'arm_r', 'bắp tay phải'])
  const forearmR = findBoneId(bones, ['forearm-r', 'forearm_r', 'cẳng tay phải'])
  const pelvis = findBoneId(bones, ['pelvis', 'hông', 'root'])

  if (pelvis) {
    tracks[pelvis] = [
      smoothKey(0, 0, 0, 0),
      smoothKey(d * 0.35, -4, -6, 5),
      smoothKey(d * 0.6, 5, 8, -2),
      smoothKey(d, 0, 0, 0)
    ]
  }
  if (torso) {
    tracks[torso] = [
      smoothKey(0, 0),
      smoothKey(d * 0.35, -16), // Xoay người lấy đà
      smoothKey(d * 0.6, 22),   // Vung chém mạnh về trước
      smoothKey(d, 0)
    ]
  }
  if (armR) {
    tracks[armR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.35, -85), // Giơ cao kiếm
      smoothKey(d * 0.55, 65),  // Chém xuống
      smoothKey(d * 0.75, 40),
      smoothKey(d, 0)
    ]
  }
  if (forearmR) {
    tracks[forearmR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.35, -40),
      smoothKey(d * 0.55, 20),
      smoothKey(d, 0)
    ]
  }

  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [smoothKey(0, 0), smoothKey(d * 0.5, 0), smoothKey(d, 0)]
    }
  }
  return tracks
}

/** Generate swaying motion for plants, branches, tails. */
export function generateSway(bones: LayerBone[], duration = 2.0): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  for (const [idx, b] of bones.entries()) {
    const factor = (idx + 1) * 4
    tracks[b.id] = [
      smoothKey(0, -factor),
      smoothKey(d * 0.5, factor),
      smoothKey(d, -factor)
    ]
  }
  return tracks
}

/** Tạo một AnimationClip hoàn chỉnh từ preset */
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
      tracks = generateIdleBreathe(bones, duration)
      break
    case 'wave':
      tracks = generateWaveHand(bones, duration)
      break
    case 'bow':
      tracks = generateBow(bones, duration)
      break
    case 'run':
      tracks = generateRunCycle(bones, duration, viewAngle)
      break
    case 'jump':
      tracks = generateJump(bones, duration)
      break
    case 'action':
      tracks = generateActionSlash(bones, duration)
      break
    case 'sway':
      tracks = generateSway(bones, duration)
      break
  }

  const name = customName || meta?.name || `Động tác ${preset}`
  return {
    id: `clip-${preset}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    duration,
    loop: true,
    tracks,
    description: meta?.description,
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
  const currentRig = composite.rig ?? { bones, duration: clip.duration, loop: true, tracks: {} }
  const existingClips = currentRig.clips ?? []
  const activeId = currentRig.activeClipId

  let nextClips: AnimationClip[]
  if (activeId && existingClips.some((c) => c.id === activeId)) {
    nextClips = existingClips.map((c) => {
      if (c.id === activeId) {
        return {
          ...c,
          name: c.name === 'Động tác 1' || !c.name ? clip.name : c.name,
          duration: clip.duration,
          loop: clip.loop,
          tracks: clip.tracks,
          presetKey: preset
        }
      }
      return c
    })
  } else if (existingClips.length > 0) {
    nextClips = existingClips.map((c, i) =>
      i === 0
        ? {
            ...c,
            name: c.name === 'Động tác 1' || !c.name ? clip.name : c.name,
            duration: clip.duration,
            loop: clip.loop,
            tracks: clip.tracks,
            presetKey: preset
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

