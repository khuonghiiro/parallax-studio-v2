import { useState, type CSSProperties, type Dispatch, type PointerEvent, type SetStateAction } from 'react'
import type { BonePose, LayerBone } from '@shared/layerRig'
import type { BoneDragMode } from './workshopBoneDrag'
import { classifyBoneSide, isBoneTailCoincidentWithChild } from './mohoRigHelpers'

/** Khung xương đông xương (nhện, rết, bạch tuộc…) chỉ hiện tên khi rê / chọn để sân khấu không rối chữ. */
const LABEL_ALL_MAX_BONES = 18

const FALLBACK_BONE_PALETTE = [
  '#10b981',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#6366f1',
  '#f59e0b',
  '#14b8a6',
  '#a855f7',
  '#f43f5e',
  '#38bdf8'
]

export function getBoneDistinctColor(bone: LayerBone, bones: LayerBone[]): string {
  if (bone.color) return bone.color
  const lower = bone.name.toLowerCase()
  const isLeft = lower.includes('trái') || lower.includes('left') || bone.x < -8
  const isRight = lower.includes('phải') || lower.includes('right') || bone.x > 8

  if (lower.includes('đầu') || lower.includes('cổ') || lower.includes('head') || lower.includes('neck')) {
    return '#f59e0b'
  }
  if (lower.includes('thân') || lower.includes('ngực') || lower.includes('bụng') || lower.includes('hông') || lower.includes('gốc')) {
    return '#10b981'
  }
  if (lower.includes('tay') || lower.includes('vai') || lower.includes('arm') || lower.includes('hand')) {
    if (isLeft) {
      if (lower.includes('bàn')) return '#38bdf8'
      if (lower.includes('cẳng')) return '#22d3ee'
      return '#06b6d4'
    }
    if (isRight) {
      if (lower.includes('bàn')) return '#fbbf24'
      if (lower.includes('cẳng')) return '#fb923c'
      return '#f97316'
    }
  }
  if (lower.includes('đùi') || lower.includes('chân') || lower.includes('gối') || lower.includes('leg') || lower.includes('foot')) {
    if (isLeft) {
      if (lower.includes('bàn')) return '#a855f7'
      if (lower.includes('cẳng')) return '#818cf8'
      return '#6366f1'
    }
    if (isRight) {
      if (lower.includes('bàn')) return '#fb7185'
      if (lower.includes('cẳng')) return '#f43f5e'
      return '#ec4899'
    }
  }
  const idx = Math.max(0, bones.findIndex((b) => b.id === bone.id))
  return FALLBACK_BONE_PALETTE[idx % FALLBACK_BONE_PALETTE.length]
}

type BoneHoverZone = 'head' | 'body' | 'tail' | 'scale' | null

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
  const [hoverZone, setHoverZone] = useState<BoneHoverZone>(null)
  const tf = transforms.get(bone.id)
  if (!tf) return null
  const side = classifyBoneSide(bone)
  const boneColor = getBoneDistinctColor(bone, bones)
  const isSelected = bone.id === boneId
  const isDragging = activeDrag === bone.id || chainIds.includes(bone.id)
  const isHovered = hoveredBoneId === bone.id || hoverZone !== null
  const showLabel =
    showLabels &&
    ((editing && !hasMixamoLandmarks && bones.length <= LABEL_ALL_MAX_BONES) || isSelected || isDragging || isHovered)
  const angle = bone.angle + tf.rotation
  const rad = (angle * Math.PI) / 180
  const ux = Math.cos(rad)
  const uy = Math.sin(rad)
  const nx = -uy
  const ny = ux

  const sxFactor = tf.scaleX ?? 1
  const syFactor = tf.scaleY ?? 1
  const boneScale = Math.hypot(ux * sxFactor, uy * syFactor)
  const L = Math.max(4, bone.length * boneScale)
  const hx = tf.x
  const hy = tf.y
  const tx = hx + ux * L
  const ty = hy + uy * L
  const waistFraction = 0.22
  const waistW = Math.max(2.2, Math.min(9.5, L * 0.08))
  const hasChildJoint = isBoneTailCoincidentWithChild(bone, bones, transforms, 8)
  const normalSign = side === 'left' ? -1 : 1
  const scaleOffsetDist = hasChildJoint ? Math.max(22, waistW + 16) : 16
  const scaleHandleX = hasChildJoint ? tx + nx * scaleOffsetDist * normalSign : tx + ux * 16
  const scaleHandleY = hasChildJoint ? ty + ny * scaleOffsetDist * normalSign : ty + uy * 16

  const bodyCursor = isDragging ? 'grabbing' : editing && !isManipulateTool ? 'move' : 'grab'
  const tailCursor = isDragging ? 'grabbing' : editing && !isManipulateTool ? 'crosshair' : 'grab'

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
  const bodyDragMode = (e: PointerEvent): BoneDragMode => (editing && !isManipulateTool ? 'head' : tailMode(e))

  const enterZone = (zone: BoneHoverZone) => {
    setHoverZone(zone)
    setHoveredBoneId(bone.id)
  }
  const leaveZone = () => {
    setHoverZone(null)
    setHoveredBoneId((prev) => (prev === bone.id ? null : prev))
  }

  return (
    <g
      className={`lw-blender-bone side-${side}${isSelected ? ' selected' : ''}${isHovered ? ' is-hovered' : ''}${isDragging ? ' dragging' : ''}${bone.pin ? ' is-pin' : ''}`}
      data-bone-id={bone.id}
      data-bone-name={bone.name}
      style={{ '--bone-color': boneColor } as CSSProperties}
      onPointerEnter={() => setHoveredBoneId(bone.id)}
      onPointerLeave={leaveZone}
    >
      {bone.pin ? (
        <>
          <circle
            cx={hx}
            cy={hy}
            r={18}
            fill="transparent"
            style={{ cursor: isDragging ? 'grabbing' : 'move', pointerEvents: 'all' }}
            onPointerEnter={() => enterZone('head')}
            onPointerDown={(e) => onPointerDown(e, bone.id, headMode(e, bone))}
          />
          <circle
            cx={hx}
            cy={hy}
            r={isSelected ? 7.5 : 6}
            className="lw-pin-bone-ring"
            style={{ cursor: isDragging ? 'grabbing' : 'move' }}
            onPointerEnter={() => enterZone('head')}
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
            style={{ cursor: bodyCursor, pointerEvents: 'stroke' }}
            onPointerEnter={() => enterZone('body')}
            onPointerDown={(e) => onPointerDown(e, bone.id, bodyDragMode(e))}
          />
          <polygon
            points={`${hx},${hy} ${leftX},${leftY} ${tx},${ty}`}
            className="lw-bone-facet lw-bone-facet-top"
            style={{ cursor: bodyCursor }}
            onPointerEnter={() => enterZone('body')}
            onPointerDown={(e) => onPointerDown(e, bone.id, bodyDragMode(e))}
          />
          <polygon
            points={`${hx},${hy} ${rightX},${rightY} ${tx},${ty}`}
            className="lw-bone-facet lw-bone-facet-bottom"
            style={{ cursor: bodyCursor }}
            onPointerEnter={() => enterZone('body')}
            onPointerDown={(e) => onPointerDown(e, bone.id, bodyDragMode(e))}
          />
          <line x1={hx} y1={hy} x2={tx} y2={ty} className="lw-bone-ridge" pointerEvents="none" />

          <circle
            cx={tx}
            cy={ty}
            r={20}
            fill="transparent"
            style={{ cursor: tailCursor, pointerEvents: 'all' }}
            onPointerEnter={() => enterZone('tail')}
            onPointerDown={(e) => onPointerDown(e, bone.id, tailMode(e))}
          />
          {isSelected && editing && !isManipulateTool && (
            <circle
              cx={tx}
              cy={ty}
              r={tailR + 5}
              fill="none"
              stroke="var(--accent-cyan, #38bdf8)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
              opacity={0.85}
              pointerEvents="none"
            />
          )}
          {(isSelected || isHovered || !isBoneTailCoincidentWithChild(bone, bones, transforms, 3)) && (
            <circle
              cx={tx}
              cy={ty}
              r={isSelected ? tailR + 1.2 : tailR}
              className={`lw-bone-tail-joint${(!editing || isManipulateTool) && ikEnabled ? ' ik' : ''}`}
              style={{
                cursor: tailCursor,
                ...(editing && hasMixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : {})
              }}
              onPointerEnter={() => enterZone('tail')}
              onPointerDown={(e) => onPointerDown(e, bone.id, tailMode(e))}
            />
          )}

          {/* Tay nắm ⤢ Scale phóng to / thu nhỏ bộ phận & xương theo bước hoạt ảnh (chỉ hiện khi chọn xương) */}
          {isSelected && (
            <g
              style={{
                cursor: 'nwse-resize',
                pointerEvents: 'all',
                filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.75))'
              }}
              onPointerEnter={() => enterZone('scale')}
              onPointerDown={(e) => onPointerDown(e, bone.id, 'scale')}
            >
              {/* Dây gióng nét đứt 2 lớp tương phản cao chống chìm trên mọi màu nền */}
              <line
                x1={tx}
                y1={ty}
                x2={scaleHandleX}
                y2={scaleHandleY}
                stroke="#0f172a"
                strokeWidth={2.8}
                strokeLinecap="round"
                pointerEvents="none"
              />
              <line
                x1={tx}
                y1={ty}
                x2={scaleHandleX}
                y2={scaleHandleY}
                stroke="#facc15"
                strokeWidth={1.8}
                strokeDasharray="2.5 2"
                strokeLinecap="round"
                pointerEvents="none"
              />
              {/* Vùng bấm cảm ứng rộng rãi */}
              <circle cx={scaleHandleX} cy={scaleHandleY} r={14} fill="transparent" />

              {/* Hình thoi Scale Vàng rực rỡ với viền tương phản cao chống chìm trên mọi nền */}
              <rect
                x={scaleHandleX - 5.5}
                y={scaleHandleY - 5.5}
                width={11}
                height={11}
                rx={2.2}
                transform={`rotate(45 ${scaleHandleX} ${scaleHandleY})`}
                fill={hoverZone === 'scale' ? '#fef08a' : '#facc15'}
                stroke="#0f172a"
                strokeWidth={1.8}
              />
              {/* Tâm điểm ngắm ở giữa hình thoi */}
              <circle
                cx={scaleHandleX}
                cy={scaleHandleY}
                r={1.8}
                fill="#0f172a"
                pointerEvents="none"
              />
            </g>
          )}

          <circle
            cx={hx}
            cy={hy}
            r={18}
            fill="transparent"
            style={{ cursor: isDragging ? 'grabbing' : 'move', pointerEvents: 'all' }}
            onPointerEnter={() => enterZone('head')}
            onPointerDown={(e) => onPointerDown(e, bone.id, headMode(e, bone))}
          />
          <circle
            cx={hx}
            cy={hy}
            r={headR}
            className="lw-bone-head-joint"
            style={{
              cursor: isDragging ? 'grabbing' : 'move',
              ...(editing && hasMixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : {})
            }}
            onPointerEnter={() => enterZone('head')}
            onPointerDown={(e) => onPointerDown(e, bone.id, headMode(e, bone))}
          />
        </>
      )}

      {showLabel && (
        <text
          x={wx + nx * (waistW + 8)}
          y={wy + ny * (waistW + 8)}
          className="lw-bone-name"
          style={isHovered ? { fill: boneColor, fontWeight: 700 } : undefined}
          pointerEvents="none"
        >
          {bone.name}
          {Math.abs(boneScale - 1) >= 0.02 ? ` · ${Math.round(boneScale * 100)}%` : ''}
          {!editing && Math.abs(tf.zOrder ?? 0) >= 1
            ? ` · Z${(tf.zOrder ?? 0) > 0 ? '+' : ''}${Math.round(tf.zOrder ?? 0)}`
            : ''}
        </text>
      )}
    </g>
  )
}
