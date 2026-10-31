import type { PointerEvent } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { BoneTransform } from '../../engine/layerRig'
import {
  classifyBoneSide,
  computeBoneInfluenceRadius
} from './mohoRigHelpers'

export interface BoneCapsuleLayerProps {
  bones: LayerBone[]
  transforms: Map<string, BoneTransform>
  selectedBoneId: string | null
  interactive: boolean
  onStartStrengthDrag?: (e: PointerEvent, bone: LayerBone, headX: number, headY: number, angleDeg: number) => void
}

/**
 * Hiển thị viên nang Vùng ảnh hưởng xương (Moho Pro Bone Strength / Influence Envelope Capsule).
 * Khi ở công cụ `strength` (Phím T), cho phép kéo trực tiếp viền viên nang để tăng/giảm bán kính uốn Mesh.
 */
export function WorkshopBoneCapsuleSvg({
  bones,
  transforms,
  selectedBoneId,
  interactive,
  onStartStrengthDrag
}: BoneCapsuleLayerProps) {
  return (
    <g className="lw-moho-capsules" pointerEvents={interactive ? 'auto' : 'none'}>
      {bones.map((bone) => {
        const tf = transforms.get(bone.id)
        if (!tf) return null
        const side = classifyBoneSide(bone)
        const isSelected = bone.id === selectedBoneId
        const radius = computeBoneInfluenceRadius(bone)
        const angle = bone.angle + tf.rotation
        const len = bone.pin ? 0 : bone.length
        const capsuleW = len + radius * 2
        const capsuleH = radius * 2

        return (
          <g
            key={`cap-${bone.id}`}
            transform={`translate(${tf.x}, ${tf.y}) rotate(${angle})`}
            className={`lw-bone-capsule side-${side}${isSelected ? ' selected' : ''}${interactive ? ' interactive' : ''}`}
          >
            <rect
              x={-radius}
              y={-radius}
              width={capsuleW}
              height={capsuleH}
              rx={radius}
              ry={radius}
              onPointerDown={
                interactive && onStartStrengthDrag
                  ? (e) => onStartStrengthDrag(e, bone, tf.x, tf.y, angle)
                  : undefined
              }
            >
              {interactive && (
                <title>
                  {`Vùng ảnh hưởng "${bone.name}" (${((bone.strength ?? 1) * 100).toFixed(0)}%) — Kéo ra/vào để chỉnh bán kính uốn Mesh`}
                </title>
              )}
            </rect>
            {interactive && (
              <>
                <circle
                  cx={len * 0.5}
                  cy={-radius}
                  r={isSelected ? 5 : 4}
                  className="lw-bone-capsule-handle"
                  onPointerDown={
                    onStartStrengthDrag
                      ? (e) => onStartStrengthDrag(e, bone, tf.x, tf.y, angle)
                      : undefined
                  }
                />
                <circle
                  cx={len * 0.5}
                  cy={radius}
                  r={isSelected ? 5 : 4}
                  className="lw-bone-capsule-handle"
                  onPointerDown={
                    onStartStrengthDrag
                      ? (e) => onStartStrengthDrag(e, bone, tf.x, tf.y, angle)
                      : undefined
                  }
                />
              </>
            )}
          </g>
        )
      })}
    </g>
  )
}
