import type { AnimationClip, BoneKeyframe, LayerBone } from '@shared/layerRig'
import { clampBoneRotation } from '../boneConstraints'
import { CREATURE_CLIP_LABELS, getCreatureMeta } from './creatureRigCatalog'
import type { CreatureBoneRole, CreatureClipKind, CreatureRigBuild, CreatureSpecies } from './creatureRigTypes'

/**
 * Bộ sinh chuyển động thủ tục cho khung xương sinh vật (procedural creature motion):
 * dáng đi so le theo pha chân (nhện 4-4, côn trùng 3-3, thú 4 nhịp / nước kiệu), sóng uốn lượn lan dọc chuỗi
 * (đuôi, thân rắn, xúc tu, cột sống cá) và vỗ cánh. Mọi góc được kẹp theo giới hạn khớp của xương.
 */

const TAU = Math.PI * 2
const STEPS = 8
const sin = (u: number, phase = 0) => Math.sin(TAU * (u + phase))
const cos = (u: number, phase = 0) => Math.cos(TAU * (u + phase))
const ramp = (r: CreatureBoneRole) => (r.count <= 1 ? 1 : 0.45 + (0.55 * r.segment) / (r.count - 1))

interface PoseLite {
  rotation: number
  x?: number
  y?: number
}

interface MotionCtx {
  species: CreatureSpecies
  isRoot: boolean
  sideView: boolean
}

type PoseFn = (r: CreatureBoneRole, u: number, ctx: MotionCtx) => PoseLite | null

const chainWave = (r: CreatureBoneRole, u: number, amp: number, delay: number) =>
  r.sign * amp * ramp(r) * sin(u, r.phase - r.segment * delay)

/** Đốt chân: đốt gốc vung trước-sau, đốt gối gập khi nhấc chân, đốt ngọn bù ngược để bàn chân bám đất. */
function legPose(r: CreatureBoneRole, u: number, swing: number, lift: number, phase = r.phase): number {
  const kneeDir = r.limb === 'front' ? -1 : 1
  const knee = r.sign * kneeDir * lift * Math.max(0, cos(u, phase))
  if (r.segment === 0) return r.sign * swing * sin(u, phase)
  if (r.segment === 1) return knee
  return -0.4 * r.sign * kneeDir * lift * Math.max(0, cos(u, phase))
}

const trotPhase = (r: CreatureBoneRole) => ((r.limb === 'front' ? 0 : 0.5) + (r.side === 'r' ? 0.5 : 0)) % 1

function walkFactory(trot: boolean): PoseFn {
  const k = trot ? 1.35 : 1
  return (r, u, ctx) => {
    if (ctx.isRoot) {
      const sway = ctx.species === 'lizard' ? 6 : 2
      return { rotation: r.sign * sway * sin(u), y: -(trot ? 4.5 : 2.5) * (1 - Math.cos(TAU * 2 * u)) * 0.5 }
    }
    switch (r.kind) {
      case 'leg': {
        const phase = trot && r.limb ? trotPhase(r) : r.phase
        return { rotation: legPose(r, u, (ctx.sideView ? 22 : 14) * k, (ctx.sideView ? 28 : 16) * k, phase) }
      }
      case 'core':
        return { rotation: r.sign * (ctx.species === 'lizard' ? 8 : 3) * sin(u, 0.25) }
      case 'head':
        return { rotation: r.sign * 3 * sin(u, 0.5) }
      case 'neck':
        return { rotation: r.sign * 4 * sin(u, 0.4) }
      case 'arm':
        return { rotation: r.sign * 8 * sin(u, r.phase) }
      case 'tail':
      case 'mane':
      case 'tentacle':
      case 'antenna':
        return { rotation: chainWave(r, u, ctx.species === 'lizard' ? 14 : 10, 0.12) }
      case 'wing':
        return { rotation: r.sign * 3 * sin(u) }
      case 'fin':
        return { rotation: r.sign * 10 * sin(u, r.phase) }
      case 'ear':
        return { rotation: r.sign * 5 * sin(u, 0.3) }
      default:
        return null
    }
  }
}

const idlePose: PoseFn = (r, u, ctx) => {
  if (ctx.isRoot) return { rotation: 0, y: -1.5 * (1 - cos(u)) * 0.5 }
  switch (r.kind) {
    case 'core':
      return { rotation: r.sign * 1.5 * sin(u, 0.2) }
    case 'head':
      return { rotation: r.sign * 4 * sin(u, 0.15) }
    case 'neck':
      return { rotation: r.sign * 3 * sin(u, 0.1) }
    case 'leg':
      return { rotation: r.sign * 2 * sin(u, r.phase * 0.5) }
    case 'arm':
      return { rotation: r.sign * 5 * sin(u, r.phase) }
    case 'tail':
    case 'mane':
      return { rotation: chainWave(r, u, 8, 0.1) }
    case 'tentacle':
      return { rotation: chainWave(r, u, 12, 0.1) }
    case 'antenna':
      return { rotation: chainWave(r, u, 10, 0.1) }
    case 'wing':
      return { rotation: r.sign * 4 * sin(u) }
    case 'fin':
      return { rotation: r.sign * 10 * sin(u, r.phase) }
    case 'ear':
      return { rotation: r.sign * 4 * sin(u, 0.3) }
    case 'jaw':
      return { rotation: -r.sign * 6 * Math.max(0, sin(u, 0.6)) }
    default:
      return null
  }
}

const swimPose: PoseFn = (r, u, ctx) => {
  if (ctx.isRoot) {
    return ctx.species === 'octopus' ? { rotation: 0, y: -8 * sin(u) } : { rotation: r.sign * 4 * sin(u) }
  }
  switch (r.kind) {
    case 'head':
      return { rotation: -r.sign * 3 * sin(u, 0.1) }
    case 'tail':
      return { rotation: chainWave(r, u, 18, 0.15) }
    case 'fin':
      return { rotation: r.group === 'tailfin' ? r.sign * 26 * sin(u, -0.45) : r.sign * 16 * sin(u, r.phase) }
    case 'tentacle':
      return { rotation: r.sign * (10 + 6 * r.segment) * sin(u, r.phase * 0.3 - r.segment * 0.1) }
    case 'jaw':
      return { rotation: -r.sign * 5 * Math.max(0, sin(u, 0.3)) }
    default:
      return null
  }
}

const slitherPose: PoseFn = (r, u, ctx) => {
  if (ctx.isRoot) return { rotation: r.sign * 10 * sin(u) }
  if (r.kind === 'tail' || r.kind === 'core') return { rotation: r.sign * 20 * sin(u, -r.segment * 0.18) }
  if (r.kind === 'head') return { rotation: -r.sign * 10 * sin(u, 0.05) }
  return null
}

const flapPose: PoseFn = (r, u, ctx) => {
  if (ctx.isRoot) return { rotation: 0, y: -5 * sin(u, 0.25) }
  switch (r.kind) {
    case 'wing': {
      const amp = r.segment === 0 ? (ctx.species === 'butterfly' ? 35 : 45) : r.segment === 1 ? 22 : 14
      return { rotation: r.sign * amp * sin(u, r.phase - r.segment * 0.1) }
    }
    case 'head':
      return { rotation: r.sign * 3 * sin(u, 0.3) }
    case 'neck':
      return { rotation: r.sign * 4 * sin(u, 0.3) }
    case 'tail':
    case 'antenna':
    case 'mane':
      return { rotation: chainWave(r, u, 6, 0.1) }
    case 'leg':
      return r.segment === 0 ? { rotation: r.sign * (10 + 2 * sin(u)) } : null
    case 'core':
      return { rotation: r.sign * 3 * sin(u, 0.2) }
    default:
      return null
  }
}

const scuttlePose: PoseFn = (r, u, ctx) => {
  if (ctx.isRoot) return { rotation: 0, x: 4 * sin(u) }
  if (r.kind === 'leg') return { rotation: legPose(r, u, 16, 14) }
  if (r.kind === 'arm') return { rotation: r.sign * 5 * sin(u, 0.25) }
  if (r.kind === 'antenna') return { rotation: r.sign * 6 * sin(u, 0.4) }
  return null
}

const snapPose: PoseFn = (r, u, ctx) => {
  if (ctx.isRoot) return { rotation: 0, y: -1 * (1 - cos(u)) * 0.5 }
  if (r.kind === 'arm' && r.segment > 0) return { rotation: r.sign * 8 * sin(u, r.phase) }
  if (r.kind === 'jaw') return { rotation: r.sign * 30 * Math.max(0, sin(u, r.phase)) }
  if (r.kind === 'antenna') return { rotation: r.sign * 6 * sin(u, 0.4) }
  return null
}

const CLIP_SPECS: Record<CreatureClipKind, { duration: number; pose: PoseFn }> = {
  walk: { duration: 1.2, pose: walkFactory(false) },
  trot: { duration: 0.7, pose: walkFactory(true) },
  idle: { duration: 2.4, pose: idlePose },
  swim: { duration: 1.4, pose: swimPose },
  slither: { duration: 1.6, pose: slitherPose },
  flap: { duration: 0.6, pose: flapPose },
  scuttle: { duration: 0.8, pose: scuttlePose },
  snap: { duration: 1.0, pose: snapPose }
}

const FLAP_DURATION: Partial<Record<CreatureSpecies, number>> = { butterfly: 0.45, insect: 0.3, dragon: 1.0 }

const round = (n: number, p = 2) => Number(n.toFixed(p)) || 0

function trackForBone(bone: LayerBone, role: CreatureBoneRole, pose: PoseFn, duration: number, ctx: MotionCtx, offsetScale: number): BoneKeyframe[] | null {
  const keys: BoneKeyframe[] = []
  let moving = false
  for (let k = 0; k <= STEPS; k++) {
    const u = k / STEPS
    const p = pose(role, u, ctx)
    if (!p) return null
    const rotation = round(clampBoneRotation(bone, p.rotation))
    const x = round((p.x ?? 0) * offsetScale)
    const y = round((p.y ?? 0) * offsetScale)
    if (Math.abs(rotation) > 0.05 || Math.abs(x) > 0.05 || Math.abs(y) > 0.05) moving = true
    keys.push({ time: round((duration * k) / STEPS, 3), x, y, rotation, scaleX: 1, scaleY: 1, easing: 'smooth' })
  }
  return moving ? keys : null
}

export function buildCreatureClip(build: CreatureRigBuild, kind: CreatureClipKind, sideView: boolean, offsetScale = 1): AnimationClip {
  const spec = CLIP_SPECS[kind]
  const duration = kind === 'flap' ? (FLAP_DURATION[build.species] ?? spec.duration) : spec.duration
  const tracks: Record<string, BoneKeyframe[]> = {}
  for (const bone of build.bones) {
    const role = build.roles[bone.id]
    if (!role) continue
    const track = trackForBone(bone, role, spec.pose, duration, { species: build.species, isRoot: !bone.parentId, sideView }, offsetScale)
    if (track) tracks[bone.id] = track
  }
  return {
    id: `clip-${build.species}-${kind}`,
    name: CREATURE_CLIP_LABELS[kind],
    duration,
    loop: true,
    tracks,
    presetKey: `creature:${build.species}:${kind}`,
    ...(sideView ? { viewAngle: 'side' as const } : {})
  }
}

/** Sinh bộ động tác mẫu phù hợp với loài (bỏ qua "Vỗ cánh" nếu khung xương không có cánh). */
export function buildCreatureClips(build: CreatureRigBuild, sideView: boolean, offsetScale = 1): AnimationClip[] {
  const hasWings = Object.values(build.roles).some((r) => r.kind === 'wing')
  return getCreatureMeta(build.species)
    .clips.filter((kind) => kind !== 'flap' || hasWings)
    .map((kind) => buildCreatureClip(build, kind, sideView, offsetScale))
}
