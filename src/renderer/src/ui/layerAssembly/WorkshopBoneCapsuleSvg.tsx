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
 * - Ở công cụ `strength` (Phím T): toàn bộ viên nang và tay nắm đều kéo được để chỉnh bán kính uốn Mesh.
 * - Ở các công cụ khác khi bật `Vỏ vùng uốn`: xương đang chọn luôn hiện 2 tay nắm viền viên nang + nhãn `%` để kéo chỉnh nhanh ngay lập tức.
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
        const showHandles = Boolean(onStartStrengthDrag && (interactive || isSelected))
        const pctLabel = `${Math.round((bone.strength ?? 1) * 100)}%`

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
              pointerEvents={interactive ? 'auto' : 'none'}
              onPointerDown={
                interactive && onStartStrengthDrag
                  ? (e) => onStartStrengthDrag(e, bone, tf.x, tf.y, angle)
                  : undefined
              }
            >
              {interactive && (
                <title>
                  {`Vùng ảnh hưởng "${bone.name}" (${pctLabel}) — Kéo ra/vào để chỉnh bán kính uốn Mesh`}
                </title>
              )}
            </rect>
            {showHandles && (
              <>
                <circle
                  cx={len * 0.5}
                  cy={-radius}
                  r={isSelected ? 5.5 : 4.5}
                  className="lw-bone-capsule-handle"
                  style={{ pointerEvents: 'all' }}
                  onPointerDown={
                    onStartStrengthDrag
                      ? (e) => onStartStrengthDrag(e, bone, tf.x, tf.y, angle)
                      : undefined
                  }
                >
                  <title>{`Kéo tay nắm để chỉnh Vùng uốn "${bone.name}" (${pctLabel})`}</title>
                </circle>
                <circle
                  cx={len * 0.5}
                  cy={radius}
                  r={isSelected ? 5.5 : 4.5}
                  className="lw-bone-capsule-handle"
                  style={{ pointerEvents: 'all' }}
                  onPointerDown={
                    onStartStrengthDrag
                      ? (e) => onStartStrengthDrag(e, bone, tf.x, tf.y, angle)
                      : undefined
                  }
                >
                  <title>{`Kéo tay nắm để chỉnh Vùng uốn "${bone.name}" (${pctLabel})`}</title>
                </circle>
                {isSelected && (
                  <text
                    x={len * 0.5}
                    y={-radius - 8}
                    textAnchor="middle"
                    className="lw-bone-capsule-badge"
                    pointerEvents="none"
                  >
                    Vỏ {pctLabel}
                  </text>
                )}
              </>
            )}
          </g>
        )
      })}
    </g>
  )
}
