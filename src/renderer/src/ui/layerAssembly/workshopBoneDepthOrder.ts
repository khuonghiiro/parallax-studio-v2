import type { LayerBone, LayerRig } from '@shared/layerRig'
import { evaluateRig, sampleBonePose } from '../../engine/layerRig'
import type { AssembledLayerItem, LayerComposite } from './types'
import { applyRigAction, emptyRig, ensureRigClips } from './workshopRig'
import type { AnimationAction } from './workshopAnimation'
import { buildZeroAnchorOps, setStepRecordState } from './workshopStepRecord'

export const BONE_Z_ORDER_STEP = 10
export const BONE_Z_ORDER_LARGE_STEP = 30
export const BONE_Z_ORDER_MIN = -500
export const BONE_Z_ORDER_MAX = 500

export type BoneDepthSemanticPreset = 'behind-back' | 'default' | 'front-torso' | 'front-face'

export interface BoneDepthSummary {
  bone: LayerBone
  parentBone: LayerBone | null
  ancestors: LayerBone[]
  descendants: LayerBone[]
  localZOrder: number
  inheritedZOrder: number
  effectiveZOrder: number
  subtreeLayers: AssembledLayerItem[]
  torsoRefZ: number
  frontHeadRefZ: number
  backBodyRefZ: number
  zone: BoneDepthSemanticPreset
  zoneLabel: string
}

export function clampBoneZOrder(val: number): number {
  if (!Number.isFinite(val)) return 0
  return Math.max(BONE_Z_ORDER_MIN, Math.min(BONE_Z_ORDER_MAX, Math.round(val)))
}

/** Lấy toàn bộ chuỗi xương con / cháu của một xương chính theo thứ tự phân cấp (an toàn chống vòng lặp). */
export function getDescendantBones(bones: LayerBone[], boneId: string): LayerBone[] {
  const result: LayerBone[] = []
  const visited = new Set<string>([boneId])
  const queue = [boneId]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const candidate of bones) {
      if (candidate.parentId === current && !visited.has(candidate.id)) {
        visited.add(candidate.id)
        result.push(candidate)
        queue.push(candidate.id)
      }
    }
  }
  return result
}

/** Lấy chuỗi xương cha tổ tiên từ gốc xuống cha trực tiếp của `boneId`. */
export function getAncestorBones(bones: LayerBone[], boneId: string): LayerBone[] {
  const byId = new Map(bones.map((b) => [b.id, b]))
  const chain: LayerBone[] = []
  const visited = new Set<string>([boneId])
  let cur = byId.get(boneId)?.parentId
  while (cur && !visited.has(cur)) {
    const parent = byId.get(cur)
    if (!parent) break
    visited.add(cur)
    chain.unshift(parent)
    cur = parent.parentId
  }
  return chain
}

/** Tổng hợp trạng thái Z-Index của xương đang chọn, lượng kế thừa từ xương cha và danh sách xương con ăn theo. */
export function getBoneDepthSummary(
  composite: LayerComposite,
  rig: LayerRig,
  boneId: string,
  time: number
): BoneDepthSummary | null {
  const bone = rig.bones.find((b) => b.id === boneId)
  if (!bone) return null

  const flatRig: LayerRig = { ...rig, loop: false }
  const clampedTime = Math.max(0, Math.min(rig.duration || 1, time))
  const transforms = evaluateRig(flatRig, clampedTime)
  const pose = sampleBonePose(flatRig, boneId, clampedTime)

  const ancestors = getAncestorBones(rig.bones, boneId)
  const parentBone = ancestors.at(-1) ?? null
  const descendants = getDescendantBones(rig.bones, boneId)

  const localZOrder = Math.round(pose.zOrder ?? 0)
  const inheritedZOrder = parentBone ? Math.round(transforms.get(parentBone.id)?.zOrder ?? 0) : 0
  const effectiveZOrder = Math.round(transforms.get(boneId)?.zOrder ?? inheritedZOrder + localZOrder)

  const subtreeIds = new Set<string>([boneId, ...descendants.map((d) => d.id)])
  const subtreeLayers = composite.layers.filter((l) => !l.hidden && l.boneId && subtreeIds.has(l.boneId))
  const otherLayers = composite.layers.filter((l) => !l.hidden && (!l.boneId || !subtreeIds.has(l.boneId)))

  const torsoCandidates = otherLayers.filter((l) =>
    /(torso|chest|body|shirt|vest|thân|ngực|áo)/i.test(`${l.id} ${l.name} ${l.slot ?? ''}`)
  )
  const torsoRefZ = torsoCandidates.length > 0 ? Math.min(...torsoCandidates.map((l) => l.z || 0)) : 0

  const frontHeadCandidates = otherLayers.filter((l) =>
    /(head|face|glass|visor|bang|đầu|mặt|biểu cảm|kính|mái)/i.test(`${l.id} ${l.name} ${l.slot ?? ''}`)
  )
  const frontHeadRefZ =
    frontHeadCandidates.length > 0
      ? Math.min(...frontHeadCandidates.map((l) => l.z || 0))
      : Math.min(torsoRefZ - 30, ...(otherLayers.length ? otherLayers.map((l) => l.z || 0) : [-35]))

  const backBodyCandidates = otherLayers.filter((l) =>
    /(torso|pelvis|hip|thigh|shin|leg|body|thân|hông|đùi|chân|quần)/i.test(`${l.id} ${l.name} ${l.slot ?? ''}`)
  )
  const backBodyRefZ =
    backBodyCandidates.length > 0
      ? Math.max(...backBodyCandidates.map((l) => l.z || 0))
      : Math.max(torsoRefZ + 25, 25)

  let zone: BoneDepthSemanticPreset = 'default'
  if (Math.abs(effectiveZOrder) < 3) {
    zone = 'default'
  } else if (subtreeLayers.length > 0) {
    const effectiveLayerZs = subtreeLayers.map((l) => {
      const tfZ = l.boneId ? (transforms.get(l.boneId)?.zOrder ?? effectiveZOrder) : effectiveZOrder
      return (l.z || 0) - tfZ
    })
    const maxEffZ = Math.max(...effectiveLayerZs)
    const minEffZ = Math.min(...effectiveLayerZs)
    if (maxEffZ < frontHeadRefZ) zone = 'front-face'
    else if (maxEffZ < torsoRefZ) zone = 'front-torso'
    else if (minEffZ > backBodyRefZ || effectiveZOrder <= -15) zone = 'behind-back'
    else zone = effectiveZOrder > 0 ? 'front-torso' : 'behind-back'
  } else {
    if (effectiveZOrder >= 75) zone = 'front-face'
    else if (effectiveZOrder >= 10) zone = 'front-torso'
    else if (effectiveZOrder <= -10) zone = 'behind-back'
  }

  const zoneLabel =
    zone === 'front-face'
      ? 'Trước mặt'
      : zone === 'front-torso'
        ? 'Trước thân'
        : zone === 'behind-back'
          ? 'Sau lưng'
          : 'Mặc định'

  return {
    bone,
    parentBone,
    ancestors,
    descendants,
    localZOrder,
    inheritedZOrder,
    effectiveZOrder,
    subtreeLayers,
    torsoRefZ,
    frontHeadRefZ,
    backBodyRefZ,
    zone,
    zoneLabel
  }
}

/** Tính giá trị `zOrder` tối ưu cho xương cha khi bấm nhanh 1 trong 4 vùng giải phẫu (Sau lưng / Mặc định / Trước thân / Trước mặt). */
export function computeSemanticBoneZOrder(
  composite: LayerComposite,
  rig: LayerRig,
  boneId: string,
  time: number,
  preset: BoneDepthSemanticPreset
): { localZOrder: number; resetDescendantIds: string[] } {
  const summary = getBoneDepthSummary(composite, rig, boneId, time)
  if (!summary) return { localZOrder: 0, resetDescendantIds: [] }

  const flatRig: LayerRig = { ...rig, loop: false }
  const clampedTime = Math.max(0, Math.min(rig.duration || 1, time))
  const resetDescendantIds = summary.descendants
    .filter((d) => Math.abs(sampleBonePose(flatRig, d.id, clampedTime).zOrder ?? 0) > 0.5)
    .map((d) => d.id)

  if (preset === 'default') {
    return { localZOrder: 0, resetDescendantIds }
  }

  const baseZs = summary.subtreeLayers.map((l) => l.z || 0)
  const maxBaseZ = baseZs.length > 0 ? Math.max(...baseZs) : 35
  const minBaseZ = baseZs.length > 0 ? Math.min(...baseZs) : 35

  if (preset === 'front-torso') {
    const desiredEffective = Math.max(20, Math.ceil((maxBaseZ - (summary.torsoRefZ - 15)) / 5) * 5)
    return {
      localZOrder: clampBoneZOrder(desiredEffective - summary.inheritedZOrder),
      resetDescendantIds
    }
  }

  if (preset === 'front-face') {
    const desiredEffective = Math.max(55, Math.ceil((maxBaseZ - (summary.frontHeadRefZ - 10)) / 5) * 5)
    return {
      localZOrder: clampBoneZOrder(desiredEffective - summary.inheritedZOrder),
      resetDescendantIds
    }
  }

  // 'behind-back': đảm bảo mọi mảnh con trong nhánh xương lùi sâu ra sau thân & chân
  const neededForBack = Math.floor((minBaseZ - (summary.backBodyRefZ + 20)) / 5) * 5
  const desiredEffective = Math.min(-20, neededForBack)
  return {
    localZOrder: clampBoneZOrder(desiredEffective - summary.inheritedZOrder),
    resetDescendantIds
  }
}

/** Ghi giá trị `zOrder` vào keyframe của xương tại `time` (tự động neo mốc 0.00s nếu chưa có keyframe trước đó). */
export function applyBoneZOrderValue(
  composite: LayerComposite,
  boneId: string,
  time: number,
  nextLocalZOrder: number,
  resetDescendantIds: string[] = []
): LayerComposite {
  const { rig } = ensureRigClips(composite.rig ?? emptyRig())
  const bone = rig.bones.find((b) => b.id === boneId)
  if (!bone) return composite

  const clampedTime = Number(Math.max(0, Math.min(rig.duration || 1, time)).toFixed(4))
  const safeLocal = clampBoneZOrder(nextLocalZOrder)
  const affectedIds = [boneId, ...resetDescendantIds.filter((id) => id !== boneId)]
  const anchorOps = buildZeroAnchorOps(rig, affectedIds, clampedTime)

  const keyOps: AnimationAction[] = [
    {
      action: 'set-key',
      boneId,
      key: { time: clampedTime, zOrder: safeLocal }
    },
    ...resetDescendantIds
      .filter((id) => id !== boneId)
      .map(
        (id): AnimationAction => ({
          action: 'set-key',
          boneId: id,
          key: { time: clampedTime, zOrder: 0 }
        })
      )
  ]

  const allOps = [...anchorOps, ...keyOps]
  const next =
    allOps.length === 1
      ? applyRigAction(composite, allOps[0])
      : applyRigAction(composite, { action: 'batch', operations: allOps })

  const nextRig = ensureRigClips(next.rig ?? rig).rig
  const summary = getBoneDepthSummary(next, nextRig, boneId, clampedTime)
  const childCount = summary?.descendants.length ?? 0
  const sign = (summary?.effectiveZOrder ?? safeLocal) > 0 ? '+' : ''
  const childNote = childCount > 0 ? ` · ${childCount} xương con ăn theo` : ''
  setStepRecordState({
    pendingConfirm: true,
    status: `Z-Index "${bone.name}" → ${sign}${summary?.effectiveZOrder ?? safeLocal} (${summary?.zoneLabel ?? 'Mặc định'}${childNote}) tại ${clampedTime.toFixed(2)}s`
  })
  return next
}

/** Tăng / giảm `zOrder` của xương đang chọn bằng phím `+` / `-` tại thời điểm hiện tại. */
export function applyBoneZOrderStep(
  composite: LayerComposite,
  boneId: string,
  time: number,
  deltaZOrder: number
): LayerComposite {
  const { rig } = ensureRigClips(composite.rig ?? emptyRig())
  const bone = rig.bones.find((b) => b.id === boneId)
  if (!bone) return composite
  const clampedTime = Math.max(0, Math.min(rig.duration || 1, time))
  const currentPose = sampleBonePose({ ...rig, loop: false }, boneId, clampedTime)
  const nextLocal = clampBoneZOrder((currentPose.zOrder ?? 0) + deltaZOrder)
  return applyBoneZOrderValue(composite, boneId, clampedTime, nextLocal)
}

/** Áp dụng nhanh 1 trong 4 mức Z-Index giải phẫu (Sau lưng / Mặc định / Trước thân / Trước mặt). */
export function applyBoneZOrderPreset(
  composite: LayerComposite,
  boneId: string,
  time: number,
  preset: BoneDepthSemanticPreset
): LayerComposite {
  const { rig } = ensureRigClips(composite.rig ?? emptyRig())
  const { localZOrder, resetDescendantIds } = computeSemanticBoneZOrder(composite, rig, boneId, time, preset)
  return applyBoneZOrderValue(composite, boneId, time, localZOrder, resetDescendantIds)
}
