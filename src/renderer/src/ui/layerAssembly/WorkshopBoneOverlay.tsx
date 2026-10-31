import { useRef, useState, type PointerEvent } from 'react'
import type { BonePose, LayerBone, LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { startBoneDrag, boneDragAction, type BoneDragMode } from './workshopBoneDrag'
import { applyRigAction, emptyRig } from './workshopRig'
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
import { setTestBonePose, useRigToolStore } from './rigToolStore'
import {
  classifyBoneSide,
  computeBoneInfluenceRadius,
  computeStrengthFromPointerDistance,
  createBoneFromCanvasDrag,
  isBoneTailCoincidentWithChild
} from './mohoRigHelpers'
import { WorkshopBoneCapsuleSvg } from './WorkshopBoneCapsuleSvg'

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

interface DrawNewBoneDrag {
  start: Point2D
  current: Point2D
  parentBone: LayerBone | null
}

interface StrengthEnvelopeDrag {
  bone: LayerBone
  headX: number
  headY: number
  angleDeg: number
}

const toPath = (pts: Point2D[]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

/** Tạo rig giả lập tại t=0 phục vụ công cụ Thử bẻ khớp Moho `Z` (Manipulate Bones) trong tab Tạo xương. */
export function buildManipulateTestRig(baseRig: LayerRig, testPoses: Record<string, BonePose>): LayerRig {
  const tracks: LayerRig['tracks'] = {}
  for (const [id, pose] of Object.entries(testPoses)) {
    if (baseRig.bones.some((b) => b.id === id)) {
      tracks[id] = [{ time: 0, ...pose, easing: 'linear' }]
    }
  }
  return { ...baseRig, duration: Math.max(1, baseRig.duration || 2), loop: false, tracks }
}

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
  const manipulateDragRef = useRef<ReturnType<typeof startBoneDrag> | null>(null)
  const drawBoneRef = useRef<DrawNewBoneDrag | null>(null)
  const strengthDragRef = useRef<StrengthEnvelopeDrag | null>(null)
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
  const [drawPreview, setDrawPreview] = useState<DrawNewBoneDrag | null>(null)
  const [liveStroke, setLiveStroke] = useState<Point2D[] | null>(null)
  const [chainIds, setChainIds] = useState<string[]>([])
  const assist = useAnimAssist()
  const rigTool = useRigToolStore()
  const advanceLiveRef = useRef<((liveDrag: LiveBoneRecordDrag, p: Point2D) => void) | null>(null)

  const rig = composite.rig ?? emptyRig()
  const isAddBoneTool = editing && rigTool.tool === 'add'
  const isStrengthTool = editing && rigTool.tool === 'strength'
  const isManipulateTool = editing && rigTool.tool === 'manipulate'

  if (!rig.bones.length && !isAddBoneTool) return null

  const activeRigForEval = isManipulateTool ? buildManipulateTestRig(rig, rigTool.testPoses) : { ...rig, loop: false }
  const transforms = evaluateRig(activeRigForEval, isManipulateTool ? 0 : time, editing && !isManipulateTool)
  const mixamoLandmarks = editing && rigTool.tool === 'select' ? extractLandmarksFromBones(rig.bones) : null

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

  /** Kéo ngọn: ở tab Tạo xương (Select) kéo dài/xoay xương; ở Manipulate (Z) hoặc tab Animation dùng IK/FK. */
  const tailMode = (e: PointerEvent): BoneDragMode => {
    if (editing && !isManipulateTool) return 'tail'
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

  const handleCanvasPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !isAddBoneTool) return
    if (e.target !== svgRef.current && (e.target as Element)?.tagName?.toLowerCase() !== 'rect') return
    e.stopPropagation()
    const point = toLocalPoint(e)
    if (!point) return
    stopPlayback?.()
    const parentBone = e.altKey ? null : (rig.bones.find((b) => b.id === boneId) ?? null)
    const drawState: DrawNewBoneDrag = {
      start: { x: point.x, y: point.y },
      current: { x: point.x, y: point.y },
      parentBone
    }
    drawBoneRef.current = drawState
    setDrawPreview(drawState)
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {}
    svgRef.current?.focus()
  }

  const handleStartStrengthDrag = (
    e: PointerEvent,
    bone: LayerBone,
    headX: number,
    headY: number,
    angleDeg: number
  ) => {
    if (e.button !== 0 || !isStrengthTool) return
    e.stopPropagation()
    stopPlayback?.()
    selectBone(bone.id)
    beginGesture?.()
    strengthDragRef.current = { bone, headX, headY, angleDeg }
    setActiveDrag(bone.id)
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {}
    svgRef.current?.focus()
  }

  const handlePointerDown = (e: PointerEvent, id: string, mode: BoneDragMode) => {
    if (e.button !== 0) return
    if (isAddBoneTool) {
      e.stopPropagation()
      selectBone(id)
      return
    }
    if (isStrengthTool) {
      const bone = rig.bones.find((b) => b.id === id)
      const tf = transforms.get(id)
      if (bone && tf) {
        handleStartStrengthDrag(e, bone, tf.x, tf.y, bone.angle + tf.rotation)
      }
      return
    }
    e.stopPropagation()
    const point = toLocalPoint(e)
    if (!point) return
    stopPlayback?.()
    selectBone(id)

    // Công cụ Moho Manipulate Bones (Z) ngay trong tab Tạo xương: bẻ thử IK/FK mà không tạo keyframe
    if (isManipulateTool) {
      const testRig = buildManipulateTestRig(rig, rigTool.testPoses)
      const manipMode: BoneDragMode = mode === 'tail' ? tailMode(e) : mode === 'head' ? 'rotate' : mode
      manipulateDragRef.current = startBoneDrag(testRig, id, 0, false, manipMode, point, assist.ikChain)
      setActiveDrag(id)
      setChainIds(manipulateDragRef.current.ik?.chain.boneIds ?? [id])
      try {
        svgRef.current?.setPointerCapture(e.pointerId)
      } catch {}
      svgRef.current?.focus()
      return
    }

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

    // Chế độ 2: Chuột trái bình thường => Xoay/chỉnh xương tự do
    dragRef.current = startBoneDrag(rig, id, time, editing, mode, point, assist.ikChain)
    setActiveDrag(id)
    setChainIds(dragRef.current.ik?.chain.boneIds ?? [])
    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {}
    svgRef.current?.focus()
  }

  const handleStartDragMixamoRing = (e: PointerEvent, id: MixamoLandmarkId, label: string) => {
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

    if (drawBoneRef.current) {
      const next: DrawNewBoneDrag = { ...drawBoneRef.current, current: { x: point.x, y: point.y } }
      drawBoneRef.current = next
      setDrawPreview(next)
      const dist = Math.hypot(point.x - next.start.x, point.y - next.start.y)
      setDragAngle({
        x: point.x,
        y: point.y,
        text:
          dist < 12
            ? '📌 Nhả chuột để đặt Chốt Pin Bone · Kéo dài để vẽ xương'
            : `🦴 Dài ${Math.round(dist)}px · ${(Math.atan2(point.y - next.start.y, point.x - next.start.x) * 180 / Math.PI).toFixed(0)}°${rigTool.mirrorDraw ? ' · 🪞 Đối xứng L⇄R' : ''}`
      })
      return
    }

    if (strengthDragRef.current) {
      const sDrag = strengthDragRef.current
      const rad = (sDrag.angleDeg * Math.PI) / 180
      const nx = -Math.sin(rad)
      const ny = Math.cos(rad)
      const perpDist = Math.abs((point.x - sDrag.headX) * nx + (point.y - sDrag.headY) * ny)
      const strength = computeStrengthFromPointerDistance(sDrag.bone, perpDist)
      setComposite((c) => applyRigAction(c, { action: 'update-bone', boneId: sDrag.bone.id, patch: { strength } }))
      const radiusPx = computeBoneInfluenceRadius({ ...sDrag.bone, strength })
      setDragAngle({
        x: point.x,
        y: point.y,
        text: `Vùng uốn "${sDrag.bone.name}": ${Math.round(strength * 100)}% (R=${Math.round(radiusPx)}px)`
      })
      return
    }

    if (manipulateDragRef.current) {
      const mDrag = manipulateDragRef.current
      const action = boneDragAction(mDrag, point, e.shiftKey)
      if (action.action === 'set-key') {
        setTestBonePose(action.boneId, action.key)
      } else if (action.action === 'batch') {
        for (const op of action.operations) {
          if (op.action === 'set-key') setTestBonePose(op.boneId, op.key)
        }
      }
      setDragAngle({
        x: point.x,
        y: point.y,
        text: mDrag.ik ? `Thử khớp IK (${mDrag.ik.chain.boneIds.length} xương)` : `Thử khớp "${mDrag.bone.name}"`
      })
      return
    }

    if (mixamoDragRef.current) {
      const mDrag = mixamoDragRef.current
      movedRef.current = true
      const nextLandmarks = moveLandmarkPoint(mDrag.landmarks, mDrag.id, { x: point.x, y: point.y }, !e.altKey, true)
      mDrag.landmarks = nextLandmarks
      const nextBones = buildHumanoidBonesFromLandmarks(nextLandmarks)
      setComposite((c) => applyRigAction(c, { action: 'apply-mixamo-rig-motion', bones: nextBones, autoBindSoft: true }))
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
    const action = boneDragAction(drag, point, e.shiftKey, e.altKey)
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
          : action.action === 'update-bones'
            ? `${drag.bone.name} · 🔗 Hàn khớp (Alt: tách rời)`
            : action.action === 'update-bone'
              ? `${action.patch.angle !== undefined ? `${action.patch.angle.toFixed(0)}°` : `${Math.round(action.patch.x ?? drag.bone.x)}, ${Math.round(action.patch.y ?? drag.bone.y)}`}`
              : ''
    setDragAngle({ x: point.x, y: point.y, text })
  }

  const cancelAllDrag = () => {
    if (drawBoneRef.current) {
      drawBoneRef.current = null
      setDrawPreview(null)
    } else if (strengthDragRef.current) {
      strengthDragRef.current = null
      cancelGesture?.()
    } else if (manipulateDragRef.current) {
      manipulateDragRef.current = null
    } else if (mixamoDragRef.current) {
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
    if (drawBoneRef.current) {
      const d = drawBoneRef.current
      drawBoneRef.current = null
      setDrawPreview(null)
      setDragAngle(null)
      beginGesture?.()
      const created = createBoneFromCanvasDrag(d.start, d.current, d.parentBone, rig.bones.length)
      setComposite((c) => {
        let next = applyRigAction(c, { action: 'add-bone', bone: created })
        if (rigTool.mirrorDraw && Math.abs(created.x) > 10) {
          next = applyRigAction(next, { action: 'mirror-bone', boneId: created.id })
        }
        return next
      })
      selectBone(created.id)
      endGesture?.()
      return
    }
    if (strengthDragRef.current) {
      strengthDragRef.current = null
      setActiveDrag(null)
      setDragAngle(null)
      endGesture?.()
      return
    }
    if (manipulateDragRef.current) {
      manipulateDragRef.current = null
      setActiveDrag(null)
      setChainIds([])
      setDragAngle(null)
      return
    }
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
        seek?.(done.endTime)
        const msg = `✓ Đã ghi Realtime "${done.boneName}" (${liveDrag.startTime.toFixed(2)}s → ${done.endTime.toFixed(2)}s · ${done.keyCount} key)`
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
      className={`lw-bone-overlay${isAddBoneTool ? ' tool-add' : ''}${isStrengthTool ? ' tool-strength' : ''}${isManipulateTool ? ' tool-manipulate' : ''}`}
      viewBox={`${-composite.width / 2} ${-composite.height / 2} ${composite.width} ${composite.height}`}
      tabIndex={0}
      aria-label="Khung xương Moho trên màn hình 2D"
      style={isAddBoneTool ? { pointerEvents: 'all', cursor: 'crosshair' } : undefined}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={cancelAllDrag}
      onLostPointerCapture={() => {
        if (dragRef.current || liveDragRef.current || drawBoneRef.current || strengthDragRef.current || manipulateDragRef.current) {
          endDrag()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          cancelAllDrag()
        }
      }}
    >
      {isAddBoneTool && (
        <rect
          x={-composite.width / 2}
          y={-composite.height / 2}
          width={composite.width}
          height={composite.height}
          fill="transparent"
        />
      )}

      {isAddBoneTool && rigTool.mirrorDraw && (
        <line
          x1={0}
          y1={-composite.height / 2}
          x2={0}
          y2={composite.height / 2}
          stroke="var(--accent-cyan)"
          strokeWidth={1.2}
          strokeDasharray="5 5"
          opacity={0.55}
          pointerEvents="none"
        />
      )}

      {/* Moho Pro Bone Influence Capsules (Vùng ảnh hưởng uốn Mesh) */}
      {editing && (rigTool.showInfluence || isStrengthTool) && rig.bones.length > 0 && (
        <WorkshopBoneCapsuleSvg
          bones={rig.bones}
          transforms={transforms}
          selectedBoneId={boneId}
          interactive={isStrengthTool}
          onStartStrengthDrag={handleStartStrengthDrag}
        />
      )}

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

      {/* Moho / Blender Octahedral & Pin Bones with L/C/R Anatomical Coloring */}
      {rig.bones.map((bone) => {
        const tf = transforms.get(bone.id)
        if (!tf) return null
        const side = classifyBoneSide(bone)
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
        const bodyDragMode: BoneDragMode = editing && !isManipulateTool ? 'head' : 'rotate'

        return (
          <g
            key={bone.id}
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
                  style={{ cursor: editing && !isManipulateTool ? 'move' : 'grab', pointerEvents: 'all' }}
                  onPointerDown={(e) => handlePointerDown(e, bone.id, 'head')}
                />
                <circle
                  cx={hx}
                  cy={hy}
                  r={isSelected ? 11 : 9}
                  className="lw-pin-bone-ring"
                  onPointerDown={(e) => handlePointerDown(e, bone.id, 'head')}
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
                  onPointerDown={(e) => handlePointerDown(e, bone.id, bodyDragMode)}
                />
                <polygon
                  points={`${hx},${hy} ${leftX},${leftY} ${tx},${ty}`}
                  className="lw-bone-facet lw-bone-facet-top"
                  onPointerDown={(e) => handlePointerDown(e, bone.id, bodyDragMode)}
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
                  onPointerDown={(e) => handlePointerDown(e, bone.id, bodyDragMode)}
                />
                <line x1={hx} y1={hy} x2={tx} y2={ty} className="lw-bone-ridge" />

                <circle
                  cx={tx}
                  cy={ty}
                  r={16}
                  fill="transparent"
                  style={{ cursor: 'crosshair', pointerEvents: 'all' }}
                  onPointerDown={(e) => handlePointerDown(e, bone.id, tailMode(e))}
                />
                {(isSelected || isHovered || !isBoneTailCoincidentWithChild(bone, rig.bones, transforms, 3)) && (
                  <circle
                    cx={tx}
                    cy={ty}
                    r={isSelected ? 6.5 : editing && mixamoLandmarks && !isHovered ? 3 : 5}
                    className={`lw-bone-tail-joint${(!editing || isManipulateTool) && assist.ik ? ' ik' : ''}`}
                    style={editing && mixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : undefined}
                    onPointerDown={(e) => handlePointerDown(e, bone.id, tailMode(e))}
                  />
                )}

                <circle
                  cx={hx}
                  cy={hy}
                  r={18}
                  fill="transparent"
                  style={{ cursor: 'move', pointerEvents: 'all' }}
                  onPointerDown={(e) => handlePointerDown(e, bone.id, 'head')}
                />
                <circle
                  cx={hx}
                  cy={hy}
                  r={isSelected ? 8.5 : editing && mixamoLandmarks && !isHovered ? 3.5 : 7}
                  className="lw-bone-head-joint"
                  style={editing && mixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : undefined}
                  onPointerDown={(e) => handlePointerDown(e, bone.id, 'head')}
                />
              </>
            )}

            {showLabel && (
              <text x={wx + nx * (waistW + 8)} y={wy + ny * (waistW + 8)} className="lw-bone-name">
                {bone.name}
              </text>
            )}
          </g>
        )
      })}

      {/* Live Preview when drawing a new bone on the 2D Stage (`A`) */}
      {drawPreview && (
        <g pointerEvents="none" className="lw-draw-bone-preview">
          <line
            x1={drawPreview.start.x}
            y1={drawPreview.start.y}
            x2={drawPreview.current.x}
            y2={drawPreview.current.y}
            stroke="var(--key)"
            strokeWidth={3}
            strokeDasharray="5 4"
          />
          <circle cx={drawPreview.start.x} cy={drawPreview.start.y} r={6.5} fill="var(--key)" />
          <circle cx={drawPreview.current.x} cy={drawPreview.current.y} r={5} fill="var(--accent-cyan)" />
          {rigTool.mirrorDraw && Math.abs(drawPreview.start.x) > 10 && (
            <>
              <line
                x1={-drawPreview.start.x}
                y1={drawPreview.start.y}
                x2={-drawPreview.current.x}
                y2={drawPreview.current.y}
                stroke="var(--accent-cyan)"
                strokeWidth={2.5}
                strokeDasharray="4 4"
                opacity={0.8}
              />
              <circle cx={-drawPreview.start.x} cy={drawPreview.start.y} r={5.5} fill="var(--accent-cyan)" opacity={0.8} />
            </>
          )}
        </g>
      )}

      {/* 8 vòng tròn màu chuẩn Mixamo (chỉ hiện ở công cụ Select để không vướng khi Vẽ xương / Vùng uốn / Thử khớp) */}
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
        const badgeW = Math.max(96, dragAngle.text.length * 7.0 + 22)
        return (
          <g transform={`translate(${dragAngle.x + 14}, ${dragAngle.y - 14})`} pointerEvents="none">
            <rect
              x={-6}
              y={-15}
              width={badgeW}
              height={22}
              rx={5}
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
