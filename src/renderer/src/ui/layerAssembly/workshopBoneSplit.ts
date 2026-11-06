import type { LayerBone, LayerRig } from '@shared/layerRig'
import type { LayerComposite } from './types'

export interface SplitBoneResult {
  composite: LayerComposite
  parentBone: LayerBone
  childBone: LayerBone
}

/**
 * Chia đôi 1 xương thành 2 đoạn (chuẩn Moho Pro / Spine / DragonBones):
 * - Xương gốc (Đùi / Bắp tay) giữ nửa chiều dài đầu (50%).
 * - Tạo xương con mới (Cẳng chân / Cẳng tay) ở nửa sau, tự động nối cha-con.
 * - Khớp ở giữa trở thành Khớp Gối (Knee) hoặc Khớp Khuỷu (Elbow), tự gán preset gập Moho [0, 140°].
 * - Bất kỳ con nào của xương cũ được chuyển sang làm con của xương mới để bảo toàn chuỗi.
 * - Layer đang bind vào xương cũ sẽ được bổ sung xương mới vào extraBoneIds và bật bindingMode soft.
 */
export function splitBoneInHalf(composite: LayerComposite, boneId: string): SplitBoneResult {
  const rig = composite.rig
  if (!rig) throw new Error('Composite không có khung xương')
  const bone = rig.bones.find((b) => b.id === boneId)
  if (!bone) throw new Error(`Không tìm thấy xương ${boneId}`)

  const totalLen = bone.length
  if (totalLen < 12) throw new Error('Xương quá ngắn để chia đôi (tối thiểu 12px)')

  const len1 = Math.round(totalLen * 0.5)
  const len2 = totalLen - len1

  // Tính toạ độ ngọn của nửa 1 (điểm gốc của xương con mới)
  const rad = (bone.angle * Math.PI) / 180
  const midX = Number((bone.x + Math.cos(rad) * len1).toFixed(2))
  const midY = Number((bone.y + Math.sin(rad) * len1).toFixed(2))

  // Đặt tên thông minh theo ngữ cảnh
  let parentName = bone.name
  let childName = `${bone.name} (Đốt 2)`
  let isLeg = false
  let isArm = false

  const lowerName = bone.name.toLowerCase()
  if (lowerName.includes('chân')) {
    isLeg = true
    parentName = bone.name.replace(/xương\s*chân/i, 'Xương Đùi')
    childName = bone.name.replace(/xương\s*chân/i, 'Xương Cẳng Chân')
  } else if (lowerName.includes('tay')) {
    isArm = true
    parentName = bone.name.replace(/xương\s*tay/i, 'Xương Bắp Tay')
    childName = bone.name.replace(/xương\s*tay/i, 'Xương Cẳng Tay')
  }

  const childBoneId = `${bone.id}-sub-${Date.now().toString(36).slice(-4)}`

  // Tạo xương con mới
  const childBone: LayerBone = {
    id: childBoneId,
    name: childName,
    parentId: bone.id,
    x: midX,
    y: midY,
    length: len2,
    angle: bone.angle,
    strength: bone.strength ?? 1,
    influenceReach: bone.influenceReach ?? 1,
    // Gán giới hạn góc khớp gối / khuỷu chuẩn Moho
    minAngle: isLeg ? 0 : isArm ? -140 : -90,
    maxAngle: isLeg ? 140 : isArm ? 0 : 90
  }

  // Cập nhật các xương con cũ của bone -> chuyển sang làm con của childBone
  const nextBones: LayerBone[] = rig.bones.map((b) => {
    if (b.id === bone.id) {
      return {
        ...b,
        name: parentName,
        length: len1
      }
    }
    if (b.parentId === bone.id && b.id !== childBoneId) {
      return {
        ...b,
        parentId: childBoneId
      }
    }
    return b
  })

  // Thêm xương con mới vào danh sách xương (ngay sau bone cha)
  const parentIdx = nextBones.findIndex((b) => b.id === bone.id)
  nextBones.splice(parentIdx + 1, 0, childBone)

  // Cập nhật layer: nếu layer đang bind vào bone.id, thêm childBoneId vào extraBoneIds và bật soft
  const nextLayers = composite.layers.map((l) => {
    if (l.boneId === bone.id) {
      const extra = Array.isArray(l.extraBoneIds) ? [...l.extraBoneIds] : []
      if (!extra.includes(childBoneId)) extra.push(childBoneId)
      return {
        ...l,
        bindingMode: 'soft' as const,
        extraBoneIds: extra
      }
    }
    return l
  })

  const nextRig: LayerRig = {
    ...rig,
    bones: nextBones
  }

  const nextComposite: LayerComposite = {
    ...composite,
    rig: nextRig,
    layers: nextLayers
  }

  return {
    composite: nextComposite,
    parentBone: nextBones.find((b) => b.id === bone.id)!,
    childBone
  }
}
