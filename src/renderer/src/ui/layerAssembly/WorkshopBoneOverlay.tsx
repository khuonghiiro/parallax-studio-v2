import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { BonePose, LayerBone } from '@shared/layerRig'
import { evaluateRig } from '../../engine/layerRig'
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
import {
  registerBoneOverlayCancelHandler,
  setRigToolState,
  setTestBonePose,
  useRigToolStore
} from './rigToolStore'
export { buildManipulateTestRig } from './mohoRigHelpers'
import {
  buildManipulateTestRig,
  computeBoneInfluenceRadius,
  computeStrengthFromPointerDistance,
  createBoneFromCanvasDrag,
  findBoneCapsuleHit,
  findClosestBoneJoint,
  resolveClosestBoneJointForPoint,
  withSymmetricBoneAction,
  type BoneCapsuleHit,
  type BoneJointHit
} from './mohoRigHelpers'
import { WorkshopBoneCapsuleSvg } from './WorkshopBoneCapsuleSvg'
import { WorkshopBoneConstraintArc } from './WorkshopBoneConstraintArc'
import { WorkshopBoneRelationships } from './WorkshopBoneRelationships'
import { WorkshopBoneItemSvg } from './WorkshopBoneItemSvg'
import {
  WorkshopBoneDrawPreview,
  WorkshopSymmetryGuide,
  WorkshopBoneHudBadge,
  type DrawBoneStepMode,
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
  mode: DrawBoneStepMode
  clickedBoneId?: string
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
  const manipulateDragRef = useRef<ReturnType<typeof startBoneDrag> | null>(null)
  const drawBoneRef = useRef<DrawNewBoneDrag | null>(null)
  const pendingNewBoneRef = useRef<PendingNewBone | null>(null)
  const strengthDragRef = useRef<StrengthEnvelopeDrag | null>(null)
  const liveDragRef = useRef<LiveBoneRecordDrag | null>(null)
  const mixamoDragRef = useRef<{ id: MixamoLandmarkId; label: string; landmarks: MixamoLandmarks } | null>(null)
  const movedRef = useRef(false)
  const [activeDrag, setActiveDrag] = useState<string | null>(null)
  const [activeMixamoId, setActiveMixamoId] = useState<MixamoLandmarkId | null>(null)
  const [hoveredBoneId, setHoveredBoneId] = useState<string | null>(null)
  const [dragAngle, setDragAngle] = useState<{ x: number; y: number; text: string; isLive?: boolean } | null>(null)
  const [drawPreview, setDrawPreview] = useState<DrawNewBoneDrag | null>(null)
  const [snapTarget, setSnapTarget] = useState<BoneJointHit | null>(null)
  const [capsuleTarget, setCapsuleTarget] = useState<BoneCapsuleHit | null>(null)
  const [hoverPoint, setHoverPoint] = useState<Point2D | null>(null)
  const [liveStroke, setLiveStroke] = useState<Point2D[] | null>(null)
  const [chainIds, setChainIds] = useState<string[]>([])
  const assist = useAnimAssist()
  const rigTool = useRigToolStore()
  const advanceLiveRef = useRef<((liveDrag: LiveBoneRecordDrag, p: Point2D) => void) | null>(null)
  const cancelDragHandlerRef = useRef<() => boolean>(() => false)

  const rig = composite.rig ?? emptyRig()
  const isAddBoneTool = editing && rigTool.tool === 'add'
  const isStrengthTool = editing && rigTool.tool === 'strength'
  const isManipulateTool = editing && rigTool.tool === 'manipulate'

  useEffect(() => registerBoneOverlayCancelHandler(() => cancelDragHandlerRef.current()), [])

  useEffect(() => {
    if (rigTool.pendingDashedLink && !rig.bones.some((b) => b.id === rigTool.pendingDashedLink?.parentBoneId)) {
      setRigToolState({ pendingDashedLink: null })
    }
  }, [rig.bones, rigTool.pendingDashedLink])

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
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null
  }

  const tailMode = (e: PointerEvent): BoneDragMode => {
    if (editing && !isManipulateTool) return 'tail'
    const useIk = e.ctrlKey || e.metaKey ? !assist.ik : assist.ik
    return useIk ? 'ik' : 'rotate'
  }

  const headMode = (e: PointerEvent, bone: LayerBone): BoneDragMode => {
    if (editing && !isManipulateTool) return 'head'
    return !bone.parentId || e.altKey ? 'head' : 'rotate'
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
        next = applyRigAction(next, { action: 'settings', duration: Math.min(120, Math.ceil((previewTime + 0.5) * 10) / 10) })
      }
      return applyRigAction(next, { action: 'batch', operations: sketchPreviewOps(columns, values, previewTime) })
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

  const beginAddBonePointer = (e: PointerEvent, fallbackBoneId?: string) => {
    if (e.button !== 0 || !isAddBoneTool) return
    e.stopPropagation()
    const point = toLocalPoint(e)
    if (!point) return
    stopPlayback?.()

    const jointHit = findClosestBoneJoint(rig.bones, transforms, point, 24)
    const capsuleHit = !jointHit ? findBoneCapsuleHit(rig.bones, transforms, point, boneId) : null
    const fallbackBone = fallbackBoneId ? (rig.bones.find((b) => b.id === fallbackBoneId) ?? null) : null
    const clickedBoneId = jointHit?.bone.id ?? capsuleHit?.bone.id ?? fallbackBone?.id
    const pendingLink = rigTool.pendingDashedLink
    const linkedParent = pendingLink ? (rig.bones.find((b) => b.id === pendingLink.parentBoneId) ?? null) : null

    if (pendingLink && linkedParent && !e.altKey) {
      pendingNewBoneRef.current = {
        pointerId: e.pointerId,
        screenStart: { x: e.clientX, y: e.clientY },
        start: { x: pendingLink.anchorPoint.x, y: pendingLink.anchorPoint.y },
        parentBone: linkedParent,
        parentJoint: pendingLink.parentJoint,
        snapped: false,
        mode: 'link-step2',
        clickedBoneId
      }
    } else if (jointHit && !e.altKey) {
      pendingNewBoneRef.current = {
        pointerId: e.pointerId,
        screenStart: { x: e.clientX, y: e.clientY },
        start: { x: jointHit.point.x, y: jointHit.point.y },
        parentBone: jointHit.bone,
        parentJoint: jointHit.joint,
        snapped: true,
        mode: 'weld-bone',
        clickedBoneId: jointHit.bone.id
      }
    } else if ((capsuleHit || fallbackBone) && !e.altKey) {
      const targetBone = capsuleHit?.bone ?? fallbackBone!
      const tf = transforms.get(targetBone.id)
      const nearest = tf ? resolveClosestBoneJointForPoint(targetBone, tf, point) : null
      pendingNewBoneRef.current = {
        pointerId: e.pointerId,
        screenStart: { x: e.clientX, y: e.clientY },
        start: nearest ? { x: nearest.point.x, y: nearest.point.y } : { x: point.x, y: point.y },
        parentBone: targetBone,
        parentJoint: nearest?.joint ?? capsuleHit?.nearestJoint ?? 'tail',
        snapped: false,
        mode: 'link-step1',
        clickedBoneId: targetBone.id
      }
    } else {
      const focusedBone = e.altKey ? null : (rig.bones.find((b) => b.id === boneId) ?? null)
      const focusedTf = focusedBone ? transforms.get(focusedBone.id) : undefined
      const parentJoint = focusedBone && focusedTf ? resolveClosestBoneJointForPoint(focusedBone, focusedTf, point).joint : undefined
      pendingNewBoneRef.current = {
        pointerId: e.pointerId,
        screenStart: { x: e.clientX, y: e.clientY },
        start: { x: point.x, y: point.y },
        parentBone: focusedBone,
        parentJoint,
        snapped: false,
        mode: focusedBone ? 'outside-bone' : 'root-bone',
        clickedBoneId: undefined
      }
    }

    try {
      svgRef.current?.setPointerCapture(e.pointerId)
    } catch {}
    svgRef.current?.focus()
  }

  const handleCanvasPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button === 0 && isAddBoneTool) beginAddBonePointer(e)
  }

  const handleStartStrengthDrag = (e: PointerEvent, bone: LayerBone, headX: number, headY: number, angleDeg: number) => {
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
      beginAddBonePointer(e, id)
      return
    }
    if (isStrengthTool) {
      const bone = rig.bones.find((b) => b.id === id)
      const tf = transforms.get(id)
      if (bone && tf) handleStartStrengthDrag(e, bone, tf.x, tf.y, bone.angle + tf.rotation)
      return
    }
    e.stopPropagation()
    const point = toLocalPoint(e)
    if (!point) return
    stopPlayback?.()
    selectBone(id)

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
      setDragAngle({ x: point.x, y: point.y, text: `🔴 GHI REALTIME · ${anchor.boneName} · Kéo chuột để diễn hoạt...`, isLive: true })
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
      if (Math.hypot(e.clientX - p.screenStart.x, e.clientY - p.screenStart.y) >= 12) {
        const drawState: DrawNewBoneDrag = {
          start: p.start,
          current: { x: point.x, y: point.y },
          parentBone: p.parentBone,
          parentJoint: p.parentJoint,
          snapped: p.snapped,
          mode: p.mode
        }
        drawBoneRef.current = drawState
        setDrawPreview(drawState)
        setSnapTarget(null)
        setCapsuleTarget(null)
      }
    }

    if (drawBoneRef.current) {
      let next: DrawNewBoneDrag = { ...drawBoneRef.current, current: { x: point.x, y: point.y } }
      if (next.mode === 'link-step1' && next.parentBone) {
        const tf = transforms.get(next.parentBone.id)
        if (tf) {
          const nearest = resolveClosestBoneJointForPoint(next.parentBone, tf, point)
          next = { ...next, start: { x: nearest.point.x, y: nearest.point.y }, parentJoint: nearest.joint }
        }
      }
      drawBoneRef.current = next
      setDrawPreview(next)
      const dist = Math.hypot(point.x - next.start.x, point.y - next.start.y)
      const angleDeg = ((Math.atan2(point.y - next.start.y, point.x - next.start.x) * 180) / Math.PI).toFixed(0)

      if (next.mode === 'link-step1' && next.parentBone) {
        setDragAngle({
          x: point.x,
          y: point.y,
          text: `🔗 Nét 1 (Nét đứt): ${next.parentJoint === 'tail' ? 'Trục Ngọn' : 'Trục Gốc'} (${next.parentBone.name}) → (${Math.round(point.x)}, ${Math.round(point.y)}) · Nhả chuột chốt điểm, vẽ Nét 2 tạo xương (Esc huỷ)`
        })
      } else if (next.mode === 'link-step2' && next.parentBone) {
        setDragAngle({
          x: point.x,
          y: point.y,
          text: `🦴 Nét 2 (Tạo xương): Dài ${Math.round(dist)}px · ${angleDeg}° · 🔗 Nối nét đứt từ ${next.parentBone.name}${rigTool.mirrorDraw ? ' · 🪞 Đối xứng' : ''} (Esc huỷ)`
        })
      } else {
        const parentLabel = next.parentBone
          ? next.snapped
            ? ` · 🔗 Hàn khớp ${next.parentJoint === 'tail' ? 'Trục Ngọn' : 'Trục Gốc'} (${next.parentBone.name})`
            : ` · 🔗 Nét đứt tự bắt ${next.parentJoint === 'tail' ? 'Trục Ngọn' : 'Trục Gốc'} (${next.parentBone.name})`
          : ' · (Xương gốc mới tách rời)'
        setDragAngle({
          x: point.x,
          y: point.y,
          text: `🦴 Dài ${Math.round(dist)}px · ${angleDeg}°${parentLabel}${rigTool.mirrorDraw ? ' · 🪞 Đối xứng L⇄R' : ''} (Esc huỷ)`
        })
      }
      return
    }

    if (isAddBoneTool) {
      if (rigTool.pendingDashedLink) {
        setSnapTarget(null)
        setCapsuleTarget(null)
      } else {
        const hit = findClosestBoneJoint(rig.bones, transforms, point, 24)
        setSnapTarget(hit)
        setCapsuleTarget(hit ? null : findBoneCapsuleHit(rig.bones, transforms, point, boneId))
      }
    } else {
      if (snapTarget) setSnapTarget(null)
      if (capsuleTarget) setCapsuleTarget(null)
    }

    if (strengthDragRef.current) {
      const sDrag = strengthDragRef.current
      const rad = (sDrag.angleDeg * Math.PI) / 180
      const perpDist = Math.abs((point.x - sDrag.headX) * -Math.sin(rad) + (point.y - sDrag.headY) * Math.cos(rad))
      const strength = computeStrengthFromPointerDistance(sDrag.bone, perpDist)
      const mirrorOn = rigTool.mirrorDraw && !e.altKey
      setComposite((c) => {
        const baseAction: RigAction = { action: 'update-bone', boneId: sDrag.bone.id, patch: { strength } }
        return applyRigAction(c, withSymmetricBoneAction(c.rig?.bones ?? [], baseAction, mirrorOn, findMirrorBoneId) as RigAction)
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
      if (action.action === 'set-key') applyTestPoseWithMirror(action.boneId, action.key)
      else if (action.action === 'batch') {
        for (const op of action.operations) if (op.action === 'set-key') applyTestPoseWithMirror(op.boneId, op.key)
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
      mDrag.landmarks = moveLandmarkPoint(mDrag.landmarks, mDrag.id, { x: point.x, y: point.y }, !e.altKey, true)
      const nextBones = buildHumanoidBonesFromLandmarks(mDrag.landmarks)
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
    setComposite((c) =>
      applyRigAction(
        c,
        (mirrorOn ? withSymmetricBoneAction(c.rig?.bones ?? [], rawAction, true, findMirrorBoneId) : rawAction) as RigAction
      )
    )
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
    const pointerId = pendingNewBoneRef.current?.pointerId
    if (pointerId !== undefined) {
      try {
        svgRef.current?.releasePointerCapture(pointerId)
      } catch {}
    }
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
    setCapsuleTarget(null)
  }

  cancelDragHandlerRef.current = () => {
    const hasActiveDrag = Boolean(
      drawBoneRef.current ||
        pendingNewBoneRef.current ||
        strengthDragRef.current ||
        manipulateDragRef.current ||
        mixamoDragRef.current ||
        liveDragRef.current ||
        dragRef.current
    )
    if (!hasActiveDrag) return false
    cancelAllDrag()
    setRigToolState({ statusHint: 'Đã huỷ thao tác vẽ xương đang kéo (Esc).' })
    return true
  }

  const endDrag = () => {
    if (drawBoneRef.current) {
      const d = drawBoneRef.current
      drawBoneRef.current = null
      pendingNewBoneRef.current = null
      setDrawPreview(null)
      setDragAngle(null)
      setSnapTarget(null)
      setCapsuleTarget(null)

      if (d.mode === 'link-step1' && d.parentBone) {
        if (Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y) >= 8) {
          const anchorPoint = { x: Math.round(d.current.x), y: Math.round(d.current.y) }
          selectBone(d.parentBone.id)
          setRigToolState({
            pendingDashedLink: {
              parentBoneId: d.parentBone.id,
              parentBoneName: d.parentBone.name,
              parentJoint: d.parentJoint ?? 'tail',
              anchorPoint
            },
            statusHint: `Nét 1 đã chốt nét đứt từ "${d.parentBone.name}" tới (${anchorPoint.x}, ${anchorPoint.y}) — Kéo Nét 2 để tạo xương hoặc nhấn Esc để huỷ.`
          })
        }
        return
      }

      if (Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y) >= 12) {
        beginGesture?.()
        const created = createBoneFromCanvasDrag(d.start, d.current, d.parentBone, rig.bones.length, undefined, d.parentJoint)
        const targetLayerId = rigTool.targetBindingLayerId
        const targetMode = rigTool.targetBindingMode ?? 'rigid'
        setComposite((c) => {
          let next = applyRigAction(c, { action: 'add-bone', bone: created })
          if (rigTool.mirrorDraw && Math.abs(created.x) > 10) {
            next = applyRigAction(next, { action: 'mirror-bone', boneId: created.id })
          }
          if (targetLayerId) {
            next = applyRigAction(next, { action: 'bind', boneId: created.id, layerIds: [targetLayerId], mode: targetMode })
          }
          return next
        })
        selectBone(created.id)
        const boundLayer = targetLayerId ? composite.layers.find((l) => l.id === targetLayerId) : null
        setRigToolState({
          pendingDashedLink: null,
          targetBindingLayerId: null,
          statusHint: boundLayer
            ? `✓ Đã tạo "${created.name}" và gắn thẳng vào bộ phận "${boundLayer.name}".`
            : d.parentBone
              ? d.snapped
                ? `Đã hàn khớp xương "${created.name}" vào "${d.parentBone.name}".`
                : `Đã tạo xương "${created.name}" nối nét đứt với "${d.parentBone.name}".`
              : `Đã tạo xương gốc mới tách rời "${created.name}".`
        })
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
      setCapsuleTarget(null)
      if (p.clickedBoneId) {
        selectBone(p.clickedBoneId)
        const clickedBone = rig.bones.find((b) => b.id === p.clickedBoneId)
        setRigToolState({
          pendingDashedLink: rigTool.pendingDashedLink?.parentBoneId === p.clickedBoneId ? rigTool.pendingDashedLink : null,
          statusHint: clickedBone
            ? `Đang focus xương "${clickedBone.name}" — Kéo ở 2 tâm điểm để hàn khớp, kéo từ vỏ uốn để vẽ nét đứt (2 bước), hoặc kéo ngoài vỏ để nối nhanh 1 bước (Esc bỏ focus).`
            : null
        })
      } else {
        selectBone(null)
        setRigToolState({
          pendingDashedLink: null,
          statusHint: 'Đã bỏ chọn xương — Kéo vẽ ngoài vỏ uốn lúc này sẽ tạo xương gốc mới tách rời.'
        })
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
        doneSummary = { boneName: liveDrag.anchor.boneName, keyCount, endTime: res.endTime, bones: Object.keys(res.tracks).length }
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
      if (!wasEditing && movedRef.current) markBoneAdjusted(draggedBone.name, draggedTime)
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
        if (
          dragRef.current ||
          liveDragRef.current ||
          drawBoneRef.current ||
          pendingNewBoneRef.current ||
          strengthDragRef.current ||
          manipulateDragRef.current
        ) {
          endDrag()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          if (cancelDragHandlerRef.current()) return
          if (rigTool.pendingDashedLink) {
            setRigToolState({
              pendingDashedLink: null,
              statusHint: 'Đã huỷ nét đứt Nét 1 (Esc) — Kéo lại từ vỏ uốn để xác định điểm mới.'
            })
            return
          }
          if (boneId) {
            selectBone(null)
            setRigToolState({
              pendingDashedLink: null,
              statusHint: 'Đã bỏ focus xương (Esc) — Vẽ ngoài vỏ uốn lúc này sẽ tạo xương mới tách rời.'
            })
          }
        }
      }}
    >
      {isAddBoneTool && (
        <rect x={-composite.width / 2} y={-composite.height / 2} width={composite.width} height={composite.height} fill="transparent" />
      )}
      {editing && rigTool.mirrorDraw && <WorkshopSymmetryGuide height={composite.height} />}
      {editing && (rigTool.showInfluence || isStrengthTool) && rig.bones.length > 0 && (
        <WorkshopBoneCapsuleSvg
          composite={composite}
          bones={rig.bones}
          transforms={transforms}
          selectedBoneId={boneId}
          interactive={isStrengthTool}
          onStartStrengthDrag={isAddBoneTool ? undefined : handleStartStrengthDrag}
        />
      )}
      {editing && <WorkshopBoneConstraintArc bone={rig.bones.find((b) => b.id === boneId)} transforms={transforms} />}
      {liveStroke && liveStroke.length > 1 && <path d={toPath(liveStroke)} className="lw-sketch-path" pointerEvents="none" />}
      <WorkshopBoneRelationships bones={rig.bones} transforms={transforms} />
      {rig.bones.map((bone) => (
        <WorkshopBoneItemSvg
          key={bone.id}
          bone={bone}
          bones={rig.bones}
          transforms={transforms}
          boneId={boneId}
          activeDrag={activeDrag}
          chainIds={chainIds}
          hoveredBoneId={hoveredBoneId}
          setHoveredBoneId={setHoveredBoneId}
          editing={editing}
          isManipulateTool={isManipulateTool}
          hasMixamoLandmarks={Boolean(mixamoLandmarks)}
          ikEnabled={assist.ik}
          showLabels={rigTool.showBoneLabels ?? true}
          onPointerDown={handlePointerDown}
          tailMode={tailMode}
          headMode={headMode}
        />
      ))}
      <WorkshopBoneDrawPreview
        drawPreview={drawPreview}
        snapTarget={snapTarget}
        capsuleTarget={capsuleTarget}
        pendingDashedLink={rigTool.pendingDashedLink}
        bones={rig.bones}
        isAddBoneTool={isAddBoneTool}
        mirrorDraw={Boolean(rigTool.mirrorDraw)}
        transforms={transforms}
        parentBoneCandidate={rig.bones.find((b) => b.id === boneId)}
        hoverPoint={hoverPoint}
      />
      {editing && mixamoLandmarks && (
        <MixamoViewportRingsOverlay
          landmarks={mixamoLandmarks}
          canvasHeight={composite.height}
          activeLandmarkId={activeMixamoId}
          onStartDragLandmark={handleStartDragMixamoRing}
        />
      )}
      <WorkshopBoneHudBadge hud={dragAngle} />
    </svg>
  )
}
