import type { BoneBezier, BoneEasing, BoneKeyframe, LayerRig } from '@shared/layerRig'
import { sampleBonePose } from '../../engine/boneInterpolation'

export const KEY_EPSILON = 0.0001
export const BONE_EASINGS: BoneEasing[] = ['smooth', 'linear', 'hold', 'ease-in', 'ease-out', 'ease-in-out', 'bezier']
export const DEFAULT_BEZIER: BoneBezier = [0.25, 0.1, 0.25, 1]
export type KeyPatch = Partial<Omit<BoneKeyframe, 'time'>> & { time: number }
export type BonePoseEntry = Partial<Omit<BoneKeyframe, 'time'>> & { boneId: string }
export interface KeyTargetRef {
  boneId: string
  time: number
}
export interface KeyMoveEntry extends KeyTargetRef {
  targetTime: number
}

export type AnimationAction =
  | { action: 'set-key'; boneId: string; key: KeyPatch }
  | { action: 'set-pose'; time: number; easing?: BoneEasing; poses: BonePoseEntry[] }
  | { action: 'delete-key'; boneId: string; time: number }
  | { action: 'delete-keys'; keys: KeyTargetRef[] }
  | { action: 'move-key'; boneId: string; time: number; targetTime: number }
  | { action: 'move-keys'; moves: KeyMoveEntry[]; overwrite?: boolean }
  | { action: 'set-interpolation'; boneId: string; time: number; easing: BoneEasing; bezier?: BoneBezier }
export type AnimationBatch = { action: 'batch'; operations: AnimationAction[] }

export const sameKeyTime = (a: number, b: number) => Math.abs(a - b) <= KEY_EPSILON

export function validateCurve(easing: BoneEasing, bezier?: BoneBezier) {
  if (!BONE_EASINGS.includes(easing)) throw new Error('Invalid interpolation')
  if (
    bezier &&
    (!Array.isArray(bezier) ||
      bezier.length !== 4 ||
      !bezier.every(Number.isFinite) ||
      bezier[0] < 0 ||
      bezier[0] > 1 ||
      bezier[2] < 0 ||
      bezier[2] > 1)
  ) {
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
  const key: BoneKeyframe = {
    ...sampled,
    easing: existing?.easing ?? previous?.easing ?? 'smooth',
    bezier: existing?.bezier ?? previous?.bezier,
    ...defined,
    time: existing?.time ?? patch.time
  }
  validateCurve(key.easing, key.bezier)
  if (key.easing !== 'bezier') delete key.bezier
  rig.tracks[boneId] = [...keys.filter((k) => !sameKeyTime(k.time, key.time)), key].sort((a, b) => a.time - b.time)
}

function applyDeleteKeys(rig: LayerRig, targets: KeyTargetRef[]) {
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('delete-keys requires at least 1 key')
  const byBone = new Map<string, number[]>()
  for (const item of targets) {
    checkTime(rig, item.time)
    track(rig, item.boneId)
    const list = byBone.get(item.boneId) ?? []
    list.push(item.time)
    byBone.set(item.boneId, list)
  }
  for (const [boneId, times] of byBone.entries()) {
    const keys = rig.tracks[boneId] ?? []
    const remaining = keys.filter((k) => !times.some((t) => sameKeyTime(k.time, t)))
    if (remaining.length > 0) {
      rig.tracks[boneId] = remaining
    } else {
      delete rig.tracks[boneId]
    }
  }
}

function applyMoveKeys(rig: LayerRig, moves: KeyMoveEntry[], overwrite = false) {
  if (!Array.isArray(moves) || moves.length === 0) throw new Error('move-keys requires at least 1 move')
  const byBone = new Map<string, KeyMoveEntry[]>()
  for (const mv of moves) {
    checkTime(rig, mv.time)
    checkTime(rig, mv.targetTime)
    track(rig, mv.boneId)
    const list = byBone.get(mv.boneId) ?? []
    list.push(mv)
    byBone.set(mv.boneId, list)
  }

  for (const [boneId, boneMoves] of byBone.entries()) {
    const keys = track(rig, boneId)
    const movingPairs: Array<{ source: BoneKeyframe; targetTime: number }> = []
    for (const mv of boneMoves) {
      const found = keys.find((k) => sameKeyTime(k.time, mv.time))
      if (!found) throw new Error('No keyframe at this time')
      if (movingPairs.some((p) => p.source !== found && sameKeyTime(p.targetTime, mv.targetTime))) {
        throw new Error('Destination keyframe is occupied')
      }
      if (!movingPairs.some((p) => p.source === found)) {
        movingPairs.push({ source: found, targetTime: Number(mv.targetTime.toFixed(4)) })
      }
    }

    const movingSet = new Set(movingPairs.map((p) => p.source))
    let stationary = keys.filter((k) => !movingSet.has(k))
    for (const pair of movingPairs) {
      const conflict = stationary.some((st) => sameKeyTime(st.time, pair.targetTime))
      if (conflict && !overwrite) throw new Error('Destination keyframe is occupied')
      if (conflict && overwrite) {
        stationary = stationary.filter((st) => !sameKeyTime(st.time, pair.targetTime))
      }
    }

    const updatedMoving = movingPairs.map(({ source, targetTime }) => ({ ...source, time: targetTime }))
    rig.tracks[boneId] = [...stationary, ...updatedMoving].sort((a, b) => a.time - b.time)
  }
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
  if (action.action === 'delete-keys') return applyDeleteKeys(rig, action.keys)
  if (action.action === 'move-keys') return applyMoveKeys(rig, action.moves, action.overwrite)

  const keys = track(rig, action.boneId)
  checkTime(rig, action.time)
  const key = keys.find((k) => sameKeyTime(k.time, action.time))
  if (!key) throw new Error('No keyframe at this time')
  if (action.action === 'delete-key') {
    rig.tracks[action.boneId] = keys.filter((k) => k !== key)
  } else if (action.action === 'move-key') {
    checkTime(rig, action.targetTime)
    if (keys.some((k) => k !== key && sameKeyTime(k.time, action.targetTime))) {
      throw new Error('Destination keyframe is occupied')
    }
    rig.tracks[action.boneId] = keys
      .map((k) => (k === key ? { ...k, time: action.targetTime } : k))
      .sort((a, b) => a.time - b.time)
  } else {
    validateCurve(action.easing, action.bezier)
    writeKey(rig, action.boneId, {
      ...key,
      easing: action.easing,
      bezier: action.easing === 'bezier' ? action.bezier ?? key.bezier ?? DEFAULT_BEZIER : undefined
    })
  }
}

export function isAnimationAction(action: { action: string }): action is AnimationAction {
  return [
    'set-key',
    'set-pose',
    'delete-key',
    'delete-keys',
    'move-key',
    'move-keys',
    'set-interpolation'
  ].includes(action.action)
}
