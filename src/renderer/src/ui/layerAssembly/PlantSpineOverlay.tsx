import { useEffect, useRef, useState, type PointerEvent, type MouseEvent } from 'react'
import type { PlantSpine, PlantSpinePoint } from '@shared/plantSpine'
import type { LayerComposite } from './types'
import { plantTipAngleToward, plantTipTransformToward } from '../../engine/plantSpine'
import {
  applyPlantSpineAction,
  createPlantSpine,
  resolveSpineLayerIds,
  simplifyStroke,
  strokeLength
} from './workshopPlantSpines'
import {
  PLANT_AMPLITUDE_MAX,
  PLANT_LEAN_MAX,
  distanceToPolyline,
  insertPlantSpinePoint,
  movePlantSpinePoint,
  projectPointOnPolyline,
  removePlantSpinePoint,
  translatePlantSpine,
  type SwaySample
} from './plantSpineEdit'
import { resolvePlantGrab } from './plantMotionRecord'
import { layersUnderClientStroke } from './plantStrokeHitTest'
import { PlantSpineShape, SelectedSpineHandles, toPlantPath } from './PlantSpineShapes'
import { getPlantSpineEditorState, setPlantSpineEditorState, usePlantSpineEditor } from './plantSpineEditorStore'

export interface PlantSpineOverlayProps {
  composite: LayerComposite
  setComposite: (update: (prev: LayerComposite) => LayerComposite, key?: string) => void
  selectedIds: string[]
  time: number
  /** Đang ở tab Motion: vẽ xương mới, chọn & sửa xương bằng tay nắm. */
  drawing: boolean
  beginGesture?: () => void
  endGesture?: () => void
  onError?: (message: string) => void
}

type Drag =
  | { kind: 'draw'; pts: PlantSpinePoint[]; client: Array<{ x: number; y: number }> }
  | { kind: 'point'; spineId: string; index: number }
  | { kind: 'move'; spineId: string; start: PlantSpinePoint; origin: PlantSpinePoint[] }
  | { kind: 'grab'; spine: PlantSpine; startAngle: number; startStretch: number; t0: number; samples: SwaySample[]; record: boolean }

const GRAB_LIMIT = PLANT_AMPLITUDE_MAX + PLANT_LEAN_MAX
const RECORD_LIMIT = 85

/** Lớp SVG trên Bố cục 2D: hiển thị xương motion, vẽ tay xương mới và chỉnh trực tiếp bằng tay nắm. */
export function PlantSpineOverlay(props: PlantSpineOverlayProps) {
  const { composite, setComposite, time, drawing } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [stroke, setStroke] = useState<PlantSpinePoint[] | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)
  const [hoverCurvePoint, setHoverCurvePoint] = useState<PlantSpinePoint | null>(null)
  const hoveredPointRef = useRef<number | null>(null)
  const hoverCurvePointRef = useRef<PlantSpinePoint | null>(null)
  const selectedRef = useRef<PlantSpine | null>(null)

  const editor = usePlantSpineEditor()
  const spines = composite.plantSpines ?? []
  const selected = drawing ? spines.find((s) => s.id === editor.selectedSpineId) ?? null : null

  hoveredPointRef.current = hoveredPointIndex
  hoverCurvePointRef.current = hoverCurvePoint
  selectedRef.current = selected

  useEffect(() => {
    if (!flash) return
    const id = window.setTimeout(() => setFlash(null), 2200)
    return () => window.clearTimeout(id)
  }, [flash])

  useEffect(() => {
    if (!drawing) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const curSelected = selectedRef.current
      if (!curSelected) return
      const isPlus = e.key === '+' || e.key === '=' || e.code === 'NumpadAdd'
      const isMinus = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract'
      const isDel = e.key === 'Delete' || e.key === 'Backspace'

      if (isPlus) {
        const pt = hoverCurvePointRef.current
        if (pt) {
          e.preventDefault()
          e.stopImmediatePropagation()
          const nextPts = insertPlantSpinePoint(curSelected.points, pt)
          patchSpine(curSelected.id, { points: nextPts })
          setHoverCurvePoint(null)
          setFlash(`➕ Đã thêm điểm uốn (${nextPts.length} khớp)`)
        }
      } else if (isMinus || isDel) {
        const idx = hoveredPointRef.current
        if (idx !== null && idx !== undefined && idx > 0) {
          e.preventDefault()
          e.stopImmediatePropagation()
          if (curSelected.points.length <= 2) {
            setFlash('⚠️ Cần giữ tối thiểu 2 điểm (gốc và ngọn)')
            return
          }
          const nextPts = removePlantSpinePoint(curSelected.points, idx)
          patchSpine(curSelected.id, { points: nextPts })
          setHoveredPointIndex(null)
          setFlash(`🗑️ Đã xoá điểm đỏ (${nextPts.length} khớp còn lại)`)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [drawing])

  if (!drawing && !spines.length) return null

  const toLocal = (e: { clientX: number; clientY: number }): PlantSpinePoint | null => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  const capture = (e: PointerEvent) => {
    e.stopPropagation()
    try { svgRef.current?.setPointerCapture(e.pointerId) } catch { /* pointer không còn hoạt động */ }
  }
  const patchSpine = (id: string, patch: Partial<PlantSpine>, key?: string) => {
    try {
      setComposite((c) => applyPlantSpineAction(c, { action: 'update', id, patch }), key)
    } catch (err) {
      props.onError?.(err instanceof Error ? err.message : String(err))
    }
  }

  const startHandleDrag = (e: PointerEvent, drag: Drag) => {
    if (e.button !== 0 || e.altKey) return
    capture(e)
    props.beginGesture?.()
    dragRef.current = drag
    if (drag.kind !== 'grab') setPlantSpineEditorState({ dragging: true })
  }

  const onDown = (e: PointerEvent) => {
    if (!drawing || e.button !== 0 || e.altKey) return
    const p = toLocal(e)
    if (!p) return
    capture(e)
    if (editor.pathRecord && selected) {
      // Vẽ quỹ đạo ngọn: ngọn bám theo hướng bút (cả uốn vòng cung lẫn co dãn lên xuống)
      props.beginGesture?.()
      dragRef.current = { kind: 'grab', spine: selected, startAngle: 0, startStretch: 0, t0: performance.now(), samples: [], record: true }
      onMove(e)
      return
    }
    dragRef.current = { kind: 'draw', pts: [p], client: [{ x: e.clientX, y: e.clientY }] }
    setStroke([p])
  }

  const onMove = (e: PointerEvent) => {
    const drag = dragRef.current
    const p = toLocal(e)
    if (!drag) {
      if (drawing && selected && p) {
        if (hoveredPointRef.current !== null) {
          if (hoverCurvePointRef.current) setHoverCurvePoint(null)
        } else {
          const proj = projectPointOnPolyline(p, selected.points)
          if (proj && proj.dist <= 24) {
            const tooClose = selected.points.some((pt) => Math.hypot(pt.x - proj.point.x, pt.y - proj.point.y) < 14)
            if (!tooClose) setHoverCurvePoint(proj.point)
            else if (hoverCurvePointRef.current) setHoverCurvePoint(null)
          } else if (hoverCurvePointRef.current) {
            setHoverCurvePoint(null)
          }
        }
      }
      return
    }
    if (!p) return
    if (drag.kind === 'draw') {
      const last = drag.pts[drag.pts.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return
      drag.pts.push(p)
      drag.client.push({ x: e.clientX, y: e.clientY })
      setStroke([...drag.pts])
    } else if (drag.kind === 'point') {
      const spine = spines.find((s) => s.id === drag.spineId)
      if (spine) patchSpine(spine.id, { points: movePlantSpinePoint(spine.points, drag.index, p) })
    } else if (drag.kind === 'move') {
      patchSpine(drag.spineId, { points: translatePlantSpine(drag.origin, p.x - drag.start.x, p.y - drag.start.y) })
    } else {
      const limit = drag.record ? RECORD_LIMIT : GRAB_LIMIT
      const { angle: rawAngle, stretch: rawStretch } = plantTipTransformToward(drag.spine, p)
      const raw = rawAngle - drag.startAngle
      const angle = Math.max(-limit, Math.min(limit, raw))
      const stretch = Math.max(-0.45, Math.min(0.65, rawStretch - drag.startStretch))
      const elapsed = (performance.now() - drag.t0) / 1000
      drag.samples.push({ angle, stretch, t: elapsed })
      setPlantSpineEditorState({ grab: { spineId: drag.spine.id, angle, stretch, elapsed, recording: drag.record } })
    }
  }

  const finishDraw = (pts: PlantSpinePoint[], client: Array<{ x: number; y: number }>) => {
    if (strokeLength(pts) < 8) {
      // Click: chọn xương gần nhất (hoặc bỏ chọn khi bấm ra ngoài)
      const hit = spines
        .map((s) => ({ id: s.id, d: distanceToPolyline(pts[0], s.points) }))
        .sort((a, b) => a.d - b.d)[0]
      setPlantSpineEditorState({ selectedSpineId: hit && hit.d < 16 ? hit.id : null })
      return
    }
    try {
      const order = composite.layers.map((l) => l.id)
      const hits = editor.target === 'auto' ? layersUnderClientStroke(svgRef.current, client, order) : []
      const layerIds = resolveSpineLayerIds(composite, editor.target, props.selectedIds, hits)
      const spine = createPlantSpine({ points: simplifyStroke(pts), layerIds, preset: editor.preset })
      setComposite((c) => applyPlantSpineAction(c, { action: 'add', spine }))
      setPlantSpineEditorState({ selectedSpineId: spine.id })
      const names = composite.layers.filter((l) => layerIds.includes(l.id)).map((l) => l.name)
      setFlash(`Gắn vào: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` +${names.length - 3}` : ''}`)
    } catch (err) {
      props.onError?.(err instanceof Error ? err.message : String(err))
    }
  }

  const finishGrab = (drag: Extract<Drag, { kind: 'grab' }>) => {
    setPlantSpineEditorState({ grab: null })
    const result = resolvePlantGrab(drag.samples, drag.spine, { mode: drag.record ? 'record' : 'learn', end: editor.recordEnd })
    if (!result) {
      if (drag.record) setFlash('Chuyển động quá ngắn — giữ chuột và kéo qua lại lâu hơn (≥ 0,2 giây)')
      return
    }
    patchSpine(drag.spine.id, result.patch)
    setFlash(result.message)
  }

  const finish = () => {
    const drag = dragRef.current
    dragRef.current = null
    setStroke(null)
    if (!drag) return
    if (drag.kind === 'draw') return finishDraw(drag.pts, drag.client)
    if (drag.kind === 'grab') finishGrab(drag)
    if (getPlantSpineEditorState().dragging) setPlantSpineEditorState({ dragging: false })
    props.endGesture?.()
  }

  const cancel = () => {
    const drag = dragRef.current
    dragRef.current = null
    setStroke(null)
    if (drag && drag.kind !== 'draw') {
      setPlantSpineEditorState({ grab: null, dragging: false })
      props.endGesture?.()
    }
  }

  const onLeave = () => {
    if (!dragRef.current) {
      setHoverCurvePoint(null)
      setHoveredPointIndex(null)
    }
  }

  const handleProps = selected && {
    spine: selected,
    grabMode: editor.grabMode,
    grabbing: editor.grab?.spineId === selected.id,
    hoveredPointIndex,
    hoverCurvePoint,
    onPointHover: (idx: number | null) => {
      setHoveredPointIndex(idx)
      if (idx !== null) setHoverCurvePoint(null)
    },
    onBodyDown: (e: PointerEvent) => {
      const p = toLocal(e)
      if (p) startHandleDrag(e, { kind: 'move', spineId: selected.id, start: p, origin: selected.points })
    },
    onBodyDoubleClick: (e: MouseEvent) => {
      const p = toLocal(e)
      if (p) patchSpine(selected.id, { points: insertPlantSpinePoint(selected.points, p) })
    },
    onPointDown: (e: PointerEvent, index: number) => startHandleDrag(e, { kind: 'point', spineId: selected.id, index }),
    onPointDoubleClick: (_e: MouseEvent, index: number) =>
      patchSpine(selected.id, { points: removePlantSpinePoint(selected.points, index) }),
    onGrabDown: (e: PointerEvent) => {
      const p = toLocal(e)
      if (!p) return
      const target = plantTipTransformToward(selected, p)
      startHandleDrag(e, {
        kind: 'grab',
        spine: selected,
        startAngle: target.angle,
        startStretch: target.stretch,
        t0: performance.now(),
        samples: [],
        record: editor.grabMode === 'record'
      })
    }
  }

  return (
    <svg
      ref={svgRef}
      className={`lw-plant-overlay${drawing ? ' drawing' : ''}${drawing && editor.pathRecord && selected ? ' path-record' : ''}`}
      viewBox={`${-composite.width / 2} ${-composite.height / 2} ${composite.width} ${composite.height}`}
      aria-label="Xương motion trên Bố cục 2D"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={finish}
      onPointerCancel={cancel}
      onPointerLeave={onLeave}
    >
      {spines.map((s) => (
        <PlantSpineShape
          key={s.id}
          spine={s}
          time={time}
          selected={selected?.id === s.id}
          grabAngle={editor.grab?.spineId === s.id ? editor.grab.angle : undefined}
          grabStretch={editor.grab?.spineId === s.id ? editor.grab.stretch : undefined}
        />
      ))}
      {handleProps && <SelectedSpineHandles {...handleProps} />}
      {stroke && stroke.length > 1 && <path d={toPlantPath(stroke)} className="lw-plant-stroke" />}
      {stroke && <circle cx={stroke[0].x} cy={stroke[0].y} r={5} className="lw-plant-root" />}
      {flash && (
        <text x={0} y={composite.height / 2 - 18} textAnchor="middle" className="lw-plant-flash">{flash}</text>
      )}
      {editor.grab?.recording && (
        <text x={0} y={composite.height / 2 - 44} textAnchor="middle" className="lw-plant-rec">
          {`● REC ${(editor.grab.elapsed ?? 0).toFixed(1)}s · ${editor.grab.angle.toFixed(0)}°${Math.abs(editor.grab.stretch ?? 0) >= 0.02 ? ` · nhún ${(((editor.grab.stretch ?? 0)) * 100).toFixed(0)}%` : ''} — thả chuột để lưu`}
        </text>
      )}
    </svg>
  )
}
