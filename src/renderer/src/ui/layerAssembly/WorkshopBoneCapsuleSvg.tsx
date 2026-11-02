import type { PointerEvent } from 'react'
import type { LayerBone } from '@shared/layerRig'
import type { LayerComposite } from './types'
import type { BoneTransform } from '../../engine/layerRig'
import {
  classifyBoneSide,
  computeBoneInfluenceRadius
} from './mohoRigHelpers'
import { useBoneMeshEnvelopeRegions } from './workshopBoneMeshEnvelopeSvg'

export interface BoneCapsuleLayerProps {
  composite?: LayerComposite
  bones: LayerBone[]
  transforms: Map<string, BoneTransform>
  selectedBoneId: string | null
  interactive: boolean
  onStartStrengthDrag?: (e: PointerEvent, bone: LayerBone, headX: number, headY: number, angleDeg: number) => void
}

/**
 * Hiển thị Vùng ảnh hưởng xương (Moho Pro Bone Strength / Mesh Envelope):
 * - Khi xương bật `Bám sát Mesh` (`meshEnvelope: true`): sử dụng trực tiếp hình dạng lưới tam giác Mesh
 *   và đường viền theo đúng các nếp gấp quần áo, ống quần, đế giày của bộ phận đó (thay vì viên nang hình học).
 * - Khi xương tắt `Bám sát Mesh` (`meshEnvelope: false`): hiển thị viên nang hình học truyền thống.
 */
export function WorkshopBoneCapsuleSvg({
  composite,
  bones,
  transforms,
  selectedBoneId,
  interactive,
  onStartStrengthDrag
}: BoneCapsuleLayerProps) {
  const meshRegions = useBoneMeshEnvelopeRegions(composite, bones, transforms)

  return (
    <g className="lw-moho-capsules" pointerEvents={interactive ? 'auto' : 'none'}>
      {bones.map((bone) => {
        const tf = transforms.get(bone.id)
        if (!tf) return null
        const side = classifyBoneSide(bone)
        const isSelected = bone.id === selectedBoneId
        const geomRadius = computeBoneInfluenceRadius(bone)
        const angle = bone.angle + tf.rotation
        const reach = Math.max(0.5, Math.min(3.0, bone.influenceReach ?? 1.0))
        const len = bone.pin ? 0 : bone.length * reach
        const showHandles = Boolean(onStartStrengthDrag && (interactive || isSelected))
        const pctLabel = `${Math.round((bone.strength ?? 1) * 100)}%${bone.influenceReach && Math.abs(bone.influenceReach - 1) > 0.05 ? ` · L${Math.round(bone.influenceReach * 100)}%` : ''}`
        const envelopePrefix = bone.meshEnvelope ? '📐 Mesh · ' : 'Vỏ '
        const meshRegion = bone.meshEnvelope ? meshRegions.get(bone.id) : undefined
        const handleRadius = meshRegion ? meshRegion.meshRadius : geomRadius
        const capsuleW = len + geomRadius * 2
        const capsuleH = geomRadius * 2

        return (
          <g
            key={`cap-${bone.id}`}
            className={`lw-bone-capsule side-${side}${isSelected ? ' selected' : ''}${interactive ? ' interactive' : ''}${bone.meshEnvelope ? ' is-mesh-envelope' : ''}`}
          >
            {meshRegion ? (
              <>
                <path
                  d={meshRegion.trianglesPath}
                  className="lw-bone-mesh-envelope-tris"
                  pointerEvents={interactive ? 'auto' : 'none'}
                  onPointerDown={
                    interactive && onStartStrengthDrag
                      ? (e) => onStartStrengthDrag(e, bone, tf.x, tf.y, angle)
                      : undefined
                  }
                >
                  {interactive && (
                    <title>
                      {`[Bám sát Mesh] Vùng Mesh "${bone.name}" (${pctLabel}) — Tự động ôm theo nếp gấp Mesh của bộ phận`}
                    </title>
                  )}
                </path>
                <path
                  d={meshRegion.boundaryPath}
                  className="lw-bone-mesh-envelope-boundary"
                  pointerEvents="none"
                />
              </>
            ) : (
              <g transform={`translate(${tf.x}, ${tf.y}) rotate(${angle})`}>
                <rect
                  x={-geomRadius}
                  y={-geomRadius}
                  width={capsuleW}
                  height={capsuleH}
                  rx={geomRadius}
                  ry={geomRadius}
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
              </g>
            )}

            {showHandles && (
              <g transform={`translate(${tf.x}, ${tf.y}) rotate(${angle})`}>
                <circle
                  cx={len * 0.5}
                  cy={-handleRadius}
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
                  cy={handleRadius}
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
                    y={-handleRadius - 8}
                    textAnchor="middle"
                    className="lw-bone-capsule-badge"
                    pointerEvents="none"
                  >
                    {envelopePrefix}{pctLabel}
                  </text>
                )}
              </g>
            )}
          </g>
        )
      })}
    </g>
  )
}
