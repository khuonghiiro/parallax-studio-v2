import type { LayerBone } from '@shared/layerRig'

/**
 * Giới hạn góc khớp xương chuẩn Adobe Animate (Joint › Rotation › Constrain) và Moho (Angle Constraints).
 * Góc giới hạn tính tương đối với dáng gốc Frame 0 (pose.rotation), dương = xoay theo chiều kim đồng hồ.
 */

export const ANGLE_LIMIT_RANGE = 360

export interface JointLimitPreset {
  id: string
  label: string
  hint: string
  /** null = xoay tự do (gỡ giới hạn). */
  range: [number, number] | null
}

export const JOINT_LIMIT_PRESETS: JointLimitPreset[] = [
  { id: 'free', label: 'Tự do', hint: 'Gỡ giới hạn, khớp xoay 360°', range: null },
  { id: 'knee', label: 'Gối 0…140°', hint: 'Khớp bản lề chỉ gập một chiều (gối, khuỷu chân sau)', range: [0, 140] },
  { id: 'elbow', label: 'Khuỷu −140…0°', hint: 'Khớp bản lề gập chiều ngược lại (khuỷu tay, gối trước)', range: [-140, 0] },
  { id: 'neck', label: 'Cổ ±45°', hint: 'Cổ, đầu, thân chính: xoay vừa phải', range: [-45, 45] },
  { id: 'tail', label: 'Đuôi ±60°', hint: 'Đuôi, xúc tu, râu, vây: uốn mềm hai phía', range: [-60, 60] },
  { id: 'lock', label: 'Khoá cứng', hint: 'Khoá khớp không cho xoay (giống Pin của Adobe Animate)', range: [0, 0] }
]

export function hasAngleLimit(bone: Pick<LayerBone, 'minAngle' | 'maxAngle'> | undefined | null): boolean {
  return Boolean(bone && Number.isFinite(bone.minAngle) && Number.isFinite(bone.maxAngle))
}

/** Kẹp góc xoay tương đối của xương vào khoảng giới hạn (nếu có). */
export function clampBoneRotation(bone: Pick<LayerBone, 'minAngle' | 'maxAngle'> | undefined | null, rotation: number): number {
  if (!bone || !hasAngleLimit(bone)) return rotation
  const min = bone.minAngle as number
  const max = bone.maxAngle as number
  return Math.max(min, Math.min(max, rotation))
}

/** Giới hạn góc khi phản chiếu Trái ⇄ Phải: chiều xoay bị đảo nên [min, max] → [−max, −min]. */
export function mirrorAngleLimits(
  bone: Pick<LayerBone, 'minAngle' | 'maxAngle'>
): Pick<LayerBone, 'minAngle' | 'maxAngle'> {
  if (!hasAngleLimit(bone)) return {}
  return { minAngle: -(bone.maxAngle as number) || 0, maxAngle: -(bone.minAngle as number) || 0 }
}

/** Ném lỗi nếu cặp giới hạn góc không hợp lệ (thiếu một đầu, đảo ngược hoặc vượt ±360°). */
export function assertValidAngleLimits(bone: Pick<LayerBone, 'minAngle' | 'maxAngle'>): void {
  const hasMin = bone.minAngle !== undefined
  const hasMax = bone.maxAngle !== undefined
  if (!hasMin && !hasMax) return
  if (hasMin !== hasMax) throw new Error('Bone angle limit needs both minAngle and maxAngle')
  const min = bone.minAngle as number
  const max = bone.maxAngle as number
  if (![min, max].every(Number.isFinite) || min > max || min < -ANGLE_LIMIT_RANGE || max > ANGLE_LIMIT_RANGE) {
    throw new Error('Invalid bone angle limit (requires -360 ≤ minAngle ≤ maxAngle ≤ 360)')
  }
}

/** Patch gỡ giới hạn góc (dùng cho update-bone). */
export const CLEAR_ANGLE_LIMIT: Pick<LayerBone, 'minAngle' | 'maxAngle'> = { minAngle: undefined, maxAngle: undefined }

/** Bỏ các trường giới hạn đang là undefined để JSON dự án gọn gàng. */
export function stripEmptyAngleLimit<T extends Pick<LayerBone, 'minAngle' | 'maxAngle'>>(bone: T): T {
  if (bone.minAngle !== undefined || bone.maxAngle !== undefined) return bone
  if (!('minAngle' in bone) && !('maxAngle' in bone)) return bone
  const { minAngle: _min, maxAngle: _max, ...rest } = bone
  return rest as T
}
