import { useRef, useState, type PointerEvent } from 'react'
import { evaluateRig, rotatePoint } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { startBoneDrag, boneDragAction, type BoneDragMode } from './workshopBoneDrag'
import { applyRigAction } from './workshopRig'
import { useAnimAssist } from './animAssistStore'

export interface BoneOverlayProps {
  composite: LayerComposite
  boneId: string | null
  selectBone: (id: string | null) => void
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
  time: number
  editing: boolean
  stopPlayback?: () => void
  cancelGesture?: () => void
  beginGesture?: () => void
  endGesture?: () => void
}

export function WorkshopBoneOverlay({ composite, boneId, selectBone, setComposite, time, editing, stopPlayback, cancelGesture, beginGesture, endGesture }: BoneOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<ReturnType<typeof startBoneDrag> | null>(null)
  const [activeDrag, setActiveDrag] = useState<string | null>(null)
  const [dragAngle, setDragAngle] = useState<{ x: number; y: number; text: string } | null>(null)
  const [chainIds, setChainIds] = useState<string[]>([])
  const assist = useAnimAssist()

  const rig = composite.rig
  if (!rig || !rig.bones.length) return null

  const transforms = evaluateRig({ ...rig, loop: false }, time, editing)

  const toLocalPoint = (event: PointerEvent) => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return null
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  }

  /** Kéo ngọn ở tab Animation: IK (chuỗi xương cha xoay theo) khi bật IK; giữ Ctrl để đảo IK/FK tạm thời. */
  const tailMode = (e: PointerEvent): BoneDragMode => {
    if (editing) return 'tail'
    const useIk = e.ctrlKey || e.metaKey ? !assist.ik : assist.ik
    return useIk ? 'ik' : 'rotate'
  }

  const handlePointerDown = (e: PointerEvent, id: string, mode: BoneDragMode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const point = toLocalPoint(e)
    if (!point) return
    stopPlayback?.()
    selectBone(id)
    beginGesture?.()
    dragRef.current = startBoneDrag(rig, id, time, editing, mode, point, assist.ikChain)
    setActiveDrag(id)
    setChainIds(dragRef.current.ik?.chain.boneIds ?? [])
    svgRef.current?.setPointerCapture(e.pointerId)
    svgRef.current?.focus()
  }

  const handlePointerMove = (e: PointerEvent) => {
    const drag = dragRef.current
    const point = toLocalPoint(e)
    if (!drag || !point) return
    const action = boneDragAction(drag, point, e.shiftKey)
    setComposite((c) => applyRigAction(c, action))
    const text = action.action === 'batch'
      ? `IK · ${action.operations.length} xương`
      : action.action === 'set-key'
        ? action.key.rotation !== undefined ? `${action.key.rotation.toFixed(1)}°` : `${action.key.x?.toFixed(0)}, ${action.key.y?.toFixed(0)}`
        : action.action === 'update-bone' ? `${action.patch.angle?.toFixed(0) ?? ''}°` : ''
    setDragAngle({ ...point, text })
  }

  const endDrag = () => {
    if (dragRef.current) {
      endGesture?.()
    }
    dragRef.current = null
    setActiveDrag(null)
    setChainIds([])
    setDragAngle(null)
  }

  return (
    <svg
      ref={svgRef}
      className="lw-bone-overlay"
      viewBox={`${-composite.width / 2} ${-composite.height / 2} ${composite.width} ${composite.height}`}
      tabIndex={0}
      aria-label="Khung xương Blender trên màn hình 2D"
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => { cancelGesture?.(); endDrag() }}
      onLostPointerCapture={() => { if (dragRef.current) { cancelGesture?.(); endDrag() } }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && dragRef.current) {
          e.stopPropagation()
          cancelGesture?.()
          endDrag()
        }
      }}
    >
      <defs>
        <radialGradient id="lw-bone-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Relationship lines connecting child bone head to parent bone tail */}
      {rig.bones.map((bone) => {
        if (!bone.parentId) return null
        const parent = rig.bones.find((b) => b.id === bone.parentId)
        if (!parent) return null
        const parentTf = transforms.get(parent.id)
        const childTf = transforms.get(bone.id)
        if (!parentTf || !childTf) return null
        const parentTail = rotatePoint(parent.length, 0, parent.angle + parentTf.rotation)
        const ptx = parentTf.x + parentTail.x
        const pty = parentTf.y + parentTail.y
        // Only draw dashed relationship line if head is detached from parent tail
        if (Math.hypot(ptx - childTf.x, pty - childTf.y) > 4) {
          return (
            <line
              key={`rel-${bone.id}`}
              x1={ptx}
              y1={pty}
              x2={childTf.x}
              y2={childTf.y}
              className="lw-bone-relationship"
            />
          )
        }
        return null
      })}

      {/* Blender-style Octahedral Bones */}
      {rig.bones.map((bone) => {
        const tf = transforms.get(bone.id)
        if (!tf) return null
        const isSelected = bone.id === boneId
        const isDragging = activeDrag === bone.id || chainIds.includes(bone.id)
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

        // Octahedral waist point (around 20% down bone length)
        const waistFraction = 0.22
        const waistW = Math.max(6, Math.min(20, L * 0.16))
        const wx = hx + ux * (L * waistFraction)
        const wy = hy + uy * (L * waistFraction)
        const leftX = wx + nx * waistW
        const leftY = wy + ny * waistW
        const rightX = wx - nx * waistW
        const rightY = wy - ny * waistW

        return (
          <g
            key={bone.id}
            className={`lw-blender-bone ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
          >
            {/* Invisible forgiving hitbox line along the bone body for easy grabbing */}
            <line
              x1={hx}
              y1={hy}
              x2={tx}
              y2={ty}
              stroke="transparent"
              strokeWidth={Math.max(28, waistW * 2 + 14)}
              strokeLinecap="round"
              style={{ cursor: editing ? 'move' : 'grab', pointerEvents: 'stroke' }}
              onPointerDown={(e) => handlePointerDown(e, bone.id, editing ? 'head' : 'rotate')}
            />

            {/* Shaded Top Half of Octahedral Bone */}
            <polygon
              points={`${hx},${hy} ${leftX},${leftY} ${tx},${ty}`}
              className="lw-bone-facet lw-bone-facet-top"
              onPointerDown={(e) => handlePointerDown(e, bone.id, editing ? 'head' : 'rotate')}
            >
              <title>{`${bone.name} (${editing ? 'Chế độ tạo xương' : 'Chế độ Animation'})`}</title>
            </polygon>

            {/* Shaded Bottom Half of Octahedral Bone */}
            <polygon
              points={`${hx},${hy} ${rightX},${rightY} ${tx},${ty}`}
              className="lw-bone-facet lw-bone-facet-bottom"
              onPointerDown={(e) => handlePointerDown(e, bone.id, editing ? 'head' : 'rotate')}
            />

            {/* Central 3D Ridge Line */}
            <line x1={hx} y1={hy} x2={tx} y2={ty} className="lw-bone-ridge" />

            {/* Invisible forgiving hitbox for Tail Joint (Tip) */}
            <circle
              cx={tx}
              cy={ty}
              r={16}
              fill="transparent"
              style={{ cursor: 'crosshair', pointerEvents: 'all' }}
              onPointerDown={(e) => handlePointerDown(e, bone.id, tailMode(e))}
            />

            {/* Tail Joint (Tip) */}
            <circle
              cx={tx}
              cy={ty}
              r={isSelected ? 6.5 : 5}
              className={`lw-bone-tail-joint${!editing && assist.ik ? ' ik' : ''}`}
              onPointerDown={(e) => handlePointerDown(e, bone.id, tailMode(e))}
            >
              <title>{editing ? 'Kéo để đổi hướng và chiều dài xương' : assist.ik ? `IK: kéo ngọn, ${assist.ikChain} xương trong chuỗi xoay theo (Ctrl = chỉ xoay xương này)` : 'Kéo để xoay xương (Ctrl = IK)'}</title>
            </circle>

            {/* Invisible forgiving hitbox for Head Joint (Pivot) */}
            <circle
              cx={hx}
              cy={hy}
              r={18}
              fill="transparent"
              style={{ cursor: 'move', pointerEvents: 'all' }}
              onPointerDown={(e) => handlePointerDown(e, bone.id, 'head')}
            />

            {/* Head Joint (Pivot) */}
            <circle
              cx={hx}
              cy={hy}
              r={isSelected ? 8.5 : 7}
              className="lw-bone-head-joint"
              onPointerDown={(e) => handlePointerDown(e, bone.id, 'head')}
            >
              <title>Khớp gốc (Pivot): Kéo để dời vị trí</title>
            </circle>

            {/* Bone Label */}
            <text x={wx + nx * (waistW + 8)} y={wy + ny * (waistW + 8)} className="lw-bone-name">
              {bone.name}
            </text>
          </g>
        )
      })}

      {/* Live Dragging Tooltip HUD Badge */}
      {dragAngle && (() => {
        const badgeW = Math.max(76, dragAngle.text.length * 8 + 18)
        return (
          <g transform={`translate(${dragAngle.x + 14}, ${dragAngle.y - 12})`} pointerEvents="none">
            <rect
              x={-6}
              y={-14}
              width={badgeW}
              height={20}
              rx={5}
              fill="var(--bg-1)"
              stroke="var(--accent-cyan)"
              strokeWidth={1.2}
            />
            <text
              x={(badgeW - 12) / 2}
              y={0}
              textAnchor="middle"
              fill="var(--text)"
              fontSize={11}
              fontWeight={600}
              fontFamily="system-ui, sans-serif"
            >
              {dragAngle.text}
            </text>
          </g>
        )
      })()}
    </svg>
  )
}
