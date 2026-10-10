import { useRef, useState, type PointerEvent } from 'react'
import { evaluateRig, rotatePoint, sampleBonePose } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { applyRigAction } from './workshopRig'

export interface BoneOverlayProps {
  composite: LayerComposite
  boneId: string | null
  selectBone: (id: string | null) => void
  setComposite: (update: (prev: LayerComposite) => LayerComposite) => void
  time: number
  editing: boolean
}

type DragMode = 'head' | 'tail' | 'rotate'

interface DragState {
  boneId: string
  mode: DragMode
  startX: number
  startY: number
  startAngle: number
  startLength: number
  startRotation: number
  headX: number
  headY: number
  startMouseAngle: number
}

export function WorkshopBoneOverlay({ composite, boneId, selectBone, setComposite, time, editing }: BoneOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [activeDrag, setActiveDrag] = useState<string | null>(null)

  const rig = composite.rig
  if (!rig || !rig.bones.length) return null

  const transforms = evaluateRig(rig, time, editing)

  const toLocalPoint = (event: PointerEvent) => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return null
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  }

  const handlePointerDown = (e: PointerEvent, id: string, mode: DragMode) => {
    e.stopPropagation()
    selectBone(id)
    const bone = rig.bones.find((b) => b.id === id)
    if (!bone) return
    const p = toLocalPoint(e)
    if (!p) return

    const transform = transforms.get(id) ?? { x: bone.x, y: bone.y, rotation: 0, tx: 0, ty: 0 }
    const headX = transform.x
    const headY = transform.y
    const startMouseAngle = Math.atan2(p.y - headY, p.x - headX) * 180 / Math.PI
    const currentPose = sampleBonePose(rig, id, time)

    dragRef.current = {
      boneId: id,
      mode,
      startX: bone.x,
      startY: bone.y,
      startAngle: bone.angle,
      startLength: bone.length,
      startRotation: currentPose.rotation,
      headX,
      headY,
      startMouseAngle
    }
    setActiveDrag(id)
    e.currentTarget.setPointerCapture(e.pointerId)
    svgRef.current?.focus()
  }

  const handlePointerMove = (e: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const p = toLocalPoint(e)
    if (!p) return

    if (drag.mode === 'head') {
      // Move bone base position
      const dx = p.x - drag.headX
      const dy = p.y - drag.headY
      setComposite((c) =>
        applyRigAction(c, {
          action: 'update-bone',
          boneId: drag.boneId,
          patch: { x: Math.round(drag.startX + dx), y: Math.round(drag.startY + dy) }
        })
      )
    } else if (drag.mode === 'tail') {
      // In edit mode: change bone length and orientation angle
      const dx = p.x - drag.headX
      const dy = p.y - drag.headY
      const length = Math.max(15, Math.round(Math.hypot(dx, dy)))
      const angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
      setComposite((c) =>
        applyRigAction(c, {
          action: 'update-bone',
          boneId: drag.boneId,
          patch: { length, angle }
        })
      )
    } else if (drag.mode === 'rotate') {
      // In pose/animation mode: rotate bone around head pivot
      const currentMouseAngle = Math.atan2(p.y - drag.headY, p.x - drag.headX) * 180 / Math.PI
      const deltaAngle = currentMouseAngle - drag.startMouseAngle
      const newRotation = Math.round(drag.startRotation + deltaAngle)
      setComposite((c) =>
        applyRigAction(c, {
          action: 'set-key',
          boneId: drag.boneId,
          key: { time, x: 0, y: 0, rotation: newRotation, easing: 'smooth' }
        })
      )
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setActiveDrag(null)
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
      onPointerCancel={endDrag}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && dragRef.current) {
          e.stopPropagation()
          endDrag()
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && boneId) {
          e.stopPropagation()
          setComposite((c) => applyRigAction(c, { action: 'delete-bone', boneId }))
          selectBone(null)
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
        const isDragging = activeDrag === bone.id
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

            {/* Tail Joint (Tip) */}
            <circle
              cx={tx}
              cy={ty}
              r={isSelected ? 6 : 4.5}
              className="lw-bone-tail-joint"
              onPointerDown={(e) => handlePointerDown(e, bone.id, editing ? 'tail' : 'rotate')}
            >
              <title>{editing ? 'Kéo để đổi hướng và chiều dài xương' : 'Kéo để xoay xương'}</title>
            </circle>

            {/* Head Joint (Pivot) */}
            <circle
              cx={hx}
              cy={hy}
              r={isSelected ? 8 : 6.5}
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
    </svg>
  )
}
