import type { LayerBone } from '@shared/layerRig'
import type { BoneTransform } from '../../engine/layerRig'
import { hasAngleLimit } from './boneConstraints'
import { describeArc } from './WorkshopBoneConstraintCard'
import '../../styles/layerWorkshopCreatureRig.css'

/**
 * Cung giới hạn góc khớp vẽ trên sân khấu 2D quanh khớp gốc xương đang chọn
 * (giống vòng cung Angle Constraint của Moho / quạt Constrain Rotation của Adobe Animate).
 */
export function WorkshopBoneConstraintArc({
  bone,
  transforms
}: {
  bone: LayerBone | undefined
  transforms: Map<string, BoneTransform>
}) {
  if (!bone || !hasAngleLimit(bone) || bone.pin) return null
  const tf = transforms.get(bone.id)
  if (!tf) return null
  const parentRotation = bone.parentId ? (transforms.get(bone.parentId)?.rotation ?? 0) : 0
  const rest = bone.angle + parentRotation
  const r = Math.max(22, Math.min(70, bone.length * 0.6))
  const min = bone.minAngle as number
  const max = bone.maxAngle as number
  const edge = (a: number) => ({ x: tf.x + Math.cos(((rest + a) * Math.PI) / 180) * r, y: tf.y + Math.sin(((rest + a) * Math.PI) / 180) * r })
  const lo = edge(min)
  const hi = edge(max)
  return (
    <g className="lw-joint-limit-overlay" pointerEvents="none">
      <path d={describeArc(tf.x, tf.y, r, rest + min, rest + max)} className="lw-joint-limit-overlay-wedge" />
      <line x1={tf.x} y1={tf.y} x2={lo.x} y2={lo.y} className="lw-joint-limit-overlay-edge" />
      <line x1={tf.x} y1={tf.y} x2={hi.x} y2={hi.y} className="lw-joint-limit-overlay-edge" />
      <text x={hi.x} y={hi.y - 4} className="lw-joint-limit-overlay-label">
        {`${min}°…${max}°`}
      </text>
    </g>
  )
}
