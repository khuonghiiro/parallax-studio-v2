import { useRef, useState, type PointerEvent } from 'react'
import { evaluateRig, rotatePoint } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { startBoneDrag, boneDragAction, type BoneDragMode } from './workshopBoneDrag'
import { applyRigAction } from './workshopRig'
import { useAnimAssist } from './animAssistStore'
import {
  SKETCH_MAX_DURATION,
  applyMotionSketch,
  createSketchAnchor,
  sketchPreviewOps,
  sketchValuesAt,
  type MotionSketchMode,
  type Point2D,
  type SketchAnchor,
  type SketchSample,
  type SketchSolveState
} from './workshopMotionSketch'
import { setMotionSketchState } from './motionSketchStore'
import { markBoneAdjusted, setStepRecordState } from './workshopStepRecord'
import {
  buildHumanoidBonesFromLandmarks,
  extractLandmarksFromBones,
  moveLandmarkPoint,
  type MixamoLandmarkId,
  type MixamoLandmarks
} from './workshopMixamoAutoRig'
import { MixamoViewportRingsOverlay } from './MixamoReferenceGuide'

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
  seek?: (time: number) => void
  playFrom?: (time: number) => void
}

interface LiveBoneRecordDrag {
  anchor: SketchAnchor
  mode: MotionSketchMode
  chain: number
  startTime: number
  t0: number
  samples: SketchSample[]
  solve: SketchSolveState
}

const toPath = (pts: Point2D[]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

export function WorkshopBoneOverlay({
  composite,
  boneId,
  selectBone,
  setComposite,
  time,
  editing,
  stopPlayback,
  cancelGesture,
  beginGesture,
  endGesture,
  seek
}: BoneOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<ReturnType<typeof startBoneDrag> | null>(null)
  const liveDragRef = useRef<LiveBoneRecordDrag | null>(null)
  const mixamoDragRef = useRef<{
    id: MixamoLandmarkId
    label: string
    landmarks: MixamoLandmarks
  } | null>(null)
  const movedRef = useRef(false)
  const [activeDrag, setActiveDrag] = useState<string | null>(null)
  const [activeMixamoId, setActiveMixamoId] = useState<MixamoLandmarkId | null>(null)
  const [hoveredBoneId, setHoveredBoneId] = useState<string | null>(null)
  const [dragAngle, setDragAngle] = useState<{ x: number; y: number; text: string; isLive?: boolean } | null>(null)
  const [liveStroke, setLiveStroke] = useState<Point2D[] | null>(null)
  const [chainIds, setChainIds] = useState<string[]>([])
  const assist = useAnimAssist()
  const advanceLiveRef = useRef<((liveDrag: LiveBoneRecordDrag, p: Point2D) => void) | null>(null)

  const rig = composite.rig
  if (!rig || !rig.bones.length) return null

  const transforms = evaluateRig({ ...rig, loop: false }, time, editing)
  const mixamoLandmarks = editing ? extractLandmarksFromBones(rig.bones) : null

  const toLocalPoint = (event: PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      return new DOMPoint(
        ((event.clientX - rect.left) / rect.width - 0.5) * composite.width,
        ((event.clientY - rect.top) / rect.height - 0.5) * composite.height
      )
    }
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

  const advanceLiveRecord = (liveDrag: LiveBoneRecordDrag, p: Point2D) => {
    const elapsed = Math.min(SKETCH_MAX_DURATION, (performance.now() - liveDrag.t0) / 1000)
    liveDrag.samples.push({ x: p.x, y: p.y, t: elapsed })
    setLiveStroke(liveDrag.samples.map(({ x, y }) => ({ x, y })))
    const { columns, values } = sketchValuesAt(liveDrag.anchor, p, liveDrag.mode, liveDrag.solve)
    const previewTime = Math.min(120, Number((liveDrag.startTime + elapsed).toFixed(3)))
    seek?.(previewTime)
    setComposite((c) => {
      let next = c
      if (c.rig && previewTime > c.rig.duration - 0.05) {
        next = applyRigAction(next, {
          action: 'settings',
          duration: Math.min(120, Math.ceil((previewTime + 0.5) * 10) / 10)
        })
      }
      return applyRigAction(next, {
        action: 'batch',
        operations: sketchPreviewOps(columns, values, previewTime)
      })
    })
    const delta = values[0] - liveDrag.anchor.base.rotation
    const valueLabel =
      liveDrag.mode === 'move'
        ? `${(p.x - liveDrag.anchor.start.x).toFixed(0)}, ${(p.y - liveDrag.anchor.start.y).toFixed(0)}px`
        : `${delta >= 0 ? '+' : ''}${delta.toFixed(0)}°`
    setDragAngle({
      x: p.x,
      y: p.y,
      text: `🔴 GHI REALTIME · ${liveDrag.anchor.boneName} (${valueLabel}) · +${elapsed.toFixed(1)}s`,
      isLive: true
    })
  }

  advanceLiveRef.current = advanceLiveRecord

  const handlePointerDown = (e: PointerEvent, id: string, mode: BoneDragMode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const point = toLocalPoint(e)
    if (!point) return
    stopPlayback?.()
    selectBone(id)
    beginGesture?.()
    movedRef.current = false

    // Chế độ 1: Giữ phím Shift + Chuột trái trên xương ở tab Animation => Ghi động tác Realtime theo thứ tự
    if (!editing && e.shiftKey) {
      const sketchMode: MotionSketchMode = mode === 'head' ? 'move' : 'rotate'
      const useIk = sketchMode === 'rotate' && (mode === 'ik' || assist.ik) && !e.ctrlKey && !e.metaKey
      const chain = useIk ? Math.max(1, assist.ikChain) : 1
      const startTime = Math.max(0, time)
      const anchor = createSketchAnchor(rig, id, startTime, { x: point.x, y: point.y }, chain)
      const liveDrag: LiveBoneRecordDrag = {
        anchor,
        mode: sketchMode,
        chain,
        startTime,
        t0: performance.now(),
        samples: [{ x: point.x, y: point.y, t: 0 }],
        solve: {}
      }
      liveDragRef.current = liveDrag
      setActiveDrag(id)
      setChainIds(anchor.ik?.chain.boneIds ?? [id])
      setLiveStroke([{ x: point.x, y: point.y }])
      setDragAngle({
        x: point.x,
        y: point.y,
        text: `🔴 GHI REALTIME · ${anchor.boneName} · Kéo chuột để diễn hoạt...`,
        isLive: true
      })
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {}
      svgRef.current?.focus()

      // Cho phép giữ chuột đứng yên mà đầu phát vẫn trôi theo thời gian thực
      const tick = () => {
        if (liveDragRef.current !== liveDrag) return
        const lastSample = liveDrag.samples[liveDrag.samples.length - 1]
        if (performance.now() - liveDrag.t0 - lastSample.t * 1000 > 60) {
          advanceLiveRef.current?.(liveDrag, lastSample)
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      return
    }

    // Chế độ 2: Chuột trái bình thường => Xoay/chỉnh xương tự do, sau đó nhấn Enter để xác nhận vị trí
    dragRef.current = startBoneDrag(rig, id, time, editing, mode, point, assist.ikChain)
    setActiveDrag(id)
    setChainIds(dragRef.current.ik?.chain.boneIds ?? [])
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {}
    svgRef.current?.focus()
  }

  const handleStartDragMixamoRing = (
    e: PointerEvent,
    id: MixamoLandmarkId,
    label: string
  ) => {
    if (e.button !== 0 || !mixamoLandmarks) return
    e.stopPropagation()
    stopPlayback?.()
    beginGesture?.()
    movedRef.current = false
    mixamoDragRef.current = { id, label, landmarks: mixamoLandmarks }
    setActiveMixamoId(id)
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {}
    svgRef.current?.focus()
  }

  const handlePointerMove = (e: PointerEvent) => {
    const point = toLocalPoint(e)
    if (!point) return

    if (mixamoDragRef.current) {
      const mDrag = mixamoDragRef.current
      movedRef.current = true
      const nextLandmarks = moveLandmarkPoint(
        mDrag.landmarks,
        mDrag.id,
        { x: point.x, y: point.y },
        !e.altKey,
        true
      )
      mDrag.landmarks = nextLandmarks
      const nextBones = buildHumanoidBonesFromLandmarks(nextLandmarks)
      setComposite((c) =>
        applyRigAction(c, {
          action: 'apply-mixamo-rig-motion',
          bones: nextBones,
          autoBindSoft: true
        })
      )
      setDragAngle({
        x: point.x,
        y: point.y,
        text: `🎯 ${mDrag.label} (${Math.round(point.x)}, ${Math.round(point.y)})${e.altKey ? '' : ' · 🪞 Đối xứng'}`
      })
      return
    }

    if (liveDragRef.current) {
      const liveDrag = liveDragRef.current
      const last = liveDrag.samples[liveDrag.samples.length - 1]
      if (Math.hypot(point.x - last.x, point.y - last.y) < 1.2) return
      movedRef.current = true
      advanceLiveRecord(liveDrag, { x: point.x, y: point.y })
      return
    }

    const drag = dragRef.current
    if (!drag) return
    movedRef.current = true
    const action = boneDragAction(drag, point, e.shiftKey)
    setComposite((c) => applyRigAction(c, action))
    const text =
      action.action === 'batch'
        ? drag.ik
          ? `IK · ${drag.ik.chain.boneIds.length} xương · Enter ⏎ chốt`
          : `${drag.bone.name} · Enter ⏎ chốt`
        : action.action === 'set-key'
          ? action.key.rotation !== undefined
            ? `${action.key.rotation.toFixed(1)}° · Enter ⏎ chốt`
            : `${action.key.x?.toFixed(0)}, ${action.key.y?.toFixed(0)} · Enter ⏎ chốt`
          : action.action === 'update-bone'
            ? `${action.patch.angle?.toFixed(0) ?? ''}°`
            : ''
    setDragAngle({ x: point.x, y: point.y, text })
  }

  const cancelAllDrag = () => {
    if (mixamoDragRef.current) {
      mixamoDragRef.current = null
      cancelGesture?.()
    } else if (liveDragRef.current) {
      const startTime = liveDragRef.current.startTime
      liveDragRef.current = null
      cancelGesture?.()
      seek?.(startTime)
    } else if (dragRef.current) {
      dragRef.current = null
      cancelGesture?.()
    }
    setActiveDrag(null)
    setActiveMixamoId(null)
    setChainIds([])
    setDragAngle(null)
    setLiveStroke(null)
  }

  const endDrag = () => {
    if (mixamoDragRef.current) {
      mixamoDragRef.current = null
      setActiveMixamoId(null)
      setDragAngle(null)
      endGesture?.()
      return
    }
    if (liveDragRef.current) {
      const liveDrag = liveDragRef.current
      liveDragRef.current = null
      setLiveStroke(null)
      setActiveDrag(null)
      setChainIds([])
      setDragAngle(null)
      // Hoàn tác các frame preview tạm để commit 1 lần duy nhất vào lịch sử Undo
      cancelGesture?.()

      if (liveDrag.samples.length < 2) {
        seek?.(liveDrag.startTime)
        return
      }

      let doneSummary: { boneName: string; keyCount: number; endTime: number; bones: number } | null = null
      setComposite((c) => {
        const res = applyMotionSketch(
          c,
          liveDrag.anchor,
          liveDrag.samples,
          {
            mode: liveDrag.mode,
            timing: 'live',
            duration: Math.max(0.2, liveDrag.samples[liveDrag.samples.length - 1].t),
            loopBack: false,
            autoPlay: false,
            chain: liveDrag.chain
          },
          liveDrag.startTime
        )
        const keyCount = Object.values(res.tracks).reduce((n, k) => n + k.length, 0)
        doneSummary = {
          boneName: liveDrag.anchor.boneName,
          keyCount,
          endTime: res.endTime,
          bones: Object.keys(res.tracks).length
        }
        return res.composite
      })

      const done = doneSummary as { boneName: string; keyCount: number; endTime: number; bones: number } | null
      if (done) {
        // Đậu đầu phát tại đúng điểm kết thúc để người dùng giữ Shift + Chuột trái ghi tiếp động tác kế tiếp theo thứ tự
        seek?.(done.endTime)
        const msg = `✓ Đã ghi Realtime "${done.boneName}" (${liveDrag.startTime.toFixed(2)}s → ${done.endTime.toFixed(2)}s · ${done.keyCount} key) — Giữ Shift + Chuột trái để ghi tiếp từ ${done.endTime.toFixed(2)}s`
        setStepRecordState({ pendingConfirm: false, status: msg })
        setMotionSketchState({
          last: {
            boneId: liveDrag.anchor.boneId,
            boneName: done.boneName,
            keyCount: done.keyCount,
            startTime: liveDrag.startTime,
            endTime: done.endTime,
            stroke: liveDrag.samples.map(({ x, y }) => ({ x, y }))
          },
          status: msg
        })
      }
      return
    }

    if (dragRef.current) {
      const draggedBone = dragRef.current.bone
      const draggedTime = dragRef.current.time
      const wasEditing = dragRef.current.editing
      endGesture?.()
      if (!wasEditing && movedRef.current) {
        markBoneAdjusted(draggedBone.name, draggedTime)
      }
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
      onPointerCancel={cancelAllDrag}
      onLostPointerCapture={() => {
        if (dragRef.current || liveDragRef.current) endDrag()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && (dragRef.current || liveDragRef.current)) {
          e.stopPropagation()
          cancelAllDrag()
        }
      }}
    >
      <defs>
        <radialGradient id="lw-bone-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Đường vẽ quỹ đạo khi giữ Shift + Chuột trái ghi Realtime trên xương */}
      {liveStroke && liveStroke.length > 1 && (
        <path d={toPath(liveStroke)} className="lw-sketch-path" pointerEvents="none" />
      )}

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
        const isHovered = hoveredBoneId === bone.id
        const showLabel = (editing && !mixamoLandmarks) || isSelected || isDragging || isHovered
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
            onPointerEnter={() => setHoveredBoneId(bone.id)}
            onPointerLeave={() => setHoveredBoneId((prev) => (prev === bone.id ? null : prev))}
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
              <title>
                {editing
                  ? `${bone.name} (Chế độ tạo xương)`
                  : `${bone.name} · Chuột trái: chỉnh xương (nhấn Enter ⏎ để chốt) · Giữ Shift + Chuột trái: ghi động tác Realtime`}
              </title>
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
              r={isSelected ? 6.5 : editing && mixamoLandmarks && !isHovered ? 3 : 5}
              className={`lw-bone-tail-joint${!editing && assist.ik ? ' ik' : ''}`}
              style={editing && mixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : undefined}
              onPointerDown={(e) => handlePointerDown(e, bone.id, tailMode(e))}
            >
              <title>
                {editing
                  ? 'Kéo để đổi hướng và chiều dài xương'
                  : 'Kéo ngọn: xoay IK · Giữ Shift + Kéo: ghi động tác Realtime · Sau khi chỉnh nhấn Enter ⏎ để chốt vị trí'}
              </title>
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
              r={isSelected ? 8.5 : editing && mixamoLandmarks && !isHovered ? 3.5 : 7}
              className="lw-bone-head-joint"
              style={editing && mixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : undefined}
              onPointerDown={(e) => handlePointerDown(e, bone.id, 'head')}
            >
              <title>Khớp gốc (Pivot): Kéo để dời vị trí (Giữ Shift + Kéo để ghi dời vị trí Realtime)</title>
            </circle>

            {/* Bone Label — chỉ hiện cho xương đang chọn/hover/kéo khi ở tab Animation để không che khuất nhân vật */}
            {showLabel && (
              <text x={wx + nx * (waistW + 8)} y={wy + ny * (waistW + 8)} className="lw-bone-name">
                {bone.name}
              </text>
            )}
          </g>
        )
      })}

      {/* 8 vòng tròn màu chuẩn Mixamo (CHIN, WRISTS, ELBOWS, KNEES, GROIN) trên màn hình 2D khi ở tab Tạo xương */}
      {editing && mixamoLandmarks && (
        <MixamoViewportRingsOverlay
          landmarks={mixamoLandmarks}
          canvasHeight={composite.height}
          activeLandmarkId={activeMixamoId}
          onStartDragLandmark={handleStartDragMixamoRing}
        />
      )}

      {/* Live Dragging Tooltip HUD Badge */}
      {dragAngle && (() => {
        const badgeW = Math.max(92, dragAngle.text.length * 7.2 + 22)
        return (
          <g transform={`translate(${dragAngle.x + 14}, ${dragAngle.y - 14})`} pointerEvents="none">
            <rect
              x={-6}
              y={-15}
              width={badgeW}
              height={22}
              rx={6}
              fill="var(--bg-1)"
              stroke={dragAngle.isLive ? 'var(--key)' : 'var(--accent-cyan)'}
              strokeWidth={1.5}
            />
            <text
              x={(badgeW - 12) / 2}
              y={0}
              textAnchor="middle"
              fill={dragAngle.isLive ? 'var(--key)' : 'var(--text)'}
              fontSize={11}
              fontWeight={700}
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
