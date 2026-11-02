import { useRef, useState, type PointerEvent } from 'react'
import type { BonePose, LayerBone, LayerRig } from '@shared/layerRig'
import { evaluateRig, rotatePoint } from '../../engine/layerRig'
import type { LayerComposite } from './types'
import { startBoneDrag, boneDragAction, type BoneDragMode } from './workshopBoneDrag'
import { applyRigAction, emptyRig, findMirrorBoneId, type RigAction } from './workshopRig'
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
export { buildManipulateTestRig } from './mohoRigHelpers'
import {
  buildManipulateTestRig,
  classifyBoneSide,
  computeBoneInfluenceRadius,
  computeStrengthFromPointerDistance,
  createBoneFromCanvasDrag,
  findClosestBoneJoint,
  isBoneTailCoincidentWithChild,
  withSymmetricBoneAction,
  type BoneJointHit
} from './mohoRigHelpers'
import { WorkshopBoneCapsuleSvg } from './WorkshopBoneCapsuleSvg'
import { WorkshopBoneConstraintArc } from './WorkshopBoneConstraintArc'
import { WorkshopBoneRelationships } from './WorkshopBoneRelationships'
import {
  WorkshopBoneDrawPreview,
  WorkshopSymmetryGuide,
  WorkshopBoneHudBadge,
  type DrawNewBoneDrag
} from './WorkshopBoneDrawPreview'

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


interface StrengthEnvelopeDrag {
  bone: LayerBone
  headX: number
  headY: number
  angleDeg: number
}

interface PendingNewBone {
  pointerId: number
  screenStart: { x: number; y: number }
  start: Point2D
  parentBone: LayerBone | null
  parentJoint?: 'head' | 'tail'
  snapped: boolean
  clickedBoneId?: string
}

const toPath = (pts: Point2D[]) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

/** Khung xương đông xương (nhện, rết, bạch tuộc…) chỉ hiện tên khi rê / chọn để sân khấu không rối chữ. */
const LABEL_ALL_MAX_BONES = 18



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
  const pendingNewBoneRef = useRef<PendingNewBone | null>(null)
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
  const [snapTarget, setSnapTarget] = useState<BoneJointHit | null>(null)
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null)
  const [liveStroke, setLiveStroke] = useState<Point2D[] | null>(null)
  const [chainIds, setChainIds] = useState<string[]>([])
  const assist = useAnimAssist()
  const rigTool = useRigToolStore()
  const advanceLiveRef = useRef<((liveDrag: LiveBoneRecordDrag, p: Point2D) => void) | null>(null)

  const rig = composite.rig ?? emptyRig()
  const isAddBoneTool = editing && rigTool.tool === 'add'
  const isStrengthTool = editing && rigTool.tool === 'strength'
  const isManipulateTool = editing && rigTool.tool === 'manipulate'

  if (!rig.bones.length && !isAddBoneTool && !(editing && rigTool.mirrorDraw)) return null

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

  /** Kéo gốc: ở tab Tạo xương di chuyển khớp gốc; ở Animation chỉ di chuyển Root bone hoặc khi giữ Alt, xương con thì xoay khớp an toàn. */
  const headMode = (e: PointerEvent, bone: LayerBone): BoneDragMode => {
    if (editing && !isManipulateTool) return 'head'
    if (!bone.parentId || e.altKey) return 'head'
    return 'rotate'
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

    // Bắt dính khớp gần nhất (Trục ngọn hoặc Trục gốc) trong bán kính 24px:
    const hit = findClosestBoneJoint(rig.bones, transforms, point, 24)
    let parentBone: LayerBone | null = null
    let parentJoint: 'head' | 'tail' | undefined = undefined
    let startPoint = { x: point.x, y: point.y }

    if (hit) {
      startPoint = { x: hit.point.x, y: hit.point.y }
      parentBone = hit.bone
      parentJoint = hit.joint
    } else {
      parentBone = e.altKey ? null : (rig.bones.find((b) => b.id === boneId) ?? null)
      if (parentBone) {
        const parentTf = transforms.get(parentBone.id)
        if (parentTf) {
          const rad = ((parentBone.angle + parentTf.rotation) * Math.PI) / 180
          const ptx = parentTf.x + Math.cos(rad) * parentBone.length
          const pty = parentTf.y + Math.sin(rad) * parentBone.length
          const dHead = Math.hypot(point.x - parentTf.x, point.y - parentTf.y)
          const dTail = Math.hypot(point.x - ptx, point.y - pty)
          parentJoint = dTail <= dHead ? 'tail' : 'head'
        }
      }
    }

    pendingNewBoneRef.current = {
      pointerId: e.pointerId,
      screenStart: { x: e.clientX, y: e.clientY },
      start: startPoint,
      parentBone,
      parentJoint,
      snapped: Boolean(hit),
      clickedBoneId: hit?.bone.id
    }
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
    if (e.button !== 0 || !editing || (!isStrengthTool && !rigTool.showInfluence)) return
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
      stopPlayback?.()
      const bone = rig.bones.find((b) => b.id === id)
      const tf = transforms.get(id)
      if (bone && tf) {
        let joint: 'head' | 'tail' = 'tail'
        let startX = tf.x
        let startY = tf.y
        if (mode === 'head') {
          joint = 'head'
          startX = tf.x
          startY = tf.y
        } else if (mode === 'tail') {
          joint = 'tail'
          const rad = ((bone.angle + tf.rotation) * Math.PI) / 180
          startX = tf.x + Math.cos(rad) * bone.length
          startY = tf.y + Math.sin(rad) * bone.length
        } else {
          // Bấm trên thân xương: phân định xem gần đầu gốc (head) hay đầu ngọn (tail) hơn
          const point = toLocalPoint(e)
          const rad = ((bone.angle + tf.rotation) * Math.PI) / 180
          const tx = tf.x + Math.cos(rad) * bone.length
          const ty = tf.y + Math.sin(rad) * bone.length
          if (point) {
            const dh = Math.hypot(point.x - tf.x, point.y - tf.y)
            const dt = Math.hypot(point.x - tx, point.y - ty)
            joint = dt <= dh ? 'tail' : 'head'
            startX = dt <= dh ? tx : tf.x
            startY = dt <= dh ? ty : tf.y
          }
        }

        pendingNewBoneRef.current = {
          pointerId: e.pointerId,
          screenStart: { x: e.clientX, y: e.clientY },
          start: { x: startX, y: startY },
          parentBone: bone,
          parentJoint: joint,
          snapped: true,
          clickedBoneId: bone.id
        }
        try {
          svgRef.current?.setPointerCapture(e.pointerId)
        } catch {}
        svgRef.current?.focus()
        return
      }
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

    setHoverPoint(point)

    if (pendingNewBoneRef.current && !drawBoneRef.current) {
      const p = pendingNewBoneRef.current
      const moveDist = Math.hypot(e.clientX - p.screenStart.x, e.clientY - p.screenStart.y)
      if (moveDist >= 12) {
        const drawState: DrawNewBoneDrag = {
          start: p.start,
          current: { x: point.x, y: point.y },
          parentBone: p.parentBone,
          parentJoint: p.parentJoint,
          snapped: p.snapped
        }
        drawBoneRef.current = drawState
        setDrawPreview(drawState)
        setSnapTarget(null)
      }
    }

    if (drawBoneRef.current) {
      const next: DrawNewBoneDrag = { ...drawBoneRef.current, current: { x: point.x, y: point.y } }
      drawBoneRef.current = next
      setDrawPreview(next)
      const dist = Math.hypot(point.x - next.start.x, point.y - next.start.y)
      const parentLabel = next.parentBone
        ? next.snapped
          ? ` · 🔗 Nối khớp ${next.parentJoint === 'tail' ? 'Trục Ngọn' : 'Trục Gốc'} (${next.parentBone.name})`
          : ` · 🔗 Nối nét đứt từ ${next.parentJoint === 'tail' ? 'Trục Ngọn' : 'Trục Gốc'} (${next.parentBone.name})`
        : ' · (Xương gốc mới)'
      setDragAngle({
        x: point.x,
        y: point.y,
        text: `🦴 Dài ${Math.round(dist)}px · ${(Math.atan2(point.y - next.start.y, point.x - next.start.x) * 180 / Math.PI).toFixed(0)}°${parentLabel}${rigTool.mirrorDraw ? ' · 🪞 Đối xứng L⇄R' : ''}`
      })
      return
    }

    if (isAddBoneTool) {
      const hit = findClosestBoneJoint(rig.bones, transforms, point, 24)
      setSnapTarget(hit)
    } else if (snapTarget) {
      setSnapTarget(null)
    }

    if (strengthDragRef.current) {
      const sDrag = strengthDragRef.current
      const rad = (sDrag.angleDeg * Math.PI) / 180
      const nx = -Math.sin(rad)
      const ny = Math.cos(rad)
      const perpDist = Math.abs((point.x - sDrag.headX) * nx + (point.y - sDrag.headY) * ny)
      const strength = computeStrengthFromPointerDistance(sDrag.bone, perpDist)
      const mirrorOn = rigTool.mirrorDraw && !e.altKey
      setComposite((c) => {
        const baseAction: RigAction = { action: 'update-bone', boneId: sDrag.bone.id, patch: { strength } }
        const finalAction = withSymmetricBoneAction(c.rig?.bones ?? [], baseAction, mirrorOn, findMirrorBoneId) as RigAction
        return applyRigAction(c, finalAction)
      })
      const radiusPx = computeBoneInfluenceRadius({ ...sDrag.bone, strength })
      setDragAngle({
        x: point.x,
        y: point.y,
        text: `Vùng uốn "${sDrag.bone.name}": ${Math.round(strength * 100)}% (R=${Math.round(radiusPx)}px)${mirrorOn ? ' · 🪞 Đối xứng' : ''}`
      })
      return
    }

    if (manipulateDragRef.current) {
      const mDrag = manipulateDragRef.current
      const action = boneDragAction(mDrag, point, e.shiftKey)
      const mirrorOn = rigTool.mirrorDraw && !e.altKey
      const applyTestPoseWithMirror = (targetBoneId: string, key: Partial<BonePose>) => {
        setTestBonePose(targetBoneId, key)
        if (mirrorOn) {
          const twinId = findMirrorBoneId(targetBoneId, rig.bones)
          if (twinId && twinId !== targetBoneId) {
            setTestBonePose(twinId, {
              ...(key.rotation !== undefined ? { rotation: -key.rotation } : {}),
              ...(key.x !== undefined ? { x: -key.x } : {}),
              ...(key.y !== undefined ? { y: key.y } : {})
            })
          }
        }
      }
      if (action.action === 'set-key') {
        applyTestPoseWithMirror(action.boneId, action.key)
      } else if (action.action === 'batch') {
        for (const op of action.operations) {
          if (op.action === 'set-key') applyTestPoseWithMirror(op.boneId, op.key)
        }
      }
      setDragAngle({
        x: point.x,
        y: point.y,
        text: `${mDrag.ik ? `Thử khớp IK (${mDrag.ik.chain.boneIds.length} xương)` : `Thử khớp "${mDrag.bone.name}"`}${mirrorOn ? ' · 🪞 Đối xứng' : ''}`
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
    const detachJoints = e.altKey || !rigTool.autoWeld
    const rawAction = boneDragAction(drag, point, e.shiftKey, detachJoints)
    const mirrorOn = drag.editing && rigTool.mirrorDraw && !e.altKey
    setComposite((c) => {
      const finalAction = (
        mirrorOn ? withSymmetricBoneAction(c.rig?.bones ?? [], rawAction, true, findMirrorBoneId) : rawAction
      ) as RigAction
      return applyRigAction(c, finalAction)
    })
    const mirrorSuffix = mirrorOn ? ' · 🪞 Đối xứng' : ''
    const text =
      rawAction.action === 'batch'
        ? drag.ik
          ? `IK · ${drag.ik.chain.boneIds.length} xương · Enter ⏎ chốt`
          : `${drag.bone.name} · Enter ⏎ chốt`
        : rawAction.action === 'set-key'
          ? rawAction.key.rotation !== undefined
            ? `${rawAction.key.rotation.toFixed(1)}° · Enter ⏎ chốt`
            : `${rawAction.key.x?.toFixed(0)}, ${rawAction.key.y?.toFixed(0)} · Enter ⏎ chốt`
          : rawAction.action === 'update-bones'
            ? `${drag.bone.name} · 🔗 Hàn khớp${mirrorSuffix}`
            : rawAction.action === 'update-bone'
              ? `${rawAction.patch.angle !== undefined ? `${rawAction.patch.angle.toFixed(0)}°` : `${Math.round(rawAction.patch.x ?? drag.bone.x)}, ${Math.round(rawAction.patch.y ?? drag.bone.y)}`}${mirrorSuffix}`
              : ''
    setDragAngle({ x: point.x, y: point.y, text })
  }

  const cancelAllDrag = () => {
    pendingNewBoneRef.current = null
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
    setSnapTarget(null)
  }

  const endDrag = () => {
    if (drawBoneRef.current) {
      const d = drawBoneRef.current
      drawBoneRef.current = null
      pendingNewBoneRef.current = null
      setDrawPreview(null)
      setDragAngle(null)
      setSnapTarget(null)
      const dist = Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y)
      if (dist >= 12) {
        beginGesture?.()
        const created = createBoneFromCanvasDrag(d.start, d.current, d.parentBone, rig.bones.length, undefined, d.parentJoint)
        setComposite((c) => {
          let next = applyRigAction(c, { action: 'add-bone', bone: created })
          if (rigTool.mirrorDraw && Math.abs(created.x) > 10) {
            next = applyRigAction(next, { action: 'mirror-bone', boneId: created.id })
          }
          return next
        })
        selectBone(created.id)
        endGesture?.()
      }
      return
    }

    if (pendingNewBoneRef.current) {
      const p = pendingNewBoneRef.current
      pendingNewBoneRef.current = null
      setDrawPreview(null)
      setDragAngle(null)
      setSnapTarget(null)
      if (p.clickedBoneId) {
        selectBone(p.clickedBoneId)
      } else {
        selectBone(null)
      }
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
        if (dragRef.current || liveDragRef.current || drawBoneRef.current || pendingNewBoneRef.current || strengthDragRef.current || manipulateDragRef.current) {
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

      {editing && rigTool.mirrorDraw && <WorkshopSymmetryGuide height={composite.height} />}

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

      {/* Cung giới hạn góc khớp (Adobe Animate Constrain Rotation / Moho Angle Constraints) */}
      {editing && <WorkshopBoneConstraintArc bone={rig.bones.find((b) => b.id === boneId)} transforms={transforms} />}

      {/* Đường vẽ quỹ đạo khi giữ Shift + Chuột trái ghi Realtime trên xương */}
      {liveStroke && liveStroke.length > 1 && (
        <path d={toPath(liveStroke)} className="lw-sketch-path" pointerEvents="none" />
      )}

      {/* Relationship lines connecting child bone head to parent bone head or tail */}
      <WorkshopBoneRelationships bones={rig.bones} transforms={transforms} />

      {/* Moho / Blender Octahedral & Pin Bones with L/C/R Anatomical Coloring */}
      {rig.bones.map((bone) => {
        const tf = transforms.get(bone.id)
        if (!tf) return null
        const side = classifyBoneSide(bone)
        const isSelected = bone.id === boneId
        const isDragging = activeDrag === bone.id || chainIds.includes(bone.id)
        const isHovered = hoveredBoneId === bone.id
        const showLabel = (editing && !mixamoLandmarks && rig.bones.length <= LABEL_ALL_MAX_BONES) || isSelected || isDragging || isHovered
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
        const headR = isSelected ? headBaseR + 1.8 : editing && mixamoLandmarks && !isHovered ? 2.8 : headBaseR
        const tailBaseR = Math.max(2.2, Math.min(4.5, L * 0.045))
        const tailR = isSelected ? tailBaseR + 1.5 : editing && mixamoLandmarks && !isHovered ? 2.2 : tailBaseR
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
                  style={{ cursor: editing && !isManipulateTool ? 'move' : !bone.parentId ? 'move' : 'grab', pointerEvents: 'all' }}
                  onPointerDown={(e) => handlePointerDown(e, bone.id, headMode(e, bone))}
                />
                <circle
                  cx={hx}
                  cy={hy}
                  r={isSelected ? 7.5 : 6}
                  className="lw-pin-bone-ring"
                  onPointerDown={(e) => handlePointerDown(e, bone.id, headMode(e, bone))}
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
                    r={tailR}
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
                  style={{ cursor: editing && !isManipulateTool ? 'move' : !bone.parentId ? 'move' : 'grab', pointerEvents: 'all' }}
                  onPointerDown={(e) => handlePointerDown(e, bone.id, headMode(e, bone))}
                />
                <circle
                  cx={hx}
                  cy={hy}
                  r={headR}
                  className="lw-bone-head-joint"
                  style={editing && mixamoLandmarks && !isSelected && !isHovered ? { opacity: 0.45 } : undefined}
                  onPointerDown={(e) => handlePointerDown(e, bone.id, headMode(e, bone))}
                />
              </>
            )}

            {showLabel && (
              <text x={wx + nx * (waistW + 8)} y={wy + ny * (waistW + 8)} className="lw-bone-name">
                {bone.name}
                {!editing && Math.abs(tf.zOrder ?? 0) >= 1
                  ? ` · Z${(tf.zOrder ?? 0) > 0 ? '+' : ''}${Math.round(tf.zOrder ?? 0)}`
                  : ''}
              </text>
            )}
          </g>
        )
      })}

      {/* Live Preview when drawing a new bone on the 2D Stage (`A`) & Snapping Indicator */}
      <WorkshopBoneDrawPreview
        drawPreview={drawPreview}
        snapTarget={snapTarget}
        isAddBoneTool={isAddBoneTool}
        mirrorDraw={Boolean(rigTool.mirrorDraw)}
        transforms={transforms}
        parentBoneCandidate={rig.bones.find((b) => b.id === boneId)}
        hoverPoint={hoverPoint}
      />

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
      <WorkshopBoneHudBadge hud={dragAngle} />
    </svg>
  )
}
