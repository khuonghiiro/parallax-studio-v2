import type { LayerBone, LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { RigAction } from './workshopRig'
import { buildIkChain, ikRotations, solveCcd, type IkChain } from './workshopIk'
import { buildZeroAnchorOps } from './workshopStepRecord'
import { aimBoneAtPoint, computeBoneTail } from './mohoRigHelpers'

/** head = dời khớp · tail = chỉnh xương (tạo xương) · rotate = xoay FK · ik = kéo ngọn, chuỗi xương cha xoay theo. */
export type BoneDragMode = 'head' | 'tail' | 'rotate' | 'ik'

interface IkDragState {
  chain: IkChain
  /** Độ lệch giữa điểm nhấn chuột và ngọn xương để không bị giật khi bắt đầu kéo. */
  offset: { x: number; y: number }
  /** Nghiệm lần trước — giải tiếp từ đây để chuyển động liền mạch. */
  deltas: number[]
}

const WELD_SNAP_PX = 8

export function startBoneDrag(
  rig: LayerRig,
  boneId: string,
  time: number,
  editing: boolean,
  mode: BoneDragMode,
  point: { x: number; y: number },
  ikChainLength = 2
) {
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
  return {
    rig,
    bone,
    time,
    editing,
    mode,
    point,
    transform,
    parent,
    ik,
    zeroAnchorOps,
    pose: sampleBonePose({ ...rig, loop: false }, boneId, time),
    mouseAngle: (Math.atan2(point.y - transform.y, point.x - transform.x) * 180) / Math.PI
  }
}

export type BoneDrag = ReturnType<typeof startBoneDrag>

function ikDragAction(drag: BoneDrag, ik: IkDragState, point: { x: number; y: number }): RigAction {
  const target = { x: point.x + ik.offset.x, y: point.y + ik.offset.y }
  ik.deltas = solveCcd(ik.chain, target, ik.deltas)
  return {
    action: 'batch',
    operations: [
      ...drag.zeroAnchorOps,
      ...ikRotations(ik.chain, ik.deltas).map(({ boneId, rotation }) => ({
        action: 'set-key' as const,
        boneId,
        key: { time: drag.time, rotation }
      }))
    ]
  }
}

function buildWeldedHeadEditAction(bones: LayerBone[], bone: LayerBone, dx: number, dy: number, detach: boolean): RigAction {
  const newHead = { x: Number((bone.x + dx).toFixed(2)), y: Number((bone.y + dy).toFixed(2)) }
  if (detach) {
    return { action: 'update-bone', boneId: bone.id, patch: newHead }
  }

  const patches: Array<{ boneId: string; patch: Partial<Omit<LayerBone, 'id'>> }> = []
  const origTail = computeBoneTail(bone)
  const hasWeldedChild =
    !bone.pin &&
    bones.some((c) => c.parentId === bone.id && Math.hypot(origTail.x - c.x, origTail.y - c.y) <= WELD_SNAP_PX)

  if (hasWeldedChild) {
    const aimed = aimBoneAtPoint({ ...bone, ...newHead }, origTail)
    patches.push({ boneId: bone.id, patch: { ...newHead, ...aimed } })
  } else {
    patches.push({ boneId: bone.id, patch: newHead })
  }

  if (bone.parentId) {
    const parentBone = bones.find((b) => b.id === bone.parentId)
    if (parentBone && !parentBone.pin) {
      const parentTail = computeBoneTail(parentBone)
      if (Math.hypot(parentTail.x - bone.x, parentTail.y - bone.y) <= WELD_SNAP_PX) {
        patches.push({
          boneId: parentBone.id,
          patch: aimBoneAtPoint(parentBone, newHead)
        })
      }
    }
  }

  return patches.length === 1
    ? { action: 'update-bone', boneId: patches[0].boneId, patch: patches[0].patch }
    : { action: 'update-bones', patches }
}

function buildWeldedTailEditAction(
  bones: LayerBone[],
  bone: LayerBone,
  transform: { x: number; y: number },
  point: { x: number; y: number },
  shift: boolean,
  detach: boolean
): RigAction {
  const rawAngle = (Math.atan2(point.y - transform.y, point.x - transform.x) * 180) / Math.PI
  const newAngle = Number((shift ? Math.round(rawAngle / 15) * 15 : rawAngle).toFixed(2))
  const newLength = Number(Math.max(1, Math.hypot(point.x - transform.x, point.y - transform.y)).toFixed(2))

  if (detach || bone.pin) {
    return { action: 'update-bone', boneId: bone.id, patch: { length: newLength, angle: newAngle } }
  }

  const origTail = computeBoneTail(bone)
  const newTail = computeBoneTail({ x: bone.x, y: bone.y, length: newLength, angle: newAngle })
  const patches: Array<{ boneId: string; patch: Partial<Omit<LayerBone, 'id'>> }> = [
    { boneId: bone.id, patch: { length: newLength, angle: newAngle } }
  ]

  for (const child of bones) {
    if (child.parentId !== bone.id) continue
    if (Math.hypot(origTail.x - child.x, origTail.y - child.y) > WELD_SNAP_PX) continue

    const childOrigTail = computeBoneTail(child)
    const childHasGrandchild =
      !child.pin &&
      bones.some((gc) => gc.parentId === child.id && Math.hypot(childOrigTail.x - gc.x, childOrigTail.y - gc.y) <= WELD_SNAP_PX)

    if (childHasGrandchild) {
      const aimed = aimBoneAtPoint({ ...child, x: newTail.x, y: newTail.y }, childOrigTail)
      patches.push({
        boneId: child.id,
        patch: { x: Number(newTail.x.toFixed(2)), y: Number(newTail.y.toFixed(2)), ...aimed }
      })
    } else {
      patches.push({
        boneId: child.id,
        patch: { x: Number(newTail.x.toFixed(2)), y: Number(newTail.y.toFixed(2)) }
      })
    }
  }

  return patches.length === 1
    ? { action: 'update-bone', boneId: bone.id, patch: patches[0].patch }
    : { action: 'update-bones', patches }
}

export function boneDragAction(
  drag: BoneDrag,
  point: { x: number; y: number },
  shift: boolean,
  altKey = false
): RigAction {
  const { rig, bone, mode, editing, transform, pose, time, zeroAnchorOps } = drag
  const dx = point.x - drag.point.x
  const dy = point.y - drag.point.y
  if (mode === 'ik' && drag.ik) return ikDragAction(drag, drag.ik, point)

  if (mode === 'head') {
    if (editing) return buildWeldedHeadEditAction(rig.bones, bone, dx, dy, altKey)
    const local = rotatePoint(dx, dy, -(drag.parent?.rotation ?? 0))
    const sx = drag.parent?.scaleX ?? 1
    const sy = drag.parent?.scaleY ?? 1
    const keyOp = {
      action: 'set-key' as const,
      boneId: bone.id,
      key: {
        time,
        x: pose.x + (Math.abs(sx) > 1e-8 ? local.x / sx : 0),
        y: pose.y + (Math.abs(sy) > 1e-8 ? local.y / sy : 0)
      }
    }
    return zeroAnchorOps.length ? { action: 'batch', operations: [...zeroAnchorOps, keyOp] } : keyOp
  }

  if (mode === 'tail' && editing) {
    return buildWeldedTailEditAction(rig.bones, bone, transform, point, shift, altKey)
  }

  const angle = (Math.atan2(point.y - transform.y, point.x - transform.x) * 180) / Math.PI
  const delta = (((angle - drag.mouseAngle + 180) % 360) + 360) % 360 - 180
  const rotation = pose.rotation + delta
  const keyOp = {
    action: 'set-key' as const,
    boneId: bone.id,
    key: { time, rotation: editing && shift ? Math.round(rotation / 15) * 15 : rotation }
  }
  return zeroAnchorOps.length ? { action: 'batch', operations: [...zeroAnchorOps, keyOp] } : keyOp
}
