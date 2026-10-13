import type { BoneBezier, BoneEasing, BoneKeyframe, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/boneInterpolation'

export const KEY_EPSILON = 0.0001
export const BONE_EASINGS: BoneEasing[] = ['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out', 'bezier']
export const DEFAULT_BEZIER: BoneBezier = [0.25, 0.1, 0.25, 1]
export type KeyPatch = Partial<Omit<BoneKeyframe, 'time'>> & { time: number }
export type BonePoseEntry = Partial<Omit<BoneKeyframe, 'time'>> & { boneId: string }
export type AnimationAction =
  | { action: 'set-key'; boneId: string; key: KeyPatch }
  | { action: 'set-pose'; time: number; easing?: BoneEasing; poses: BonePoseEntry[] }
  | { action: 'delete-key'; boneId: string; time: number }
  | { action: 'move-key'; boneId: string; time: number; targetTime: number }
  | { action: 'set-interpolation'; boneId: string; time: number; easing: BoneEasing; bezier?: BoneBezier }
export type AnimationBatch = { action: 'batch'; operations: AnimationAction[] }

export const sameKeyTime = (a: number, b: number) => Math.abs(a - b) <= KEY_EPSILON

export function validateCurve(easing: BoneEasing, bezier?: BoneBezier) {
  if (!BONE_EASINGS.includes(easing)) throw new Error('Invalid interpolation')
  if (bezier && (!Array.isArray(bezier) || bezier.length !== 4 || !bezier.every(Number.isFinite)
    || bezier[0] < 0 || bezier[0] > 1 || bezier[2] < 0 || bezier[2] > 1)) {
    throw new Error('Bezier requires [x1, y1, x2, y2] with x controls between 0 and 1')
  }
}

function checkTime(rig: LayerRig, time: number) {
  if (!Number.isFinite(time) || time < 0 || time > rig.duration) throw new Error('Time outside clip duration')
}

function track(rig: LayerRig, boneId: string) {
  if (!rig.bones.some((b) => b.id === boneId)) throw new Error(`Unknown bone ID: ${boneId}`)
  return rig.tracks[boneId] ?? []
}

function writeKey(rig: LayerRig, boneId: string, patch: KeyPatch) {
  checkTime(rig, patch.time)
  const keys = track(rig, boneId)
  const existing = keys.find((key) => sameKeyTime(key.time, patch.time))
  const previous = keys.filter((key) => key.time <= patch.time).at(-1)
  const sampled = sampleBonePose({ ...rig, loop: false }, boneId, patch.time)
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  const key: BoneKeyframe = { ...sampled, easing: existing?.easing ?? previous?.easing ?? 'smooth',
    bezier: existing?.bezier ?? previous?.bezier, ...defined, time: existing?.time ?? patch.time }
  validateCurve(key.easing, key.bezier)
  if (key.easing !== 'bezier') delete key.bezier
  rig.tracks[boneId] = [...keys.filter((k) => !sameKeyTime(k.time, key.time)), key].sort((a, b) => a.time - b.time)
}

/** Mutates only the cloned draft owned by applyRigAction; the caller validates and commits once. */
export function applyAnimationAction(rig: LayerRig, action: AnimationAction) {
  if (action.action === 'set-key') return writeKey(rig, action.boneId, action.key)
  if (action.action === 'set-pose') {
    checkTime(rig, action.time)
    const ids = action.poses.map((p) => p.boneId)
    if (!ids.length || new Set(ids).size !== ids.length) throw new Error('Pose must contain unique bone IDs')
    action.poses.forEach((pose) => track(rig, pose.boneId))
    for (const { boneId, ...pose } of action.poses) {
      writeKey(rig, boneId, { ...pose, time: action.time, easing: pose.easing ?? action.easing })
    }
    return
  }
  const keys = track(rig, action.boneId)
  checkTime(rig, action.time)
  const key = keys.find((k) => sameKeyTime(k.time, action.time))
  if (!key) throw new Error('No keyframe at this time')
  if (action.action === 'delete-key') {
    rig.tracks[action.boneId] = keys.filter((k) => k !== key)
  } else if (action.action === 'move-key') {
    checkTime(rig, action.targetTime)
    if (keys.some((k) => k !== key && sameKeyTime(k.time, action.targetTime))) throw new Error('Destination keyframe is occupied')
    rig.tracks[action.boneId] = keys.map((k) => k === key ? { ...k, time: action.targetTime } : k).sort((a, b) => a.time - b.time)
  } else {
    validateCurve(action.easing, action.bezier)
    writeKey(rig, action.boneId, { ...key, easing: action.easing,
      bezier: action.easing === 'bezier' ? action.bezier ?? key.bezier ?? DEFAULT_BEZIER : undefined })
  }
}

export function isAnimationAction(action: { action: string }): action is AnimationAction {
  return ['set-key', 'set-pose', 'delete-key', 'move-key', 'set-interpolation'].includes(action.action)
}
