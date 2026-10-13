import type { BoneBezier, BoneEasing } from '@shared/layerRig'
import { ParamError, type Params } from '../types'
import { num, str } from '../params'
import { isAnimationAction, validateCurve, type AnimationAction, type AnimationBatch, type BonePoseEntry } from '../../ui/layerAssembly/workshopAnimation'

function object(value: unknown): Params {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ParamError('Expected an animation operation object')
  return value as Params
}

function timeValue(p: Params, target = false) {
  const seconds = target ? 'target_time' : 'time', frames = target ? 'target_frame' : 'frame'
  if (p[seconds] !== undefined && p[frames] !== undefined) throw new ParamError(`Use ${seconds} or ${frames}, not both`)
  if (p[frames] === undefined) return num(p, seconds, true)
  const frame = num(p, frames, true), fps = num(p, 'fps', true)
  if (!Number.isInteger(frame) || frame < 0 || fps <= 0 || fps > 240) throw new ParamError('frame must be a nonnegative integer; fps must be in (0, 240]')
  return frame / fps
}

function posePatch(p: Params): Omit<BonePoseEntry, 'boneId'> {
  const easing = str(p, 'easing') as BoneEasing | undefined
  const bezier = p.bezier as BoneBezier | undefined
  if (p.bezier !== undefined && (!Array.isArray(p.bezier) || p.bezier.length !== 4)) throw new ParamError('Invalid Bezier curve')
  validateCurve(easing ?? 'smooth', bezier)
  return { x: num(p, 'x'), y: num(p, 'y'), rotation: num(p, 'rotation'),
    scaleX: num(p, 'scale_x') ?? num(p, 'scaleX'), scaleY: num(p, 'scale_y') ?? num(p, 'scaleY'), easing, bezier }
}

function animationOperation(p: Params): AnimationAction {
  const action = str(p, 'action', true), time = timeValue(p)
  if (action === 'set-pose') {
    if (!Array.isArray(p.poses)) throw new ParamError('poses must be an array')
    return { action, time, easing: posePatch(p).easing, poses: p.poses.map((item) => {
      const pose = object(item)
      return { boneId: str(pose, 'bone_id') ?? str(pose, 'boneId', true), ...posePatch(pose) }
    }) }
  }
  const boneId = str(p, 'bone_id', true)
  if (action === 'set-key') return { action, boneId, key: { ...posePatch(p), time } }
  if (action === 'delete-key') return { action, boneId, time }
  if (action === 'move-key') return { action, boneId, time, targetTime: timeValue(p, true) }
  if (action === 'set-interpolation') {
    const easing = str(p, 'easing', true) as BoneEasing
    return { action, boneId, time, easing, bezier: posePatch(p).bezier }
  }
  throw new ParamError('Unsupported batch operation')
}

export function parseWorkshopAnimation(p: Params): AnimationAction | AnimationBatch | undefined {
  const action = str(p, 'action', true)
  if (isAnimationAction({ action })) return animationOperation(p)
  if (action !== 'batch') return undefined
  if (!Array.isArray(p.operations) || !p.operations.length || p.operations.length > 200) throw new ParamError('Batch requires 1–200 animation operations')
  return { action, operations: p.operations.map((item) => animationOperation(object(item))) }
}
