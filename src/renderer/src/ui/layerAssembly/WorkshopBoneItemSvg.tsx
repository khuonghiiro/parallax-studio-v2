import type { Dispatch, PointerEvent, SetStateAction } from 'react'
import type { BonePose, LayerBone } from '@shared/layerRig'
import type { BoneDragMode } from './workshopBoneDrag'
import { classifyBoneSide, isBoneTailCoincidentWithChild } from './mohoRigHelpers'

/** Khung xương đông xương (nhện, rết, bạch tuộc…) chỉ hiện tên khi rê / chọn để sân khấu không rối chữ. */
const LABEL_ALL_MAX_BONES = 18

export interface WorkshopBoneItemSvgProps {
  bone: LayerBone
  bones: LayerBone[]
  transforms: Map<string, BonePose>
  boneId: string | null
  activeDrag: string | null
  chainIds: string[]
  hoveredBoneId: string | null
  setHoveredBoneId: Dispatch<SetStateAction<string | null>>
  editing: boolean
  isManipulateTool: boolean
  hasMixamoLandmarks: boolean
  ikEnabled: boolean
  showLabels?: boolean
  onPointerDown: (e: PointerEvent, id: string, mode: BoneDragMode) => void
  tailMode: (e: PointerEvent) => BoneDragMode
  headMode: (e: PointerEvent, bone: LayerBone) => BoneDragMode
}

export function WorkshopBoneItemSvg({
  bone,
  bones,
  transforms,
  boneId,
  activeDrag,
  chainIds,
  hoveredBoneId,
  setHoveredBoneId,
  editing,
  isManipulateTool,
  hasMixamoLandmarks,
  ikEnabled,
  showLabels = true,
  onPointerDown,
  tailMode,
  headMode
}: WorkshopBoneItemSvgProps) {
  const tf = transforms.get(bone.id)
  if (!tf) return null
  const side = classifyBoneSide(bone)
  const isSelected = bone.id === boneId
  const isDragging = activeDrag === bone.id || chainIds.includes(bone.id)
  const isHovered = hoveredBoneId === bone.id
  const showLabel =
    showLabels &&
    ((editing && !hasMixamoLandmarks && bones.length <= LABEL_ALL_MAX_BONES) || isSelected || isDragging || isHovered)
  const angle = bone.angle + tf.rotation
  const rad = (angle * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  const nx = -uy
  const ny = ux

  const L = bone.length
  const hx = tf.x
  const hy = tf.y
  const tx = hx + ux * L
  const ty = hy + uy * L

  const waistFraction = 0.22
  const waistW = Math.max(2.2, Math.min(9.5, L * 0.08))
  const headBaseR = Math.max(3.2, Math.min(6.2, L * 0.065))
  const headR = isSelected ? headBaseR + 1.8 : editing && hasMixamoLandmarks && !isHovered ? 2.8 : headBaseR
  const tailBaseR = Math.max(2.2, Math.min(4.5, L * 0.045))
  const tailR = isSelected ? tailBaseR + 1.5 : editing && hasMixamoLandmarks && !isHovered ? 2.2 : tailBaseR
  const wx = hx + ux * (L * waistFraction)
  const wy = hy + uy * (L * waistFraction)
  const leftX = wx + nx * waistW
  const leftY = wy + ny * waistW
  const rightX = wx - nx * waistW
  const rightY = wy + ny * -waistW
  const bodyDragMode: BoneDragMode = editing && !isManipulateTool ? 'head' : 'rotate'

  return (
    <g
      className={`lw-blender-bone side-${side}${isSelected ? ' selected' : ''}${isDragging ? ' dragging' : ''}${bone.pin ? ' is-pin' : ''}`}
      onPointerEnter={() => setHoveredBoneId(bone.id)}
      onPointerLeave={() => setHoveredBoneId((prev) => (prev === bone.id ? null : prev))}
    >
      {bone.pin ? (
        <>
          <circle
            cx={hx}
            cy={hy}
            r={18}
            fill="transparent"
            style={{ cursor: editing && !isManipulateTool ? 'move' : !bone.parentId ? 'move' : 'grab', pointerEvents: 'all' }}
            onPointerDown={(e) => onPointerDown(e, bone.id, headMode(e, bone))}
          />
          <circle
            cx={hx}
            cy={hy}
            r={isSelected ? 7.5 : 6}
            className="lw-pin-bone-ring"
            onPointerDown={(e) => onPointerDown(e, bone.id, headMode(e, bone))}
          />
          <line x1={hx - 6} y1={hy} x2={hx + 6} y2={hy} className="lw-bone-ridge" pointerEvents="none" />
          <line x1={hx} y1={hy - 6} x2={hx} y2={hy + 6} className="lw-bone-ridge" pointerEvents="none" />
          <circle cx={hx} cy={hy} r={3} className="lw-bone-head-joint" pointerEvents="none" />
        </>
      ) : (
        <>
          <line
            x1={hx}
            y1={hy}
            x2={tx}
            y2={ty}
            stroke="transparent"
            strokeWidth={Math.max(28, waistW * 2 + 14)}
            strokeLinecap="round"
            style={{ cursor: editing && !isManipulateTool ? 'move' : 'grab', pointerEvents: 'stroke' }}
            onPointerDown={(e) => onPointerDown(e, bone.id, bodyDragMode)}
          />
          <polygon
            points={`${hx},${hy} ${leftX},${leftY} ${tx},${ty}`}
            className="lw-bone-facet lw-bone-facet-top"
            onPointerDown={(e) => onPointerDown(e, bone.id, bodyDragMode)}
          >
            <title>
              {editing && !isManipulateTool
                ? `${bone.name} (Chế độ tạo xương)`
                : `${bone.name} · Chuột trái: xoay khớp · Shift+Chuột trái: ghi Realtime`}
            </title>
          </polygon>
          <polygon
            points={`${hx},${hy} ${rightX},${rightY} ${tx},${ty}`}
            className="lw-bone-facet lw-bone-facet-bottom"
            onPointerDown={(e) => onPointerDown(e, bone.id, bodyDragMode)}
          />
          <line x1={hx} y1={hy} x2={tx} y2={ty} className="lw-bone-ridge" pointerEvents="none" />

          <circle
            cx={tx}
            cy={ty}
            r={16}
            fill="transparent"
            style={{ cursor: 'crosshair', pointerEvents: 'all' }}
            onPointerDown={(e) => onPointerDown(e, bone.id, tailMode(e))}
          />
          {(isSelected || isHovered || !isBoneTailCoincidentWithChild(bone, bones, transforms, 3)) && (
            <circle
              cx={tx}
              cy={ty}
              r={tailR}
              className={`lw-bone-tail-joint${(!editing || isManipulateTool) && ikEnabled ? ' ik' : ''}`}
              style={editing && hasMixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : undefined}
              onPointerDown={(e) => onPointerDown(e, bone.id, tailMode(e))}
            />
          )}

          <circle
            cx={hx}
            cy={hy}
            r={18}
            fill="transparent"
            style={{ cursor: editing && !isManipulateTool ? 'move' : !bone.parentId ? 'move' : 'grab', pointerEvents: 'all' }}
            onPointerDown={(e) => onPointerDown(e, bone.id, headMode(e, bone))}
          />
          <circle
            cx={hx}
            cy={hy}
            r={headR}
            className="lw-bone-head-joint"
            style={editing && hasMixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : undefined}
            onPointerDown={(e) => onPointerDown(e, bone.id, headMode(e, bone))}
          />
        </>
      )}

      {showLabel && (
        <text x={wx + nx * (waistW + 8)} y={wy + ny * (waistW + 8)} className="lw-bone-name" pointerEvents="none">
          {bone.name}
          {!editing && Math.abs(tf.zOrder ?? 0) >= 1
            ? ` · Z${(tf.zOrder ?? 0) > 0 ? '+' : ''}${Math.round(tf.zOrder ?? 0)}`
            : ''}
        </text>
      )}
    </g>
  )
}
