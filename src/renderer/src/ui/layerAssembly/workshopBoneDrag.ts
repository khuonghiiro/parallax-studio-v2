import type { LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { RigAction } from './workshopRig'
import { buildIkChain, ikRotations, solveCcd, type IkChain } from './workshopIk'
import { buildZeroAnchorOps } from './workshopStepRecord'

/** head = dời khớp · tail = chỉnh xương (tạo xương) · rotate = xoay FK · ik = kéo ngọn, chuỗi xương cha xoay theo. */
export type BoneDragMode = 'head' | 'tail' | 'rotate' | 'ik'

interface IkDragState {
  chain: IkChain
  /** Độ lệch giữa điểm nhấn chuột và ngọn xương để không bị giật khi bắt đầu kéo. */
  offset: { x: number; y: number }
  /** Nghiệm lần trước — giải tiếp từ đây để chuyển động liền mạch. */
  deltas: number[]
}

export function startBoneDrag(rig: LayerRig, boneId: string, time: number, editing: boolean,
  mode: BoneDragMode, point: { x: number; y: number }, ikChainLength = 2) {
  const bone = rig.bones.find((b) => b.id === boneId)!
  const transforms = evaluateRig({ ...rig, loop: false }, time, editing)
  const transform = transforms.get(boneId)!
  const parent = bone.parentId ? transforms.get(bone.parentId) : undefined
  let ik: IkDragState | undefined
  if (mode === 'ik' && !editing) {
    const chain = buildIkChain(rig, boneId, ikChainLength, time)
    const tip = chain.points[chain.points.length - 1]
    ik = { chain, offset: { x: tip.x - point.x, y: tip.y - point.y }, deltas: chain.boneIds.map(() => 0) }
  }
  const affectedBoneIds = ik ? ik.chain.boneIds : [boneId]
  const zeroAnchorOps = editing ? [] : buildZeroAnchorOps(rig, affectedBoneIds, time)
  return { bone, time, editing, mode, point, transform, parent, ik, zeroAnchorOps,
    pose: sampleBonePose({ ...rig, loop: false }, boneId, time),
    mouseAngle: Math.atan2(point.y - transform.y, point.x - transform.x) * 180 / Math.PI }
}

export type BoneDrag = ReturnType<typeof startBoneDrag>

function ikDragAction(drag: BoneDrag, ik: IkDragState, point: { x: number; y: number }): RigAction {
  const target = { x: point.x + ik.offset.x, y: point.y + ik.offset.y }
  ik.deltas = solveCcd(ik.chain, target, ik.deltas)
  return {
    action: 'batch',
    operations: [
      ...drag.zeroAnchorOps,
      ...ikRotations(ik.chain, ik.deltas).map(({ boneId, rotation }) => ({ action: 'set-key' as const, boneId, key: { time: drag.time, rotation } }))
    ]
  }
}

export function boneDragAction(drag: BoneDrag, point: { x: number; y: number }, shift: boolean): RigAction {
  const { bone, mode, editing, transform, pose, time, zeroAnchorOps } = drag
  const dx = point.x - drag.point.x, dy = point.y - drag.point.y
  if (mode === 'ik' && drag.ik) return ikDragAction(drag, drag.ik, point)
  if (mode === 'head') {
    if (editing) return { action: 'update-bone', boneId: bone.id, patch: { x: bone.x + dx, y: bone.y + dy } }
    const local = rotatePoint(dx, dy, -(drag.parent?.rotation ?? 0))
    const sx = drag.parent?.scaleX ?? 1, sy = drag.parent?.scaleY ?? 1
    const keyOp = { action: 'set-key' as const, boneId: bone.id, key: { time,
      x: pose.x + (Math.abs(sx) > 1e-8 ? local.x / sx : 0),
      y: pose.y + (Math.abs(sy) > 1e-8 ? local.y / sy : 0) } }
    return zeroAnchorOps.length ? { action: 'batch', operations: [...zeroAnchorOps, keyOp] } : keyOp
  }
  const angle = Math.atan2(point.y - transform.y, point.x - transform.x) * 180 / Math.PI
  if (mode === 'tail' && editing) return { action: 'update-bone', boneId: bone.id,
    patch: { length: Math.max(1, Math.hypot(point.x - transform.x, point.y - transform.y)), angle: shift ? Math.round(angle / 15) * 15 : angle } }
  const delta = ((angle - drag.mouseAngle + 180) % 360 + 360) % 360 - 180
  const rotation = pose.rotation + delta
  const keyOp = { action: 'set-key' as const, boneId: bone.id, key: { time, rotation: editing && shift ? Math.round(rotation / 15) * 15 : rotation } }
  return zeroAnchorOps.length ? { action: 'batch', operations: [...zeroAnchorOps, keyOp] } : keyOp
}
