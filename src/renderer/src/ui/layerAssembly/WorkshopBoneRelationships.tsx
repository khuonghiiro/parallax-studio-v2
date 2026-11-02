import type { LayerBone } from '@shared/layerRig'
import type { BoneTransform } from '../../engine/layerRig'
import { rotatePoint } from '../../engine/layerRig'

export interface WorkshopBoneRelationshipsProps {
  bones: LayerBone[]
  transforms: Map<string, BoneTransform>
}

/**
 * Vẽ các đường liên kết phân cấp cha - con (Relationship Lines) giữa các xương:
 * - Tự động nhận diện hoặc dùng trường `parentJoint`: nối chính xác vào Trục Ngọn (Tail)
 *   hoặc Trục Gốc (Head) của xương cha.
 * - Triệt tiêu lỗi nối nhầm trục (ví dụ cành cây trên ngọn bị kéo dây xuống gốc thân cây).
 * - Tự ẩn đường nét đứt khi 2 khớp đã hàn khít (khoảng cách ≤ 4px).
 */
export function WorkshopBoneRelationships({ bones, transforms }: WorkshopBoneRelationshipsProps) {
  return (
    <>
      {bones.map((bone) => {
        if (!bone.parentId) return null
        const parent = bones.find((b) => b.id === bone.parentId)
        if (!parent) return null
        const parentTf = transforms.get(parent.id)
        const childTf = transforms.get(bone.id)
        if (!parentTf || !childTf) return null

        // Tọa độ tư thế hiện tại của xương cha:
        // 1. Trục gốc (Head - vòng tròn to)
        const headX = parentTf.x
        const headY = parentTf.y

        // 2. Trục ngọn (Tail - đầu nhọn)
        const parentTail = rotatePoint(parent.length, 0, parent.angle + parentTf.rotation)
        const tailX = parentTf.x + parentTail.x
        const tailY = parentTf.y + parentTail.y

        // Phân định khớp neo: ưu tiên parentJoint nếu có; nếu chưa có thì đo khoảng cách ở dáng gốc
        const dHead = Math.hypot(bone.x - parent.x, bone.y - parent.y)
        const parentTailRest = rotatePoint(parent.length, 0, parent.angle)
        const dTail = Math.hypot(bone.x - (parent.x + parentTailRest.x), bone.y - (parent.y + parentTailRest.y))
        const connectsToHead = bone.parentJoint === 'head' || (bone.parentJoint !== 'tail' && dHead < dTail)

        const sourceX = connectsToHead ? headX : tailX
        const sourceY = connectsToHead ? headY : tailY

        // Nếu khớp đã trùng khít (welded joint ≤ 4px), không cần vẽ đường đứt đoạn
        if (Math.hypot(sourceX - childTf.x, sourceY - childTf.y) > 4) {
          const typeClass = connectsToHead ? 'to-head' : 'to-tail'
          return (
            <g key={`rel-${bone.id}`} className="lw-bone-rel-group">
              <line
                x1={sourceX}
                y1={sourceY}
                x2={childTf.x}
                y2={childTf.y}
                className={`lw-bone-relationship ${typeClass}`}
              />
              <circle cx={sourceX} cy={sourceY} r={3.2} className={`lw-bone-rel-node parent-node ${typeClass}`} />
              <circle cx={childTf.x} cy={childTf.y} r={3.6} className={`lw-bone-rel-node child-node ${typeClass}`} />
            </g>
          )
        }
        return null
      })}
    </>
  )
}
