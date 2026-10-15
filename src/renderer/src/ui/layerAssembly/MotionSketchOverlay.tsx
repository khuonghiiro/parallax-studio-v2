import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { BoneOverlayProps } from './WorkshopBoneOverlay'
import { applyRigAction } from './workshopRig'
import {
  applyMotionSketch,
  boneSegments,
  createSketchAnchor,
  pickSketchBone,
  sketchPoseAt,
  type MotionSketchMode,
  type Point2D,
  type SketchAnchor,
  type SketchSample
} from './workshopMotionSketch'
import { getMotionSketchState, setMotionSketchState, toggleMotionSketchArmed, useMotionSketch } from './motionSketchStore'
import '../../styles/layerWorkshopMotionSketch.css'

export interface MotionSketchOverlayProps extends BoneOverlayProps {
  /** Tua về thời điểm t rồi phát thử. */
  playFrom?: (time: number) => void
}

interface SketchDrag {
  anchor: SketchAnchor
  mode: MotionSketchMode
  startTime: number
  t0: number
  samples: SketchSample[]
  ghost: { head: Point2D; tail: Point2D }
  lastRotation?: number
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

/** Lớp vẽ động tác trên Bố cục 2D (tab Animation): nhấn gần xương rồi vẽ đường đi của ngọn xương. */
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
  cancelDragRef.current = () => {
    if (!dragRef.current) return false
    dragRef.current = null
    props.cancelGesture?.()
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
    if (!rig?.bones.length) {
      setMotionSketchState({ status: 'Chưa có khung xương — sang tab "Tạo xương" để dựng xương trước' })
      return
    }
    const boneId = pickSketchBone(rig, p, time)?.bone.id ?? props.boneId
    if (!boneId || !rig.bones.some((b) => b.id === boneId)) {
      setMotionSketchState({ status: 'Hãy nhấn gần một xương (hoặc chọn xương trước) rồi vẽ' })
      return
    }
    const startTime = Math.min(rig.duration, Math.max(0, time))
    const anchor = createSketchAnchor(rig, boneId, startTime, p)
    const ghost = segmentOf(boneId)
    const { settings } = getMotionSketchState()
    const mode: MotionSketchMode = e.shiftKey ? (settings.mode === 'rotate' ? 'move' : 'rotate') : settings.mode
    props.stopPlayback?.()
    props.selectBone(boneId)
    props.beginGesture?.()
    dragRef.current = { anchor, mode, startTime, t0: performance.now(), samples: [{ ...p, t: 0 }], ghost: ghost ?? { head: anchor.pivot, tail: p } }
    setStroke([p])
    setHover(null)
    try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* pointer đã kết thúc */ }
  }

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
    drag.samples.push({ ...p, t: (performance.now() - drag.t0) / 1000 })
    setStroke(drag.samples.map(({ x, y }) => ({ x, y })))
    const pose = sketchPoseAt(drag.anchor, p, drag.mode, drag.lastRotation)
    drag.lastRotation = pose.rotation ?? drag.lastRotation
    // Xem trước trực tiếp: xương + layer bám theo ngọn bút (huỷ lại khi thả để ghi cả chuỗi keyframe)
    props.setComposite((c) => applyRigAction(c, { action: 'set-key', boneId: drag.anchor.boneId, key: { time: drag.startTime, ...pose } }))
    const delta = pose.rotation !== undefined ? pose.rotation - drag.anchor.base.rotation : 0
    const text = drag.mode === 'rotate'
      ? `${drag.anchor.boneName} · ${delta > 0 ? '+' : ''}${delta.toFixed(0)}°`
      : `${drag.anchor.boneName} · ${(p.x - drag.anchor.start.x).toFixed(0)}, ${(p.y - drag.anchor.start.y).toFixed(0)} px`
    setLabel({ x: p.x, y: p.y, text })
  }

  const handleUp = () => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setStroke(null)
    setLabel(null)
    props.cancelGesture?.() // bỏ khung xem trước, commit một lần duy nhất bên dưới
    const len = drag.samples.reduce((sum, s, i) => (i ? sum + Math.hypot(s.x - drag.samples[i - 1].x, s.y - drag.samples[i - 1].y) : 0), 0)
    if (drag.samples.length < 3 || len < 6) {
      setMotionSketchState({ status: 'Nét quá ngắn — giữ chuột và vẽ dài hơn' })
      return
    }
    const { settings } = getMotionSketchState()
    let summary: { keyCount: number; endTime: number } | null = null
    try {
      props.setComposite((c) => {
        const result = applyMotionSketch(c, drag.anchor, drag.samples, { ...settings, mode: drag.mode }, drag.startTime)
        summary = { keyCount: result.keys.length, endTime: result.endTime }
        return result.composite
      })
    } catch (err) {
      setMotionSketchState({ status: `Lỗi: ${err instanceof Error ? err.message : String(err)}` })
      return
    }
    const done = summary as { keyCount: number; endTime: number } | null
    if (!done) return
    setMotionSketchState({
      last: { boneId: drag.anchor.boneId, boneName: drag.anchor.boneName, keyCount: done.keyCount, startTime: drag.startTime, endTime: done.endTime, stroke: drag.samples.map(({ x, y }) => ({ x, y })) },
      status: `✓ ${drag.anchor.boneName}: ${done.keyCount} keyframe · ${drag.startTime.toFixed(2)}s → ${done.endTime.toFixed(2)}s · Ctrl+Z để vẽ lại`
    })
    if (settings.autoPlay) props.playFrom?.(drag.startTime)
  }

  const drag = dragRef.current
  const last = !drag ? sketch.last : null
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
      {drag && (
        <g pointerEvents="none">
          <line x1={drag.ghost.head.x} y1={drag.ghost.head.y} x2={drag.ghost.tail.x} y2={drag.ghost.tail.y} className="lw-sketch-ghost" />
          <circle cx={drag.anchor.pivot.x} cy={drag.anchor.pivot.y} r={6} className="lw-sketch-pivot" />
        </g>
      )}
      {stroke && stroke.length > 1 && <path d={toPath(stroke)} className="lw-sketch-path" markerEnd="url(#lw-sketch-arrow)" />}
      {label && <text x={label.x + 14} y={label.y - 12} className="lw-sketch-label live">{label.text}</text>}
    </svg>
  )
}
