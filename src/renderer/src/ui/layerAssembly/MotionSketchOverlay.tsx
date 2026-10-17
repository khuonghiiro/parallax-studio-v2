import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { BoneOverlayProps } from './WorkshopBoneOverlay'
import { applyRigAction } from './workshopRig'
import {
  SKETCH_MAX_DURATION,
  applyAutoBoneMotionSketch,
  applyMotionSketch,
  boneSegments,
  createSketchAnchor,
  pickSketchBone,
  sketchPreviewOps,
  sketchValuesAt,
  type MotionSketchMode,
  type Point2D,
  type SketchAnchor,
  type SketchSample,
  type SketchSolveState
} from './workshopMotionSketch'
import { getMotionSketchState, setMotionSketchState, toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import '../../styles/layerWorkshopMotionSketch.css'

export interface MotionSketchOverlayProps extends BoneOverlayProps {
  /** Tua về thời điểm t rồi phát thử. */
  playFrom?: (time: number) => void
  /** Tua đầu phát (nhịp live: playhead chạy theo tay để các xương khác chuyển động cùng lúc). */
  seek?: (time: number) => void
}

interface SketchDrag {
  anchor?: SketchAnchor
  mode: MotionSketchMode
  live: boolean
  startTime: number
  clipDuration: number
  t0: number
  samples: SketchSample[]
  ghost: { head: Point2D; tail: Point2D }
  solve: SketchSolveState
}

type Segment = { id: string; name: string; head: Point2D; tail: Point2D }

const toPath = (pts: Point2D[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (['input', 'textarea', 'select'].includes(el.tagName?.toLowerCase()) || el.isContentEditable)
}

/** Phím tắt: D bật/tắt bút vẽ động tác · Esc huỷ nét đang vẽ hoặc tắt bút. */
function useSketchKeys(onCancelDrag: () => boolean) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        toggleMotionSketchArmed()
      } else if (e.key === 'Escape') {
        if (onCancelDrag()) return
        if (getMotionSketchState().armed) toggleMotionSketchArmed(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelDrag])
}

function liveLabel(anchor: SketchAnchor, mode: MotionSketchMode, p: Point2D, values: number[]): string {
  if (anchor.ik) return `${anchor.boneName} · IK ${anchor.ik.chain.boneIds.length} xương`
  if (mode === 'move') return `${anchor.boneName} · ${(p.x - anchor.start.x).toFixed(0)}, ${(p.y - anchor.start.y).toFixed(0)} px`
  const delta = values[0] - anchor.base.rotation
  return `${anchor.boneName} · ${delta > 0 ? '+' : ''}${delta.toFixed(0)}°`
}

/** Lớp vẽ động tác trên Bố cục 2D (tab Animation): nhấn gần xương hoặc vẽ dọc theo nhánh mesh để tạo chuyển động. */
export function MotionSketchOverlay(props: MotionSketchOverlayProps) {
  const { composite, time } = props
  const sketch = useMotionSketch()
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<SketchDrag | null>(null)
  const [stroke, setStroke] = useState<Point2D[] | null>(null)
  const [hover, setHover] = useState<Segment | null>(null)
  const [label, setLabel] = useState<{ x: number; y: number; text: string } | null>(null)
  const rig = composite.rig

  const cancelDragRef = useRef<() => boolean>(() => false)
  const advanceRef = useRef<(drag: SketchDrag, p: Point2D) => void>(() => {})
  cancelDragRef.current = () => {
    const drag = dragRef.current
    if (!drag) return false
    dragRef.current = null
    props.cancelGesture?.()
    if (drag.live) props.seek?.(drag.startTime)
    setStroke(null)
    setLabel(null)
    setMotionSketchState({ status: 'Đã huỷ nét vẽ' })
    return true
  }
  const [cancelDrag] = useState(() => () => cancelDragRef.current())
  useSketchKeys(cancelDrag)

  if (!sketch.armed) return null

  const toLocal = (e: PointerEvent): Point2D | null => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  const segmentOf = (id: string): Segment | null => {
    const seg = rig ? boneSegments(rig, time).find((s) => s.bone.id === id) : undefined
    return seg ? { id, name: seg.bone.name, head: seg.head, tail: seg.tail } : null
  }

  const handleDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.altKey) return // Alt / chuột giữa: để khung 2D tự dời
    e.stopPropagation()
    const p = toLocal(e)
    if (!p) return
    const pickedBoneId = rig?.bones.length ? pickSketchBone(rig, p, time)?.bone.id : undefined
    const { settings } = getMotionSketchState()
    const mode: MotionSketchMode = e.shiftKey ? (settings.mode === 'rotate' ? 'move' : 'rotate') : settings.mode
    const clipDuration = rig?.duration ?? 4
    const startTime = Math.min(clipDuration, Math.max(0, time))
    // Ctrl khi bắt đầu: chỉ xoay riêng xương được chọn (bỏ IK) cho lần vẽ này
    const chain = e.ctrlKey || e.metaKey || mode === 'move' ? 1 : settings.chain
    const anchor = pickedBoneId && rig ? createSketchAnchor(rig, pickedBoneId, startTime, p, chain) : undefined
    const ghost = pickedBoneId ? segmentOf(pickedBoneId) : null
    props.stopPlayback?.()
    if (pickedBoneId) props.selectBone(pickedBoneId)
    props.beginGesture?.()
    dragRef.current = {
      anchor,
      mode,
      startTime,
      live: Boolean(anchor && settings.timing === 'live' && props.seek),
      clipDuration,
      t0: performance.now(),
      samples: [{ ...p, t: 0 }],
      ghost: ghost ?? { head: anchor?.pivot ?? p, tail: p },
      solve: {}
    }
    setStroke([p])
    setHover(null)
    try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* pointer đã kết thúc */ }
    const started = dragRef.current
    if (started?.live) {
      // Giữ bút đứng yên vẫn ghi tiếp: đầu phát chạy đều, xương giữ tư thế (giống ghi hình thật)
      const tick = () => {
        if (dragRef.current !== started) return
        const lastSample = started.samples[started.samples.length - 1]
        if (performance.now() - started.t0 - lastSample.t * 1000 > 60) advanceRef.current(started, lastSample)
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
  }

  const advance = (drag: SketchDrag, p: Point2D) => {
    const elapsed = Math.min(SKETCH_MAX_DURATION, (performance.now() - drag.t0) / 1000)
    drag.samples.push({ x: p.x, y: p.y, t: elapsed })
    setStroke(drag.samples.map(({ x, y }) => ({ x, y })))
    if (!drag.anchor) {
      drag.ghost = { head: drag.samples[0], tail: p }
      const dist = Math.hypot(p.x - drag.samples[0].x, p.y - drag.samples[0].y)
      setLabel({ x: p.x, y: p.y, text: `Vẽ xương nhánh · ${dist.toFixed(0)} px` })
      return
    }
    const { columns, values } = sketchValuesAt(drag.anchor, p, drag.mode, drag.solve)
    // Xem trước trực tiếp (huỷ lại khi thả để ghi cả chuỗi keyframe trong một bước hoàn tác).
    const previewTime = drag.live ? Math.min(drag.clipDuration, drag.startTime + elapsed) : drag.startTime
    if (drag.live) props.seek?.(previewTime)
    props.setComposite((c) => applyRigAction(c, { action: 'batch', operations: sketchPreviewOps(columns, values, previewTime) }))
    setLabel({ x: p.x, y: p.y, text: `${liveLabel(drag.anchor, drag.mode, p, values)}${drag.live ? ` · ● ${elapsed.toFixed(1)}s` : ''}` })
  }
  advanceRef.current = advance

  const handleMove = (e: PointerEvent) => {
    const p = toLocal(e)
    if (!p) return
    const drag = dragRef.current
    if (!drag) {
      const pick = rig ? pickSketchBone(rig, p, time) : null
      if ((pick?.bone.id ?? null) !== (hover?.id ?? null)) setHover(pick ? segmentOf(pick.bone.id) : null)
      return
    }
    const last = drag.samples[drag.samples.length - 1]
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return
    advance(drag, p)
  }

  const handleUp = () => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setStroke(null)
    setLabel(null)
    props.cancelGesture?.() // bỏ khung xem trước, commit một lần duy nhất bên dưới
    if (drag.live) props.seek?.(drag.startTime)
    const len = drag.samples.reduce((sum, s, i) => (i ? sum + Math.hypot(s.x - drag.samples[i - 1].x, s.y - drag.samples[i - 1].y) : 0), 0)
    if (drag.samples.length < 3 || len < 6) {
      setMotionSketchState({ status: 'Nét quá ngắn — giữ chuột và vẽ dài hơn' })
      return
    }
    const { settings } = getMotionSketchState()
    let summary: { boneId: string; boneName: string; keyCount: number; endTime: number; bones: number } | null = null
    try {
      props.setComposite((c) => {
        if (!drag.anchor) {
          const result = applyAutoBoneMotionSketch(c, drag.samples, settings, drag.startTime)
          const keyCount = Object.values(result.tracks).reduce((n, k) => n + k.length, 0)
          summary = { boneId: result.boneId, boneName: result.boneName, keyCount, endTime: result.endTime, bones: 1 }
          return result.composite
        }
        const result = applyMotionSketch(c, drag.anchor, drag.samples, { ...settings, mode: drag.mode, timing: drag.live ? 'live' : settings.timing === 'live' ? 'hand' : settings.timing }, drag.startTime)
        const keyCount = Object.values(result.tracks).reduce((n, k) => n + k.length, 0)
        summary = { boneId: drag.anchor.boneId, boneName: drag.anchor.boneName, keyCount, endTime: result.endTime, bones: Object.keys(result.tracks).length }
        return result.composite
      })
    } catch (err) {
      setMotionSketchState({ status: `Lỗi: ${err instanceof Error ? err.message : String(err)}` })
      return
    }
    const done = summary as { boneId: string; boneName: string; keyCount: number; endTime: number; bones: number } | null
    if (!done) return
    props.selectBone(done.boneId)
    setMotionSketchState({
      last: { boneId: done.boneId, boneName: done.boneName, keyCount: done.keyCount, startTime: drag.startTime, endTime: done.endTime, stroke: drag.samples.map(({ x, y }) => ({ x, y })) },
      status: `✓ ${done.boneName}${done.bones > 1 ? ` (+${done.bones - 1} xương IK)` : ''}: ${done.keyCount} keyframe · ${drag.startTime.toFixed(2)}s → ${done.endTime.toFixed(2)}s · Ctrl+Z để vẽ lại`
    })
    if (settings.autoPlay) props.playFrom?.(drag.startTime)
  }

  const drag = dragRef.current
  const last = !drag ? sketch.last : null
  const pivotPt = drag ? (drag.anchor?.ik?.chain.points[0] ?? drag.anchor?.pivot ?? drag.ghost.head) : null
  return (
    <svg
      ref={svgRef}
      className={`lw-motion-sketch-overlay armed${hover ? ' hovering' : ''}${drag ? ' dragging' : ''}`}
      viewBox={`${-composite.width / 2} ${-composite.height / 2} ${composite.width} ${composite.height}`}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={() => cancelDragRef.current()}
      onPointerLeave={() => !dragRef.current && setHover(null)}
      aria-label="Lớp vẽ động tác hoạt ảnh"
    >
      <defs>
        <marker id="lw-sketch-arrow" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 L2,4 Z" className="lw-sketch-arrow-head" />
        </marker>
      </defs>
      {last && last.stroke.length > 1 && <path d={toPath(last.stroke)} className="lw-sketch-path faded" markerEnd="url(#lw-sketch-arrow)" />}
      {hover && (
        <g className="lw-sketch-hover" pointerEvents="none">
          <line x1={hover.head.x} y1={hover.head.y} x2={hover.tail.x} y2={hover.tail.y} className="lw-sketch-hover-bone" />
          <circle cx={hover.head.x} cy={hover.head.y} r={5} className="lw-sketch-pivot" />
          <text x={(hover.head.x + hover.tail.x) / 2 + 10} y={(hover.head.y + hover.tail.y) / 2} className="lw-sketch-label">{hover.name}</text>
        </g>
      )}
      {drag && pivotPt && (
        <g pointerEvents="none">
          <line x1={drag.ghost.head.x} y1={drag.ghost.head.y} x2={drag.ghost.tail.x} y2={drag.ghost.tail.y} className="lw-sketch-ghost" />
          <circle cx={pivotPt.x} cy={pivotPt.y} r={6} className="lw-sketch-pivot" />
        </g>
      )}
      {stroke && stroke.length > 1 && <path d={toPath(stroke)} className="lw-sketch-path" markerEnd="url(#lw-sketch-arrow)" />}
      {label && <text x={label.x + 14} y={label.y - 12} className="lw-sketch-label live">{label.text}</text>}
    </svg>
  )
}
