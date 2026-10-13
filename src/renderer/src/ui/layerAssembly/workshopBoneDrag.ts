import type { LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { RigAction } from './workshopRig'

export type BoneDragMode = 'head' | 'tail' | 'rotate'
export function startBoneDrag(rig: LayerRig, boneId: string, time: number, editing: boolean,
  mode: BoneDragMode, point: { x: number; y: number }) {
  const bone = rig.bones.find((b) => b.id === boneId)!
  const transforms = evaluateRig({ ...rig, loop: false }, time, editing)
  const transform = transforms.get(boneId)!
  const parent = bone.parentId ? transforms.get(bone.parentId) : undefined
  return { bone, time, editing, mode, point, transform, parent,
    pose: sampleBonePose({ ...rig, loop: false }, boneId, time),
    mouseAngle: Math.atan2(point.y - transform.y, point.x - transform.x) * 180 / Math.PI }
}

export function boneDragAction(drag: ReturnType<typeof startBoneDrag>, point: { x: number; y: number }, shift: boolean): RigAction {
  const { bone, mode, editing, transform, pose, time } = drag
  const dx = point.x - drag.point.x, dy = point.y - drag.point.y
  if (mode === 'head') {
    if (editing) return { action: 'update-bone', boneId: bone.id, patch: { x: bone.x + dx, y: bone.y + dy } }
    const local = rotatePoint(dx, dy, -(drag.parent?.rotation ?? 0))
    const sx = drag.parent?.scaleX ?? 1, sy = drag.parent?.scaleY ?? 1
    return { action: 'set-key', boneId: bone.id, key: { time,
      x: pose.x + (Math.abs(sx) > 1e-8 ? local.x / sx : 0),
      y: pose.y + (Math.abs(sy) > 1e-8 ? local.y / sy : 0) } }
  }
  const angle = Math.atan2(point.y - transform.y, point.x - transform.x) * 180 / Math.PI
  if (mode === 'tail' && editing) return { action: 'update-bone', boneId: bone.id,
    patch: { length: Math.max(1, Math.hypot(point.x - transform.x, point.y - transform.y)), angle: shift ? Math.round(angle / 15) * 15 : angle } }
  const delta = ((angle - drag.mouseAngle + 180) % 360 + 360) % 360 - 180
  const rotation = pose.rotation + delta
  return { action: 'set-key', boneId: bone.id, key: { time, rotation: shift ? Math.round(rotation / 15) * 15 : rotation } }
}
