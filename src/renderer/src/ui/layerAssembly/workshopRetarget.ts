import type { AnimationClip, BoneKeyframe, LayerBone } from '@shared/layerRig'

/** Các nhóm ngữ nghĩa xương phổ biến để ánh xạ thông minh giữa các nhân vật 2.5D */
export const SEMANTIC_BONE_GROUPS: Record<string, string[]> = {
  pelvis: ['pelvis', 'hip', 'root', 'hông', 'đáy', 'gốc', 'eo'],
  torso: ['torso', 'chest', 'spine', 'body', 'thân', 'ngực', 'lưng', 'bụng'],
  head: ['head', 'neck', 'đầu', 'cổ', 'mặt'],
  armL: ['arm-l', 'arm_l', 'upperarm-l', 'bắp tay trái', 'tay trái', 'arm left', 'left arm'],
  forearmL: ['forearm-l', 'forearm_l', 'lowerarm-l', 'cẳng tay trái', 'khuỷu tay trái', 'forearm left', 'left forearm', 'bàn tay trái'],
  armR: ['arm-r', 'arm_r', 'upperarm-r', 'bắp tay phải', 'tay phải', 'arm right', 'right arm'],
  forearmR: ['forearm-r', 'forearm_r', 'lowerarm-r', 'cẳng tay phải', 'khuỷu tay phải', 'forearm right', 'right forearm', 'bàn tay phải'],
  thighL: ['thigh-l', 'thigh_l', 'upperleg-l', 'đùi trái', 'chân trái', 'thigh left', 'left thigh'],
  shinL: ['shin-l', 'shin_l', 'lowerleg-l', 'cẳng chân trái', 'bàn chân trái', 'shin left', 'left shin', 'foot-l'],
  thighR: ['thigh-r', 'thigh_r', 'upperleg-r', 'đùi phải', 'chân phải', 'thigh right', 'right thigh'],
  shinR: ['shin-r', 'shin_r', 'lowerleg-r', 'cẳng chân phải', 'bàn chân phải', 'shin right', 'right shin', 'foot-r'],
  chainRoot: ['chain-root', 'root', 'gốc', 'stem', 'thân gốc'],
  chainMid: ['chain-mid', 'mid', 'giữa', 'tán', 'nhánh'],
  chainTip: ['chain-tip', 'tip', 'ngọn', 'hoa', 'lá', 'đuôi', 'chóp']
}

/** Xác định nhóm ngữ nghĩa của một xương theo id và tên */
export function findSemanticGroup(bone: { id: string; name?: string }): string | null {
  const normId = bone.id.toLowerCase()
  const normName = (bone.name || '').toLowerCase()
  for (const [group, patterns] of Object.entries(SEMANTIC_BONE_GROUPS)) {
    for (const p of patterns) {
      if (normId.includes(p) || normName.includes(p)) {
        return group
      }
    }
  }
  return null
}

/** Ánh xạ danh sách xương nguồn sang xương đích dựa trên ID chính xác và ngữ nghĩa tương đồng */
export function mapBonesBetweenArmatures(
  sourceBones: LayerBone[],
  targetBones: LayerBone[]
): Map<string, LayerBone> {
  const mapping = new Map<string, LayerBone>()
  const targetMapById = new Map(targetBones.map((b) => [b.id, b]))
  const unassignedTarget = new Set(targetBones)

  // 1. Khớp chính xác theo ID trước
  for (const s of sourceBones) {
    const direct = targetMapById.get(s.id)
    if (direct) {
      mapping.set(s.id, direct)
      unassignedTarget.delete(direct)
    }
  }

  // 2. Khớp theo nhóm ngữ nghĩa xương
  for (const s of sourceBones) {
    if (mapping.has(s.id)) continue
    const sGroup = findSemanticGroup(s)
    if (!sGroup) continue

    for (const t of unassignedTarget) {
      const tGroup = findSemanticGroup(t)
      if (tGroup === sGroup) {
        mapping.set(s.id, t)
        unassignedTarget.delete(t)
        break
      }
    }
  }

  return mapping
}

/** Chuyển giao và kế thừa animation clip từ bộ xương nguồn sang bộ xương đích */
export function retargetAnimationClip(
  sourceClip: AnimationClip,
  sourceBones: LayerBone[],
  targetBones: LayerBone[],
  options?: {
    clipName?: string
    scalePositionWithBoneLength?: boolean
  }
): AnimationClip {
  const mapping = mapBonesBetweenArmatures(sourceBones, targetBones)
  const sourceBoneMap = new Map(sourceBones.map((b) => [b.id, b]))
  const targetTracks: Record<string, BoneKeyframe[]> = {}

  for (const [srcId, keyframes] of Object.entries(sourceClip.tracks)) {
    const tgtBone = mapping.get(srcId)
    if (!tgtBone) continue

    const srcBone = sourceBoneMap.get(srcId)
    const lengthRatio =
      options?.scalePositionWithBoneLength && srcBone && srcBone.length > 0
        ? tgtBone.length / srcBone.length
        : 1.0

    targetTracks[tgtBone.id] = keyframes.map((k) => ({
      ...k,
      x: Number((k.x * lengthRatio).toFixed(2)),
      y: Number((k.y * lengthRatio).toFixed(2)),
      rotation: k.rotation,
      scaleX: k.scaleX ?? 1,
      scaleY: k.scaleY ?? 1,
      easing: k.easing
    }))
  }

  const newId = `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const newName = options?.clipName || `${sourceClip.name} (Kế thừa)`

  return {
    id: newId,
    name: newName,
    duration: sourceClip.duration,
    loop: sourceClip.loop,
    tracks: targetTracks,
    description: sourceClip.description
      ? `${sourceClip.description} (Kế thừa từ động tác gốc)`
      : undefined
  }
}
