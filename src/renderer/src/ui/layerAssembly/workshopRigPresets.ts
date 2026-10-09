import type { BoneKeyframe, LayerBone, LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'

/** Preset humanoid 2D armature in workshop coordinates (origin 0,0 at center). */
export function createHumanoidBones(): LayerBone[] {
  return [
    { id: 'bone-pelvis', name: 'Hông (Root)', x: 0, y: 30, length: 50, angle: -90 },
    { id: 'bone-torso', name: 'Thân / Ngực', parentId: 'bone-pelvis', x: 0, y: -20, length: 65, angle: -90 },
    { id: 'bone-head', name: 'Đầu', parentId: 'bone-torso', x: 0, y: -85, length: 60, angle: -90 },
    { id: 'bone-arm-l', name: 'Bắp tay trái', parentId: 'bone-torso', x: -35, y: -70, length: 55, angle: 95 },
    { id: 'bone-forearm-l', name: 'Cẳng tay trái', parentId: 'bone-arm-l', x: -38, y: -15, length: 50, angle: 90 },
    { id: 'bone-arm-r', name: 'Bắp tay phải', parentId: 'bone-torso', x: 35, y: -70, length: 55, angle: 85 },
    { id: 'bone-forearm-r', name: 'Cẳng tay phải', parentId: 'bone-arm-r', x: 38, y: -15, length: 50, angle: 90 },
    { id: 'bone-thigh-l', name: 'Đùi trái', parentId: 'bone-pelvis', x: -25, y: 35, length: 70, angle: 90 },
    { id: 'bone-shin-l', name: 'Cẳng chân trái', parentId: 'bone-thigh-l', x: -25, y: 105, length: 70, angle: 90 },
    { id: 'bone-thigh-r', name: 'Đùi phải', parentId: 'bone-pelvis', x: 25, y: 35, length: 70, angle: 90 },
    { id: 'bone-shin-r', name: 'Cẳng chân phải', parentId: 'bone-thigh-r', x: 25, y: 105, length: 70, angle: 90 }
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

export type ProceduralMotionPreset = 'walk' | 'idle' | 'wave' | 'jump' | 'sway'

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

/** Generate procedural 2D cutout walk cycle animation keys with professional fluidity. */
export function generateWalkCycle(bones: LayerBone[], duration = 1.6): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration

  // Find legs, arms, and body parts by name or id
  const has = (keyword: string) =>
    bones.find((b) => b.id.includes(keyword) || b.name.toLowerCase().includes(keyword))?.id

  const thighL = has('thigh-l') ?? has('thigh_l') ?? has('đùi trái')
  const shinL = has('shin-l') ?? has('cẳng chân trái')
  const thighR = has('thigh-r') ?? has('đùi phải')
  const shinR = has('shin-r') ?? has('cẳng chân phải')
  const armL = has('arm-l') ?? has('bắp tay trái') ?? has('tay trái')
  const forearmL = has('forearm-l') ?? has('cẳng tay trái')
  const armR = has('arm-r') ?? has('bắp tay phải') ?? has('tay phải')
  const forearmR = has('forearm-r') ?? has('cẳng tay phải')
  const pelvis = has('pelvis') ?? has('hông') ?? bones[0]?.id
  const torso = has('torso') ?? has('thân')
  const head = has('head') ?? has('đầu')

  if (pelvis) {
    tracks[pelvis] = [
      smoothKey(0, 0, 0, 0, 1.0, 1.0),
      smoothKey(d * 0.15, -1.5, 0, 4.5, 1.03, 0.97),
      smoothKey(d * 0.35, 0, 0, -2, 0.98, 1.02),
      smoothKey(d * 0.50, 0, 0, 0, 1.0, 1.0),
      smoothKey(d * 0.65, 1.5, 0, 4.5, 1.03, 0.97),
      smoothKey(d * 0.85, 0, 0, -2, 0.98, 1.02),
      smoothKey(d, 0, 0, 0, 1.0, 1.0)
    ]
  }

  if (torso) {
    tracks[torso] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 2.5),
      smoothKey(d * 0.50, 0),
      smoothKey(d * 0.75, -2.5),
      smoothKey(d, 0)
    ]
  }

  if (head) {
    tracks[head] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, -1.5),
      smoothKey(d * 0.50, 0),
      smoothKey(d * 0.75, 1.5),
      smoothKey(d, 0)
    ]
  }

  if (thighL) {
    tracks[thighL] = [
      smoothKey(0, 24),
      smoothKey(d * 0.15, 12),
      smoothKey(d * 0.35, -4),
      smoothKey(d * 0.50, -22),
      smoothKey(d * 0.65, -8),
      smoothKey(d * 0.85, 18),
      smoothKey(d, 24)
    ]
  }
  if (shinL) {
    tracks[shinL] = [
      smoothKey(0, 2),
      smoothKey(d * 0.15, 16),
      smoothKey(d * 0.35, 4),
      smoothKey(d * 0.50, 2),
      smoothKey(d * 0.65, 48),
      smoothKey(d * 0.85, 12),
      smoothKey(d, 2)
    ]
  }

  if (thighR) {
    tracks[thighR] = [
      smoothKey(0, -22),
      smoothKey(d * 0.15, -8),
      smoothKey(d * 0.35, 18),
      smoothKey(d * 0.50, 24),
      smoothKey(d * 0.65, 12),
      smoothKey(d * 0.85, -4),
      smoothKey(d, -22)
    ]
  }
  if (shinR) {
    tracks[shinR] = [
      smoothKey(0, 2),
      smoothKey(d * 0.15, 48),
      smoothKey(d * 0.35, 12),
      smoothKey(d * 0.50, 2),
      smoothKey(d * 0.65, 16),
      smoothKey(d * 0.85, 4),
      smoothKey(d, 2)
    ]
  }

  if (armL) {
    tracks[armL] = [
      smoothKey(0, -22),
      smoothKey(d * 0.25, -8),
      smoothKey(d * 0.50, 16),
      smoothKey(d * 0.75, -4),
      smoothKey(d, -22)
    ]
  }
  if (forearmL) {
    tracks[forearmL] = [
      smoothKey(0, 32),
      smoothKey(d * 0.25, 18),
      smoothKey(d * 0.50, 8),
      smoothKey(d * 0.75, 16),
      smoothKey(d, 32)
    ]
  }

  if (armR) {
    tracks[armR] = [
      smoothKey(0, 16),
      smoothKey(d * 0.25, -4),
      smoothKey(d * 0.50, -22),
      smoothKey(d * 0.75, -8),
      smoothKey(d, 16)
    ]
  }
  if (forearmR) {
    tracks[forearmR] = [
      smoothKey(0, 8),
      smoothKey(d * 0.25, 16),
      smoothKey(d * 0.50, 32),
      smoothKey(d * 0.75, 18),
      smoothKey(d, 8)
    ]
  }

  // Fallback for simple chain or unknown bones: gentle walk-like sway
  for (const b of bones) {
    if (!tracks[b.id]) {
      tracks[b.id] = [
        smoothKey(0, 0),
        smoothKey(d * 0.5, b.parentId ? -4 : 2),
        smoothKey(d, 0)
      ]
    }
  }

  return tracks
}

/** Generate procedural gentle idle breathing animation keys. */
export function generateIdleBreathe(bones: LayerBone[], duration = 2.4): Record<string, BoneKeyframe[]> {
  const tracks: Record<string, BoneKeyframe[]> = {}
  const d = duration
  for (const [idx, b] of bones.entries()) {
    const isRoot = !b.parentId
    const phase = idx * 0.15
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
  const has = (kw: string) => bones.find((b) => b.id.includes(kw) || b.name.toLowerCase().includes(kw))?.id
  const armR = has('arm-r') ?? has('arm_r') ?? has('bắp tay phải') ?? bones[1]?.id
  const forearmR = has('forearm-r') ?? has('cẳng tay phải') ?? bones[2]?.id

  if (armR) {
    tracks[armR] = [
      smoothKey(0, -90),
      smoothKey(d * 0.3, -95),
      smoothKey(d * 0.6, -85),
      smoothKey(d, -90)
    ]
  }
  if (forearmR) {
    tracks[forearmR] = [
      smoothKey(0, 0),
      smoothKey(d * 0.25, 35),
      smoothKey(d * 0.5, -25),
      smoothKey(d * 0.75, 35),
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

/** Apply procedural preset to composite rig. */
export function applyMotionPresetToRig(composite: LayerComposite, preset: ProceduralMotionPreset): LayerComposite {
  const bones = composite.rig?.bones ?? []
  if (!bones.length) return composite
  let duration = 2.0
  let tracks: Record<string, BoneKeyframe[]> = {}

  switch (preset) {
    case 'walk':
      duration = 1.6
      tracks = generateWalkCycle(bones, duration)
      break
    case 'idle':
      duration = 2.4
      tracks = generateIdleBreathe(bones, duration)
      break
    case 'wave':
      duration = 1.8
      tracks = generateWaveHand(bones, duration)
      break
    case 'sway':
      duration = 2.0
      tracks = generateSway(bones, duration)
      break
    case 'jump':
      duration = 1.4
      tracks = generateWalkCycle(bones, duration)
      break
  }

  const nextRig: LayerRig = {
    bones,
    duration,
    loop: true,
    tracks
  }

  return { ...composite, rig: nextRig }
}
